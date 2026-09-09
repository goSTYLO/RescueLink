const bcryptjs = require('bcryptjs');
const request = require('supertest');
const { normalizePhoneDigits, validatePhone } = require('../src/utils/validation');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/services/retryAiClassification', () => ({
  startRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/retryFileScan', () => ({
  startFileScanRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/duplicateBackgroundAnalyzer', () => ({
  startDuplicateAnalyzer: () => null,
}));

const pool = require('../src/config/db');
const User = require('../src/models/user');
const app = require('../src/app');

afterAll(() => {
  try {
    if (app?.locals?.retryTask?.stop) app.locals.retryTask.stop();
    if (app?.locals?.scanRetryTask?.stop) app.locals.scanRetryTask.stop();
  } catch (_) {
    // noop
  }
});

describe('normalizePhoneDigits', () => {
  it('treats 639, +639, and 09 local formats as the same digits', () => {
    expect(normalizePhoneDigits('639003000003')).toBe('639003000003');
    expect(normalizePhoneDigits('+639003000003')).toBe('639003000003');
    expect(normalizePhoneDigits('09003000003')).toBe('639003000003');
  });

  it('validatePhone returns local 09XXXXXXXXX format for storage', () => {
    expect(validatePhone('09003000003')).toBe('09003000003');
    expect(validatePhone('+639003000003')).toBe('09003000003');
    expect(validatePhone('639003000003')).toBe('09003000003');
  });
});

describe('User.findByPhone', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it('matches stored phone without + when login uses E.164', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          user_id: 42,
          email: 'responder3@rescuelink.test',
          phone_number: '639003000003',
          password: 'hash',
          phone_verified: true,
          first_name: 'Rescuer',
          last_name: 'Ramos',
          role: 'responder',
          department_id: 2,
          address: null,
          created_at: new Date(),
        }],
      });

    const user = await User.findByPhone('+639003000003');
    expect(user).not.toBeNull();
    expect(user.user_id).toBe(42);
  });
});

describe('POST /api/auth/login phone formats', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it('accepts local 09 format for seeded-style phone', async () => {
    const passwordHash = await bcryptjs.hash('responder123', 10);
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          user_id: 99,
          email: 'responder3@rescuelink.test',
          phone_number: '+639003000003',
          password: passwordHash,
          phone_verified: true,
          first_name: 'Rescuer',
          last_name: 'Ramos',
          role: 'responder',
          department_id: 2,
          address: null,
          created_at: new Date(),
        }],
      });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '09003000003', password: 'responder123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('responder');
  });
});
