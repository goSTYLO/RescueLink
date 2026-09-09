/**
 * Volunteer first-responder role revoke endpoint tests
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/config/jwt');
const { ROLES } = require('../src/config/roles');

jest.mock('../src/services/retryAiClassification', () => ({
  startRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/retryFileScan', () => ({
  startFileScanRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/duplicateBackgroundAnalyzer', () => ({
  startDuplicateAnalyzer: () => null,
}));

jest.mock('../src/models/responderApplication');
jest.mock('../src/models/user');
jest.mock('../src/models/responder');
jest.mock('../src/models/notification');
jest.mock('../src/config/db');
jest.mock('../src/utils/hash');

const ResponderApplication = require('../src/models/responderApplication');
const User = require('../src/models/user');
const Responder = require('../src/models/responder');
const Notification = require('../src/models/notification');
const pool = require('../src/config/db');
const { comparePassword } = require('../src/utils/hash');
const app = require('../src/app');

const createToken = (userId, role) =>
  jwt.sign({ user_id: userId, email: `user${userId}@example.com`, role }, JWT_SECRET, { expiresIn: '7d' });

const adminToken = createToken(3, ROLES.ADMIN);
const dispatcherToken = createToken(2, ROLES.DISPATCHER);

const baseApplication = {
  id: 10,
  user_id: 100,
  status: 'approved',
  notes: 'Previously approved',
};

afterAll(() => {
  try {
    if (app?.locals?.retryTask?.stop) app.locals.retryTask.stop();
    if (app?.locals?.scanRetryTask?.stop) app.locals.scanRetryTask.stop();
  } catch (_) {
    // noop
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  ResponderApplication.findById.mockResolvedValue({ ...baseApplication });
  User.findById.mockImplementation((id) => {
    if (id === 3) {
      return Promise.resolve({ user_id: 3, role: ROLES.ADMIN, password: 'hashed-admin' });
    }
    if (id === 100) {
      return Promise.resolve({ user_id: 100, role: ROLES.VOLUNTEER, password: 'hashed-user' });
    }
    return Promise.resolve(null);
  });
  pool.query.mockImplementation((sql, params) => {
    if (String(sql).includes('incident_reports')) {
      return Promise.resolve({ rows: [] });
    }
    if (String(sql).includes("UPDATE users SET role = 'user'")) {
      return Promise.resolve({ rowCount: 1 });
    }
    return Promise.resolve({ rows: [] });
  });
  comparePassword.mockResolvedValue(true);
  ResponderApplication.revoke.mockResolvedValue({
    ...baseApplication,
    status: 'revoked',
    revoke_reason: 'safety_concern',
    notes: 'Safety concern',
  });
  Responder.deleteByUserId.mockResolvedValue([{ responder_id: 1 }]);
  Notification.create.mockResolvedValue({ notification_id: 1 });
});

describe('POST /api/responder-applications/:id/revoke', () => {
  it('denies non-admin roles', async () => {
    const res = await request(app)
      .post('/api/responder-applications/10/revoke')
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        reason: 'safety_concern',
        admin_password: 'AdminPass123!',
      });

    expect(res.status).toBe(403);
    expect(ResponderApplication.revoke).not.toHaveBeenCalled();
  });

  it('requires admin password', async () => {
    const res = await request(app)
      .post('/api/responder-applications/10/revoke')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'safety_concern' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('rejects invalid reason code', async () => {
    const res = await request(app)
      .post('/api/responder-applications/10/revoke')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'invalid_reason',
        admin_password: 'AdminPass123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid reason/i);
  });

  it('requires reason_other when reason is other', async () => {
    const res = await request(app)
      .post('/api/responder-applications/10/revoke')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'other',
        reason_other: 'short',
        admin_password: 'AdminPass123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason_other/i);
  });

  it('returns 403 for wrong admin password', async () => {
    comparePassword.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/responder-applications/10/revoke')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'safety_concern',
        admin_password: 'WrongPass123!',
      });

    expect(res.status).toBe(403);
    expect(ResponderApplication.revoke).not.toHaveBeenCalled();
  });

  it('blocks revoke when user has active incidents', async () => {
    pool.query.mockImplementation((sql) => {
      if (String(sql).includes('incident_reports')) {
        return Promise.resolve({
          rows: [{ report_id: 55, incident_type: 'fire', responder_status: 'En Route' }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post('/api/responder-applications/10/revoke')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'safety_concern',
        admin_password: 'AdminPass123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.active_incidents).toHaveLength(1);
    expect(ResponderApplication.revoke).not.toHaveBeenCalled();
  });

  it('rejects revoke for non-approved applications', async () => {
    ResponderApplication.findById.mockResolvedValue({ ...baseApplication, status: 'pending' });

    const res = await request(app)
      .post('/api/responder-applications/10/revoke')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'safety_concern',
        admin_password: 'AdminPass123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approved/i);
  });

  it('revokes role successfully for admin with valid password', async () => {
    const res = await request(app)
      .post('/api/responder-applications/10/revoke')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'safety_concern',
        admin_password: 'AdminPass123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/revoked successfully/i);
    expect(ResponderApplication.revoke).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        revoke_reason: 'safety_concern',
        revoked_by: 3,
      })
    );
    expect(Responder.deleteByUserId).toHaveBeenCalledWith(100, 'account');
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 100,
        event_type: 'application_revoked',
      })
    );
  });
});

describe('responderRevokeReasons constants', () => {
  const {
    VALID_REVOKE_REASON_CODES,
    formatRevokeNotes,
    REVOKE_REASONS,
  } = require('../src/constants/responderRevokeReasons');

  it('includes all operational reason codes', () => {
    expect(VALID_REVOKE_REASON_CODES).toEqual(
      expect.arrayContaining([
        'no_longer_qualified',
        'repeated_no_shows',
        'safety_concern',
        'user_requested_removal',
        'other',
      ])
    );
  });

  it('formats other reason with details', () => {
    expect(formatRevokeNotes(REVOKE_REASONS.OTHER, 'Detailed explanation here')).toBe(
      'Other: Detailed explanation here'
    );
  });
});
