/**
 * Volunteer application submit — multipart upload must complete without dropping the connection.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
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

const pool = require('../src/config/db');
const app = require('../src/app');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

let applicantUserId;
let userToken;

beforeAll(async () => {
  const row = await pool.query(
    "SELECT user_id FROM users WHERE role = 'user' ORDER BY user_id LIMIT 1"
  );
  applicantUserId = row.rows[0]?.user_id;
  if (!applicantUserId) {
    throw new Error('No seeded user account for application submit test');
  }
  userToken = jwt.sign({ user_id: applicantUserId, role: ROLES.USER }, JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  try {
    if (app?.locals?.retryTask?.stop) app.locals.retryTask.stop();
    if (app?.locals?.scanRetryTask?.stop) app.locals.scanRetryTask.stop();
    if (applicantUserId) {
      await pool.query('DELETE FROM responder_applications WHERE user_id = $1', [applicantUserId]);
      await fs.rm(
        path.join(process.cwd(), 'uploads', 'responder-applications', String(applicantUserId)),
        { recursive: true, force: true }
      );
    }
  } catch (_) {}
});

describe('POST /api/responder-applications', () => {
  beforeEach(async () => {
    if (!applicantUserId) return;
    await pool.query('DELETE FROM responder_applications WHERE user_id = $1', [applicantUserId]);
    try {
      await fs.rm(
        path.join(process.cwd(), 'uploads', 'responder-applications', String(applicantUserId)),
        { recursive: true, force: true }
      );
    } catch (_) {}
  });

  it('returns 400 when gov_id is missing', async () => {
    const res = await request(app)
      .post('/api/responder-applications')
      .set('Authorization', `Bearer ${userToken}`)
      .field('specialization_fields', JSON.stringify(['medical']))
      .field('personal_details', JSON.stringify({ full_name: 'Test Applicant' }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Government ID/i);
  });

  it('accepts multipart application with gov_id and field proof', async () => {
    const res = await request(app)
      .post('/api/responder-applications')
      .set('Authorization', `Bearer ${userToken}`)
      .field('specialization_fields', JSON.stringify(['medical']))
      .field(
        'personal_details',
        JSON.stringify({
          full_name: 'Test Applicant',
          phone_number: '09171234567',
          email: 'applicant@test.com',
          address: 'Dagupan',
        })
      )
      .attach('gov_id', JPEG, 'gov_id.jpg')
      .attach('proof_medical', JPEG, 'proof_medical.jpg');

    expect(res.status).toBe(201);
    expect(res.body.application).toBeDefined();
    expect(res.body.application.status).toBe('pending');
  });
});
