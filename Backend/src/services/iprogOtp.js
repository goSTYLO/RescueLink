const axios = require('axios');

const DEFAULT_BASE = 'https://www.iprogsms.com/api/v1';

// ponytail: in-memory pending regs; ceiling = single Node process / lost on restart.
// Upgrade: Redis or DB table with TTL when multi-instance.
const pendingByPhone = new Map();

/**
 * IPROG OTP expects digits only: 63XXXXXXXXXX (no leading +, no leading 0).
 * Self-contained — do not reuse helpers that might emit E.164 (+63…).
 */
function toIprogPhone(phone) {
  let digits = String(phone ?? '').trim().replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `63${digits.slice(1)}`;
  else if (digits.length && !digits.startsWith('63')) digits = `63${digits}`;
  if (!/^63[0-9]{10}$/.test(digits)) {
    throw new Error('Invalid phone number for IPROG OTP');
  }
  return digits;
}

function getConfig() {
  const apiToken = (process.env.IPROG_API_TOKEN || '').trim();
  const baseUrl = (process.env.IPROG_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const expiresInMinutes = Math.min(
    60,
    Math.max(1, parseInt(process.env.IPROG_OTP_EXPIRES_IN_MINUTES || '5', 10) || 5)
  );
  const message = (process.env.IPROG_OTP_MESSAGE || '').trim() || undefined;
  return { apiToken, baseUrl, expiresInMinutes, message };
}

function requireToken() {
  const { apiToken } = getConfig();
  if (!apiToken) {
    throw new Error('IPROG SMS is not configured on the server');
  }
  return apiToken;
}

function pendingTtlMs() {
  const { expiresInMinutes } = getConfig();
  // Keep pending slightly longer than OTP so verify can still find the payload.
  return (expiresInMinutes + 10) * 60 * 1000;
}

function setPending(phone, payload) {
  pendingByPhone.set(phone, {
    ...payload,
    phone,
    createdAt: Date.now(),
    expiresAt: Date.now() + pendingTtlMs(),
  });
}

function getPending(phone) {
  const row = pendingByPhone.get(phone);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    pendingByPhone.delete(phone);
    return null;
  }
  return row;
}

function clearPending(phone) {
  pendingByPhone.delete(phone);
}

/** @returns {Promise<void>} */
async function sendOtp(phone) {
  const apiToken = requireToken();
  const { baseUrl, expiresInMinutes, message } = getConfig();
  const phoneNumber = toIprogPhone(phone);
  const body = {
    api_token: apiToken,
    phone_number: phoneNumber,
    expires_in_minutes: expiresInMinutes,
  };
  if (message) body.message = message;

  // JSON.stringify so a stray "+" is obvious in the backend console.
  console.log('📱 IPROG send_otp phone_number=', JSON.stringify(phoneNumber));

  const { data } = await axios.post(`${baseUrl}/otp/send_otp`, body, {
    timeout: 20000,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  // IPROG may return otp_code in data — never log it.
  const status = data?.status;
  const apiMessage = data?.message;
  const msg = String(apiMessage || '').toLowerCase();
  const payload = data?.data && typeof data.data === 'object' ? data.data : {};
  const messageId =
    data?.message_id ||
    payload.message_id ||
    payload.message_code ||
    payload.id ||
    undefined;
  const returnedPhone = payload.phone_number;
  console.log(
    '📱 IPROG send_otp response=',
    JSON.stringify({
      status,
      message: apiMessage,
      message_id: messageId,
      phone_number: returnedPhone,
    })
  );

  const ok =
    status === 200 ||
    status === 'success' ||
    msg.includes('sent successfully') ||
    msg.includes('otp sent');

  if (!ok) {
    throw new Error(data?.message || 'Failed to send verification code');
  }
}

/**
 * @returns {Promise<{ ok: boolean, expired?: boolean, invalid?: boolean, message?: string }>}
 */
async function verifyOtp(phone, otp) {
  const apiToken = requireToken();
  const { baseUrl } = getConfig();
  const phoneNumber = toIprogPhone(phone);

  try {
    const { data } = await axios.post(
      `${baseUrl}/otp/verify_otp`,
      {
        api_token: apiToken,
        phone_number: phoneNumber,
        otp: String(otp).trim(),
      },
      {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        validateStatus: () => true,
      }
    );

    const msg = String(data?.message || '').toLowerCase();
    const status = data?.status;
    const success =
      status === 200 ||
      status === 'success' ||
      msg.includes('verified successfully');

    if (success) return { ok: true };

    if (msg.includes('expir')) {
      return { ok: false, expired: true, message: data?.message };
    }
    return { ok: false, invalid: true, message: data?.message };
  } catch (err) {
    const msg = String(err.response?.data?.message || err.message || '').toLowerCase();
    if (msg.includes('expir')) {
      return { ok: false, expired: true, message: err.response?.data?.message };
    }
    if (msg.includes('invalid') || msg.includes('incorrect') || err.response?.status === 400) {
      return { ok: false, invalid: true, message: err.response?.data?.message };
    }
    throw err;
  }
}

/** Test helper */
function _clearAllPendingForTests() {
  pendingByPhone.clear();
}

module.exports = {
  setPending,
  getPending,
  clearPending,
  sendOtp,
  verifyOtp,
  toIprogPhone,
  _clearAllPendingForTests,
};
