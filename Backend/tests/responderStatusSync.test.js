jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/models/notification', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/services/notificationPersistence', () => ({
  persistIncidentNotifications: jest.fn().mockResolvedValue(undefined),
}));

const pool = require('../src/config/db');
const { updateResponderStatus } = require('../src/controllers/incidentAcceptance');

describe('updateResponderStatus volunteer resolve sync', () => {
  const broadcast = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockReq() {
    return {
      user: { user_id: 7 },
      params: { id: '42' },
      body: { status: 'Resolved' },
      app: { locals: { wss: { broadcast } } },
    };
  }

  it('propagates incident status to resolved and emits incident:status_updated', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ accepted_by_user_id: 7, responder_status: 'On Scene' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 3 }] })
      .mockResolvedValueOnce({
        rows: [{
          report_id: 42,
          user_id: 3,
          status: 'resolved',
          responder_status: 'Resolved',
          incident_type: 'medical',
          severity_level: 'medium',
          barangay: 'Test',
        }],
      });

    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await updateResponderStatus(mockReq(), res);

    const resolveUpdate = pool.query.mock.calls[1][0];
    expect(resolveUpdate).toContain("status = 'resolved'");
    expect(resolveUpdate).toContain('resolved_by_user_id');
    expect(broadcast).toHaveBeenCalledWith(
      'incident:status_updated',
      expect.objectContaining({
        report_id: 42,
        status: 'resolved',
        responder_status: 'Resolved',
      })
    );
    expect(broadcast).toHaveBeenCalledWith(
      'responder:status_changed',
      expect.objectContaining({
        report_id: 42,
        new_status: 'Resolved',
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ new_status: 'Resolved' }));
  });

  it('updates only responder_status for non-resolved transitions', async () => {
    const req = mockReq();
    req.body = { status: 'En Route' };

    pool.query
      .mockResolvedValueOnce({
        rows: [{ accepted_by_user_id: 7, responder_status: 'Assigned' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 3 }] });

    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await updateResponderStatus(req, res);

    const statusUpdate = pool.query.mock.calls[1][0];
    expect(statusUpdate).toContain('UPDATE incident_reports SET responder_status');
    expect(statusUpdate).not.toContain("status = 'resolved'");
    expect(broadcast).not.toHaveBeenCalledWith(
      'incident:status_updated',
      expect.anything()
    );
  });
});
