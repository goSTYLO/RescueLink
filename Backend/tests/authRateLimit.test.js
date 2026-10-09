/**
 * Auth rate limit behavior (express-rate-limit on /api/auth).
 * Env must be set before app load so limits apply in-process.
 */
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_ACCOUNT_MAX = '3';
process.env.AUTH_RATE_LIMIT_GLOBAL_MAX = '100';

const request = require('supertest');
const app = require('../src/app');

describe('auth rate limits', () => {
  test('failed dispatcher login increments limit; 429 after max failures for same email', async () => {
    const email = `ratelimit-${Date.now()}@example.com`;
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/auth/dispatcher/login')
        .send({ email, password: 'WrongPassword1!' });
      expect(res.status).toBe(401);
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    }
    const blocked = await request(app)
      .post('/api/auth/dispatcher/login')
      .send({ email, password: 'WrongPassword1!' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many attempts/i);
  });

  test('logout is not subject to auth credential rate limit', async () => {
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).not.toBe(429);
    }
  });
});
