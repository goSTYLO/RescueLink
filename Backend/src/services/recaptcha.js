const axios = require('axios');

/**
 * Verify Google reCAPTCHA v2 token. Server-side only (RECAPTCHA_SECRET_KEY).
 * @returns {Promise<boolean>}
 */
async function verifyRecaptchaToken(token) {
  const secret = (process.env.RECAPTCHA_SECRET_KEY || '').trim();
  if (!secret) {
    throw new Error(
      'CAPTCHA is not configured on the server (set RECAPTCHA_SECRET_KEY in Backend/.env — this is the Google secret, not the Mobile site key)'
    );
  }
  if (!token || typeof token !== 'string' || !token.trim()) {
    return false;
  }

  // Site keys and secrets both often start with "6L"; using the site key as secret
  // always fails siteverify with invalid-input-secret.
  const siteKey = (process.env.RECAPTCHA_SITE_KEY || '').trim();
  if (siteKey && siteKey === secret) {
    console.error(
      '❌ RECAPTCHA_SECRET_KEY matches RECAPTCHA_SITE_KEY — paste the Secret key from Google admin, not the site key'
    );
    throw new Error(
      'CAPTCHA misconfigured: Backend RECAPTCHA_SECRET_KEY must be the Google Secret key (not the site key used in Mobile)'
    );
  }

  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token.trim());

  const { data } = await axios.post(
    'https://www.google.com/recaptcha/api/siteverify',
    params.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );

  if (data && data.success) return true;

  const codes = Array.isArray(data?.['error-codes']) ? data['error-codes'] : [];
  console.warn('⚠️ reCAPTCHA siteverify failed:', codes.join(', ') || 'unknown');
  if (codes.includes('invalid-input-secret')) {
    throw new Error(
      'CAPTCHA misconfigured: RECAPTCHA_SECRET_KEY is invalid (often the site key was pasted by mistake). Use the Secret key from https://www.google.com/recaptcha/admin'
    );
  }
  if (codes.includes('incorrect-captcha-sol') || codes.includes('invalid-input-response')) {
    console.warn(
      '⚠️ Hint: ensure Mobile RECAPTCHA_SITE_KEY + Backend RECAPTCHA_SECRET_KEY are the matching pair, and that "localhost" is in Domains for that reCAPTCHA site (Flutter WebView issues tokens for localhost).'
    );
  }
  if (codes.includes('timeout-or-duplicate')) {
    // Token already used or expired — client should solve CAPTCHA again.
    return false;
  }
  return false;
}

module.exports = { verifyRecaptchaToken };
