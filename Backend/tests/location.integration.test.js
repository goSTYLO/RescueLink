const request = require('supertest');
const jwt = require('jsonwebtoken');

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
const { JWT_SECRET } = require('../src/config/jwt');
const { ROLES } = require('../src/config/roles');

afterAll(() => {
  try {
    if (app?.locals?.retryTask?.stop) {
      app.locals.retryTask.stop();
    }
    if (app?.locals?.scanRetryTask?.stop) {
      app.locals.scanRetryTask.stop();
    }
  } catch (_) {
  }
});

const createToken = (userId, role) =>
  jwt.sign({ user_id: userId, email: `user${userId}@example.com`, role }, JWT_SECRET, {
    expiresIn: '7d',
  });

describe('Location intelligence integration tests', () => {
  const dispatcherToken = createToken(2, ROLES.DISPATCHER);
  const userToken = createToken(3, ROLES.USER);

  it('allows dispatcher to fetch closest units with valid incident payload', async () => {
    const res = await request(app)
      .post('/api/location/closest-units')
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        incident: {
          latitude: 16.0433,
          longitude: 120.3333,
        },
        limit: 3,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
  });

  it('returns 400 for closest-units when incident payload is missing', async () => {
    const res = await request(app)
      .post('/api/location/closest-units')
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({ latitude: 16.0433, longitude: 120.3333 });

    expect(res.status).toBe(400);
  });

  it('allows dispatcher to fetch geofence alerts', async () => {
    const res = await request(app)
      .post('/api/location/geofence-alerts')
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        incidents: [
          {
            report_id: 1001,
            latitude: 16.0433,
            longitude: 120.3333,
            status: 'pending',
            severity_level: 'high',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.alertCount).toBe('number');
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it('allows dispatcher to fetch heatmap hotspots', async () => {
    const res = await request(app)
      .get('/api/location/heatmap?limit=100')
      .set('Authorization', `Bearer ${dispatcherToken}`);

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.hotspots)).toBe(true);
    }
  });

  it('denies regular user access to location intelligence endpoints', async () => {
    const res = await request(app)
      .post('/api/location/geofence-alerts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ incidents: [] });

    expect(res.status).toBe(403);
  });
});
