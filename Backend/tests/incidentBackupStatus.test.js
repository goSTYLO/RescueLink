jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/models/dispatch', () => ({
  findAll: jest.fn().mockResolvedValue([]),
  findByReportAndUser: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/models/user', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/models/department', () => ({
  findById: jest.fn(),
  findByCode: jest.fn(),
}));

jest.mock('../src/utils/ownership', () => ({
  isResourceOwner: jest.fn(() => false),
  getOwnershipFilter: jest.fn(() => ({})),
}));

jest.mock('../src/services/duplicateDetectionService', () => ({
  getDuplicateInfo: jest.fn().mockResolvedValue(null),
}));

const pool = require('../src/config/db');
const Incident = require('../src/models/incident');
const { isResourceOwner } = require('../src/utils/ownership');
const incidentController = require('../src/controllers/incident');

describe('incident backup status fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findById selects and returns latest_backup_status', async () => {
    pool.query.mockResolvedValue({
      rows: [{
        report_id: 42,
        user_id: 1,
        has_pending_backup: false,
        pending_backup_request_id: null,
        latest_backup_status: 'acknowledged',
        has_open_backup_request: true,
        active_backup_request_id: 7,
        open_backup_status: 'acknowledged',
      }],
    });

    const result = await Incident.findById(42);

    const sql = pool.query.mock.calls[0][0];
    expect(sql).toContain('latest_backup_status');
    expect(sql).toContain('has_open_backup_request');
    expect(sql).toContain('active_backup_request_id');
    expect(result.latest_backup_status).toBe('acknowledged');
    expect(result.has_pending_backup).toBe(false);
    expect(result.has_open_backup_request).toBe(true);
    expect(result.active_backup_request_id).toBe(7);
    expect(result.open_backup_status).toBe('acknowledged');
  });

  it('findAll selects latest_backup_status for list payloads', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await Incident.findAll({ limit: 10, offset: 0 });

    const sql = pool.query.mock.calls[0][0];
    expect(sql).toContain('latest_backup_status');
  });
});

describe('incidentController.getById acceptor access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isResourceOwner.mockReturnValue(false);
    pool.query.mockResolvedValue({ rows: [] });
    const Dispatch = require('../src/models/dispatch');
    Dispatch.findByReportAndUser.mockResolvedValue(null);
    Dispatch.findAll.mockResolvedValue([]);
  });

  it('allows responder who accepted the incident to read by id', async () => {
    Incident.findById = jest.fn().mockResolvedValue({
      report_id: 42,
      user_id: 1,
      accepted_by_user_id: 9,
      status: 'in_progress',
    });

    const req = {
      params: { id: '42' },
      user: { user_id: 9, role: 'volunteer' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await incidentController.getById(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        report_id: 42,
        accepted_by_user_id: 9,
      })
    );
  });

  it('denies responder who did not accept the incident', async () => {
    Incident.findById = jest.fn().mockResolvedValue({
      report_id: 42,
      user_id: 1,
      accepted_by_user_id: 8,
      status: 'in_progress',
    });

    const req = {
      params: { id: '42' },
      user: { user_id: 9, role: 'volunteer' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await incidentController.getById(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden. You can only access your own incidents.',
    });
  });

  it('allows field responder assigned on a dispatch to read by id', async () => {
    const Dispatch = require('../src/models/dispatch');
    Incident.findById = jest.fn().mockResolvedValue({
      report_id: 55,
      user_id: 1,
      accepted_by_user_id: null,
      status: 'in_progress',
    });
    Dispatch.findByReportAndUser.mockResolvedValue({ dispatch_id: 9, report_id: 55 });

    const req = { params: { id: '55' }, user: { user_id: 31, role: 'responder' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await incidentController.getById(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
  });

  it('allows field responder to read a dept-notified incident with no personal dispatch', async () => {
    const Dispatch = require('../src/models/dispatch');
    const User = require('../src/models/user');
    const Department = require('../src/models/department');
    Incident.findById = jest.fn().mockResolvedValue({
      report_id: 56,
      user_id: 1,
      accepted_by_user_id: null,
      status: 'verified',
    });
    Dispatch.findByReportAndUser.mockResolvedValue(null);
    User.findById.mockResolvedValue({ user_id: 31, department_id: 2 });
    Department.findById.mockResolvedValue({ department_id: 2, code: 'drrmo' });
    Dispatch.findAll.mockResolvedValue([{ dispatch_id: 1, department_code: 'drrmo' }]);

    const req = { params: { id: '56' }, user: { user_id: 31, role: 'responder' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await incidentController.getById(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
  });
});
