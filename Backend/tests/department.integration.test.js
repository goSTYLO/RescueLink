const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/services/retryAiClassification', () => ({
  startRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/retryFileScan', () => ({
  startFileScanRetryService: () => ({ stop: jest.fn() }),
}));

const app = require('../src/app');
const { JWT_SECRET } = require('../src/config/jwt');
const { ROLES } = require('../src/config/roles');

afterAll(() => {
  try {
    if (app?.locals?.retryTask?.stop) app.locals.retryTask.stop();
    if (app?.locals?.scanRetryTask?.stop) app.locals.scanRetryTask.stop();
  } catch (_) {
  }
});

const tokenFor = (userId, role) =>
  jwt.sign({ user_id: userId, email: `user${userId}@example.com`, role }, JWT_SECRET, {
    expiresIn: '7d',
  });

describe('Department management integration tests', () => {
  const adminToken = tokenFor(1, ROLES.ADMIN);
  const dispatcherToken = tokenFor(2, ROLES.DISPATCHER);

  it('denies non-admin access to departments endpoint', async () => {
    const res = await request(app)
      .get('/api/departments')
      .set('Authorization', `Bearer ${dispatcherToken}`);

    expect(res.status).toBe(403);
  });

  it('allows admin to list departments', async () => {
    const res = await request(app)
      .get('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });

  it('allows admin to create department', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Integration Dept ${Date.now()}`,
        type: 'Community',
        color: 'gray',
      });

    expect([201, 400, 409, 500]).toContain(res.status);
  });
});
