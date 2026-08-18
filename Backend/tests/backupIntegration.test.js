jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/models/notification', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/utils/auditLog', () => ({
  logDispatcherAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/models/user', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/models/department', () => ({
  findById: jest.fn(),
}));

const pool = require('../src/config/db');
const Notification = require('../src/models/notification');
const {
  requestBackup,
  acknowledgeBackupRequest,
  joinBackup,
} = require('../src/controllers/incidentAcceptance');

describe('backup request integration', () => {
  const broadcast = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockReq(role = 'dispatcher', userId = 9) {
    return {
      user: { user_id: userId, role },
      params: { id: '42', backupId: '7' },
      body: { target: 'cdrrmo', notes: 'Need units' },
      app: { locals: { wss: { broadcast } } },
    };
  }

  it('requestBackup notifies staff and emits enriched websocket payload', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          accepted_by_user_id: 9,
          latitude: 16.04,
          longitude: 120.33,
          incident_type: 'medical',
          barangay: 'Bonuan',
          severity_level: 'high',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 7, created_at: new Date().toISOString() }] })
      .mockResolvedValueOnce({ rows: [{ full_name: 'Volunteer One' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 1 }, { user_id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 3 }] });

    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await requestBackup(mockReq('responder', 9), res);

    expect(Notification.create).toHaveBeenCalled();
    expect(broadcast).toHaveBeenCalledWith(
      'responder:backup_requested',
      expect.objectContaining({
        report_id: 42,
        backup_request_id: 7,
        target: 'cdrrmo',
        requested_by_name: 'Volunteer One',
        incident_type: 'medical',
        severity_level: 'high',
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('requestBackup with nearby_responders emits responder:backup_alert', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          accepted_by_user_id: 9,
          latitude: 16.04,
          longitude: 120.33,
          incident_type: 'medical',
          barangay: 'Bonuan',
          severity_level: 'high',
          status: 'in_progress',
          responder_status: 'On Scene',
          user_id: 1,
          description: 'Need help',
          created_at: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 7, created_at: new Date().toISOString() }] })
      .mockResolvedValueOnce({ rows: [{ full_name: 'Volunteer One' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 1 }, { user_id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 3 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          user_id: 20,
          latitude: 16.041,
          longitude: 120.331,
          supported_incident_types: ['medical'],
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq('responder', 9);
    req.body = { target: 'nearby_responders', notes: 'Need backup' };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await requestBackup(req, res);

    expect(broadcast).toHaveBeenCalledWith(
      'responder:backup_alert',
      expect.objectContaining({
        report_id: 42,
        backup_request_id: 7,
        is_backup: true,
        requested_by_name: 'Volunteer One',
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ broadcast_count: expect.any(Number) }));
  });

  it('joinBackup returns 201 for eligible volunteer', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          report_id: 42,
          status: 'pending',
          accepted_by_user_id: 9,
          latitude: 16.04,
          longitude: 120.33,
          incident_type: 'medical',
          incident_status: 'in_progress',
          responder_status: 'On Scene',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ responder_online: true }] })
      .mockResolvedValueOnce({ rows: [{ latitude: 16.04, longitude: 120.33 }] })
      .mockResolvedValueOnce({ rows: [{ supported_incident_types: ['medical'] }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 11, responder_status: 'Assigned', created_at: new Date().toISOString() }],
      })
      .mockResolvedValueOnce({ rows: [{ full_name: 'Backup Helper' }] });

    const req = mockReq('responder', 20);
    req.params = { id: '42', backupId: '7' };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await joinBackup(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(broadcast).toHaveBeenCalledWith(
      'responder:backup_joined',
      expect.objectContaining({
        report_id: 42,
        backup_request_id: 7,
        backup_user_id: 20,
      })
    );
  });

  it('joinBackup returns 403 when primary tries to join', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          report_id: 42,
          status: 'pending',
          accepted_by_user_id: 9,
          latitude: 16.04,
          longitude: 120.33,
          incident_type: 'medical',
          incident_status: 'in_progress',
          responder_status: 'On Scene',
        }],
      });

    const req = mockReq('responder', 9);
    req.params = { id: '42', backupId: '7' };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await joinBackup(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('acknowledgeBackupRequest updates status and emits responder:backup_acknowledged', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 7, report_id: 42, status: 'pending' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await acknowledgeBackupRequest(mockReq('dispatcher', 1), res);

    expect(broadcast).toHaveBeenCalledWith(
      'responder:backup_acknowledged',
      expect.objectContaining({
        report_id: 42,
        backup_request_id: 7,
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'acknowledged' }));
  });
});
