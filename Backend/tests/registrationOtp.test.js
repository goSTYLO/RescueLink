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
const User = require('../src/models/user');
const { verifyRecaptchaToken } = require('../src/services/recaptcha');
const iprogOtp = require('../src/services/iprogOtp');
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

describe('citizen registration IPROG OTP', () => {
  it('register does not create a user; returns verificationRequired', async () => {
    const createSpy = jest.spyOn(User, 'create').mockResolvedValue({});
    jest.spyOn(User, 'findByPhone').mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Test',
        lastName: 'User',
        phone: '09171234567',
        address: 'Lucao',
        password: 'Password1!abc',
        latitude: 16.043,
        longitude: 120.334,
        captchaToken: 'fake-captcha',
      });

    expect(res.status).toBe(200);
    expect(res.body.verificationRequired).toBe(true);
    expect(res.body.success).toBe(true);
    expect(createSpy).not.toHaveBeenCalled();
    expect(iprogOtp.sendOtp).toHaveBeenCalledWith('09171234567');
    expect(iprogOtp.getPending('09171234567')).toBeTruthy();
  });

  it('verify-otp creates user only after IPROG ok', async () => {
    jest.spyOn(User, 'findByPhone').mockResolvedValue(null);
    const createSpy = jest.spyOn(User, 'create').mockResolvedValue({
      user_id: 99,
      phone_number: '09171234567',
      first_name: 'Test',
      last_name: 'User',
      role: 'user',
    });

    iprogOtp.setPending('09171234567', {
      firstName: 'Test',
      lastName: 'User',
      email: null,
      address: 'Lucao',
      passwordHash: 'hashed',
    });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '09171234567', otp: '123456' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        phone_number: '09171234567',
        phone_verified: true,
        password: 'hashed',
      })
    );
    expect(iprogOtp.getPending('09171234567')).toBeNull();
  });

  it('verify-otp keeps pending on invalid code', async () => {
    iprogOtp.verifyOtp.mockResolvedValue({ ok: false, invalid: true });
    iprogOtp.setPending('09171234567', {
      firstName: 'Test',
      lastName: 'User',
      email: null,
      address: 'Lucao',
      passwordHash: 'hashed',
    });
    jest.spyOn(User, 'findByPhone').mockResolvedValue(null);
    const createSpy = jest.spyOn(User, 'create');

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '09171234567', otp: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid verification code/i);
    expect(createSpy).not.toHaveBeenCalled();
    expect(iprogOtp.getPending('09171234567')).toBeTruthy();
  });
});

describe('toIprogPhone', () => {
  it('formats local and +63 inputs as 63XXXXXXXXXX (never keeps +)', () => {
    expect(iprogOtp.toIprogPhone('09281576989')).toBe('639281576989');
    expect(iprogOtp.toIprogPhone('+639281576989')).toBe('639281576989');
    expect(iprogOtp.toIprogPhone('639281576989')).toBe('639281576989');
    expect(iprogOtp.toIprogPhone('+639281576989')).not.toMatch(/\+/);
  });
});

describe('sendOtp axios body', () => {
  it('POSTs phone_number as 63… without +', async () => {
    const axios = require('axios');
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        status: 'success',
        message: 'OTP sent successfully',
        message_id: 'iSms-test',
        data: {
          otp_code: 'SHOULD_NOT_APPEAR_IN_LOGS',
          phone_number: '639281576989',
        },
      },
    });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const prev = process.env.IPROG_API_TOKEN;
    process.env.IPROG_API_TOKEN = 'test-token';
    try {
      const actual = jest.requireActual('../src/services/iprogOtp');
      await actual.sendOtp('+639281576989');
      expect(postSpy).toHaveBeenCalled();
      const body = postSpy.mock.calls[0][1];
      expect(body.phone_number).toBe('639281576989');
      expect(String(body.phone_number)).not.toContain('+');
      const responseLog = logSpy.mock.calls
        .map((args) => args.join(' '))
        .find((line) => line.includes('IPROG send_otp response='));
      expect(responseLog).toBeTruthy();
      expect(responseLog).toContain('iSms-test');
      expect(responseLog).not.toContain('SHOULD_NOT_APPEAR_IN_LOGS');
      expect(responseLog).not.toContain('otp_code');
    } finally {
      process.env.IPROG_API_TOKEN = prev;
      postSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
