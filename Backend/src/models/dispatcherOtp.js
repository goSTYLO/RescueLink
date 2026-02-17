const pool = require('../config/db');
const crypto = require('crypto');

const OTP_EXPIRY_MINUTES = 10;

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

const DispatcherOtp = {
  async create(userId) {
    const otp = generateOtp();
    const sessionToken = generateSessionToken();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO dispatcher_login_otp (session_token, user_id, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionToken, userId, otpHash, expiresAt]
    );

    return { otp, sessionToken, expiresAt };
  },

  async verify(sessionToken, otp) {
    const otpHash = hashOtp(otp);
    const res = await pool.query(
      `SELECT user_id FROM dispatcher_login_otp
       WHERE session_token = $1 AND otp_hash = $2 AND expires_at > NOW()`,
      [sessionToken, otpHash]
    );

    if (res.rows.length === 0) return null;
    const { user_id } = res.rows[0];

    // Delete used OTP
    await pool.query('DELETE FROM dispatcher_login_otp WHERE session_token = $1', [sessionToken]);

    return user_id;
  },

  async cleanupExpired() {
    await pool.query('DELETE FROM dispatcher_login_otp WHERE expires_at < NOW()');
  }
};

module.exports = DispatcherOtp;
