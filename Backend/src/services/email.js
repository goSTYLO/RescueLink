const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('⚠️ SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Password reset emails will not be sent.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  return transporter;
}

/**
 * Send password reset email with the given reset link.
 * @param {string} toEmail - Recipient email
 * @param {string} resetLink - Full URL to reset password (e.g. https://app/reset-password?token=...)
 * @returns {Promise<boolean>} - true if sent, false if SMTP not configured or send failed
 */
async function sendPasswordResetEmail(toEmail, resetLink) {
  const trans = getTransporter();
  if (!trans) return false;

  const html = `
    <p>You requested a password reset for your RescueLink dispatcher account.</p>
    <p><a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#134178;color:#fff;text-decoration:none;border-radius:8px;">Reset password</a></p>
    <p>Or copy this link into your browser:</p>
    <p style="word-break:break-all;">${resetLink}</p>
    <p><strong>This link is valid for 1 hour.</strong></p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  try {
    await trans.sendMail({
      from: SMTP_USER,
      to: toEmail,
      subject: 'RescueLink – Reset your password',
      text: `Reset your password by visiting: ${resetLink}. This link is valid for 1 hour.`,
      html,
    });
    return true;
  } catch (err) {
    console.error('❌ Send password reset email error:', err.message);
    return false;
  }
}

module.exports = { sendPasswordResetEmail, getTransporter };
