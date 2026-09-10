/**
 * Auth middleware rejects JWTs whose user_id no longer exists (e.g. after DB re-seed).
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/config/jwt');

jest.mock('../src/services/retryAiClassification', () => ({
  startRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/retryFileScan', () => ({
  startFileScanRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/duplicateBackgroundAnalyzer', () => ({
  startDuplicateAnalyzer: () => null,
}));

const app = require('../src/app');

afterAll(() => {
  try {
    if (app?.locals?.retryTask?.stop) app.locals.retryTask.stop();
    if (app?.locals?.scanRetryTask?.stop) app.locals.scanRetryTask.stop();
  } catch (_) {}
});

describe('auth middleware live account check', () => {
  it('returns 401 when JWT user_id is not in users table', async () => {
    const token = jwt.sign({ user_id: 999999, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .get('/api/incidents/user/my')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/sign in again/i);
  });
});
