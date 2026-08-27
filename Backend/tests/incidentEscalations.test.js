/**
 * Incident Escalation — Unit Tests
 *
 * Tests RBAC enforcement, validation, and state transitions for escalation
 * endpoints without hitting the real database (all DB ops are mocked).
 */

const { createEscalation, listEscalations, updateEscalationStatus } = require('../src/controllers/incidentEscalation');

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../src/models/incidentEscalation', () => ({
  ensureSchema: jest.fn().mockResolvedValue(undefined),
  create: jest.fn(),
  findByReportId: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  getActiveDepartmentIds: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/models/incidentCoordinationNote', () => ({
  create: jest.fn().mockResolvedValue({ id: 99 }),
}));

jest.mock('../src/models/user', () => ({
  findById: jest.fn().mockResolvedValue({
    user_id: 1,
    first_name: 'Test',
    last_name: 'User',
    department_id: 2,
  }),
}));

jest.mock('../src/models/department', () => ({
  findById: jest.fn().mockResolvedValue({ department_id: 3, name: 'BFP', code: 'bfp' }),
}));

jest.mock('../src/config/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ report_id: 1, status: 'pending', incident_type: 'fire' }] }),
}));

jest.mock('../src/utils/incidentEvents', () => ({
  emitIncidentEvent: jest.fn(),
  buildIncidentEventPayload: jest.fn((i) => i),
}));

jest.mock('../src/utils/auditLog', () => ({
  logDispatcherAction: jest.fn().mockResolvedValue(undefined),
}));

const IncidentEscalation = require('../src/models/incidentEscalation');
const User = require('../src/models/user');
const Department = require('../src/models/department');
const pool = require('../src/config/db');

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    user: { user_id: 1, role: 'department-admin' },
    params: { id: '1' },
    body: {},
    app: { locals: {} },
    ...overrides,
  };
}

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

// ── createEscalation ───────────────────────────────────────────────────────────

describe('createEscalation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({ rows: [{ report_id: 1, status: 'pending', incident_type: 'fire' }] });
    IncidentEscalation.create.mockResolvedValue({ id: 10, report_id: 1, to_department_id: 3, urgency: 'high', status: 'pending' });
    Department.findById.mockResolvedValue({ department_id: 3, name: 'BFP', code: 'bfp' });
    User.findById.mockResolvedValue({ user_id: 1, first_name: 'Test', last_name: 'Admin', department_id: 2 });
  });

  test('allows department-admin to create escalation', async () => {
    const req = makeReq({
      body: { to_department_id: 3, justification_notes: 'Water tankers needed urgently', urgency: 'high' },
    });
    const res = makeRes();

    await createEscalation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ escalation: expect.any(Object) }));
  });

  test('allows super-admin to create escalation', async () => {
    const req = makeReq({
      user: { user_id: 1, role: 'super-admin' },
      body: { to_department_id: 3, justification_notes: 'Additional units required', urgency: 'critical' },
    });
    const res = makeRes();

    await createEscalation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('denies citizen (user role) from creating escalation', async () => {
    const req = makeReq({
      user: { user_id: 5, role: 'user' },
      body: { to_department_id: 3, justification_notes: 'Please help' },
    });
    const res = makeRes();

    await createEscalation(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('denies responder from creating escalation', async () => {
    const req = makeReq({
      user: { user_id: 5, role: 'responder' },
      body: { to_department_id: 3, justification_notes: 'Please help me' },
    });
    const res = makeRes();

    await createEscalation(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 400 when justification_notes is too short', async () => {
    const req = makeReq({
      body: { to_department_id: 3, justification_notes: 'Hi' },
    });
    const res = makeRes();

    await createEscalation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when urgency is invalid', async () => {
    const req = makeReq({
      body: { to_department_id: 3, justification_notes: 'Water tankers needed here', urgency: 'extreme' },
    });
    const res = makeRes();

    await createEscalation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when incident does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // incident not found
    const req = makeReq({
      params: { id: '9999' },
      body: { to_department_id: 3, justification_notes: 'Water tankers needed urgently', urgency: 'high' },
    });
    const res = makeRes();

    await createEscalation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 404 when target department does not exist', async () => {
    Department.findById.mockResolvedValueOnce(null);
    const req = makeReq({
      body: { to_department_id: 999, justification_notes: 'Water tankers needed urgently', urgency: 'high' },
    });
    const res = makeRes();

    await createEscalation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 422 when user escalates to own department', async () => {
    // User dept_id = 2; target dept = 2
    User.findById.mockResolvedValueOnce({ user_id: 1, department_id: 2 });
    Department.findById.mockResolvedValueOnce({ department_id: 2, name: 'CDRRMO', code: 'cdrmo' });
    const req = makeReq({
      body: { to_department_id: 2, justification_notes: 'Water tankers needed urgently', urgency: 'medium' },
    });
    const res = makeRes();

    await createEscalation(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
  });
});

// ── listEscalations ────────────────────────────────────────────────────────────

describe('listEscalations', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns escalation list for department-admin', async () => {
    IncidentEscalation.findByReportId.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    const req = makeReq();
    const res = makeRes();

    await listEscalations(req, res);

    expect(res.json).toHaveBeenCalledWith({ escalations: expect.arrayContaining([{ id: 1 }]) });
  });

  test('denies citizen from listing escalations', async () => {
    const req = makeReq({ user: { user_id: 5, role: 'user' } });
    const res = makeRes();

    await listEscalations(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ── updateEscalationStatus ─────────────────────────────────────────────────────

describe('updateEscalationStatus', () => {
  const existingEscalation = {
    id: 10,
    report_id: 1,
    from_department_id: 2,
    to_department_id: 3,
    to_department_name: 'BFP',
    urgency: 'high',
    status: 'pending',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    IncidentEscalation.findById.mockResolvedValue(existingEscalation);
    IncidentEscalation.updateStatus.mockResolvedValue({ ...existingEscalation, status: 'accepted' });
    User.findById.mockResolvedValue({ user_id: 2, first_name: 'Dept', last_name: 'Admin', department_id: 3 });
    Department.findById.mockResolvedValue({ department_id: 3, name: 'BFP' });
    pool.query.mockResolvedValue({ rows: [{ report_id: 1, status: 'in_progress', incident_type: 'fire' }] });
  });

  test('allows target dept admin to accept escalation', async () => {
    const req = makeReq({
      user: { user_id: 2, role: 'department-admin' },
      params: { id: '1', escalationId: '10' },
      body: { status: 'accepted', response_notes: 'On our way' },
    });
    const res = makeRes();

    await updateEscalationStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ escalation: expect.any(Object) }));
  });

  test('allows super-admin to decline escalation', async () => {
    const req = makeReq({
      user: { user_id: 1, role: 'super-admin' },
      params: { id: '1', escalationId: '10' },
      body: { status: 'declined', response_notes: 'Unit unavailable' },
    });
    const res = makeRes();

    await updateEscalationStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ escalation: expect.any(Object) }));
  });

  test('denies non-target dept admin from accepting', async () => {
    // User dept = 99, target dept = 3 — should be denied
    User.findById.mockResolvedValueOnce({ user_id: 5, department_id: 99 });
    const req = makeReq({
      user: { user_id: 5, role: 'department-admin' },
      params: { id: '1', escalationId: '10' },
      body: { status: 'accepted' },
    });
    const res = makeRes();

    await updateEscalationStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 409 when escalation already resolved', async () => {
    IncidentEscalation.findById.mockResolvedValueOnce({ ...existingEscalation, status: 'resolved' });
    const req = makeReq({
      user: { user_id: 1, role: 'super-admin' },
      params: { id: '1', escalationId: '10' },
      body: { status: 'accepted' },
    });
    const res = makeRes();

    await updateEscalationStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('returns 400 for invalid status', async () => {
    const req = makeReq({
      user: { user_id: 1, role: 'super-admin' },
      params: { id: '1', escalationId: '10' },
      body: { status: 'exploded' },
    });
    const res = makeRes();

    await updateEscalationStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('denies citizen from updating escalation status', async () => {
    const req = makeReq({
      user: { user_id: 5, role: 'user' },
      params: { id: '1', escalationId: '10' },
      body: { status: 'accepted' },
    });
    const res = makeRes();

    await updateEscalationStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
