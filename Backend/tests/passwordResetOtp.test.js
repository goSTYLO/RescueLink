jest.mock('../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/retryAiClassification', () => ({
  startRetryService: () => ({ stop: jest.fn() }),
}));
jest.mock('../src/services/retryFileScan', () => ({
  startFileScanRetryService: () => ({ stop: jest.fn() }),
}));
jest.mock('../src/services/duplicateBackgroundAnalyzer', () => ({
  startDuplicateAnalyzer: () => null,
}));
jest.mock('../src/services/recaptcha', () => ({
  verifyRecaptchaToken: jest.fn(),
}));
jest.mock('../src/services/iprogOtp', () => {
  const actual = jest.requireActual('../src/services/iprogOtp');
  return {
    ...actual,
    sendOtp: jest.fn(),
    verifyOtp: jest.fn(),
  };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../src/models/user');
const { verifyRecaptchaToken } = require('../src/services/recaptcha');
const iprogOtp = require('../src/services/iprogOtp');
const { JWT_SECRET } = require('../src/config/jwt');
const app = require('../src/app');

afterAll(() => {
  try {
    app?.locals?.retryTask?.stop?.();
    app?.locals?.scanRetryTask?.stop?.();
  } catch (_) {}
});

beforeEach(() => {
  jest.clearAllMocks();
  iprogOtp._clearAllPendingForTests();
  verifyRecaptchaToken.mockResolvedValue(true);
  iprogOtp.sendOtp.mockResolvedValue(undefined);
  iprogOtp.verifyOtp.mockResolvedValue({ ok: true });
});

describe('mobile forgot-password IPROG OTP', () => {
  it('unknown phone returns generic 200 and does not call sendOtp', async () => {
    jest.spyOn(User, 'findByPhone').mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/forgot-password/sms')
      .send({ phone: '09171234567', captchaToken: 'fake-captcha' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/If an account exists/i);
    expect(iprogOtp.sendOtp).not.toHaveBeenCalled();
    expect(iprogOtp.getPending('09171234567')).toBeNull();
  });

  it('known phone sends OTP and sets password_reset pending', async () => {
    jest.spyOn(User, 'findByPhone').mockResolvedValue({
      user_id: 7,
      phone_number: '09171234567',
    });

    const res = await request(app)
      .post('/api/auth/forgot-password/sms')
      .send({ phone: '09171234567', captchaToken: 'fake-captcha' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(iprogOtp.sendOtp).toHaveBeenCalledWith('09171234567');
    const pending = iprogOtp.getPending('09171234567');
    expect(pending).toBeTruthy();
    expect(pending.purpose).toBe('password_reset');
    expect(pending.passwordHash).toBeUndefined();
  });

  it('verify returns resetToken and clears pending', async () => {
    iprogOtp.setPending('09171234567', { purpose: 'password_reset' });
    jest.spyOn(User, 'findByPhone').mockResolvedValue({
      user_id: 7,
      phone_number: '09171234567',
    });

    const res = await request(app)
      .post('/api/auth/forgot-password/sms/verify')
      .send({ phone: '09171234567', otp: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resetToken).toBeTruthy();
    expect(iprogOtp.getPending('09171234567')).toBeNull();

    const decoded = jwt.verify(res.body.resetToken, JWT_SECRET);
    expect(decoded.purpose).toBe('password_reset_phone');
    expect(decoded.phone).toBe('09171234567');
  });

  it('reset-password updates password with valid resetToken', async () => {
    const resetToken = jwt.sign(
      { phone: '09171234567', purpose: 'password_reset_phone' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    jest.spyOn(User, 'findByPhone').mockResolvedValue({
      user_id: 7,
      phone_number: '09171234567',
    });
    const updateSpy = jest.spyOn(User, 'updatePassword').mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Password updated/i);
    expect(updateSpy).toHaveBeenCalledWith(7, expect.any(String));
  });

  it('registration verify-otp rejects password_reset pending', async () => {
    iprogOtp.setPending('09171234567', { purpose: 'password_reset' });
    jest.spyOn(User, 'findByPhone').mockResolvedValue(null);
    const createSpy = jest.spyOn(User, 'create');

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '09171234567', otp: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/register again/i);
    expect(createSpy).not.toHaveBeenCalled();
    expect(iprogOtp.verifyOtp).not.toHaveBeenCalled();
  });

  it('resend with no password_reset pending returns generic 200 without sendOtp', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password/sms/resend')
      .send({ phone: '09171234567', captchaToken: 'fake-captcha' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(iprogOtp.sendOtp).not.toHaveBeenCalled();
  });
});
