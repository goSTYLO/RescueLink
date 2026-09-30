jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/config/roles', () => ({
  ROLES: {
    USER: 'user',
    DISPATCHER: 'dispatcher',
    ADMIN: 'admin',
    DEPARTMENT_ADMIN: 'department_admin',
  },
}));

const pool = require('../src/config/db');
const Incident = require('../src/models/incident');

describe('incident lifecycle model transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects resolved -> closed when reporter confirmation is missing', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ report_id: 101, status: 'resolved', reporter_confirmed_at: null }],
    });

    await expect(
      Incident.transitionStatus(101, {
        next_status: 'closed',
        actor_user_id: 7,
        actor_role: 'dispatcher',
      })
    ).rejects.toMatchObject({
      code: 'INCIDENT_CLOSE_CONFIRMATION_REQUIRED',
      httpStatus: 400,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('allows resolved -> closed when reporter confirmation exists', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ report_id: 102, status: 'resolved', reporter_confirmed_at: '2026-03-11T10:00:00.000Z', responder_status: null }],
      })
      .mockResolvedValueOnce({
        rows: [{ report_id: 102, status: 'closed', closed_at: '2026-03-11T10:01:00.000Z' }],
      });

    const updated = await Incident.transitionStatus(102, {
      next_status: 'closed',
      actor_user_id: 7,
      actor_role: 'dispatcher',
    });

    expect(updated.status).toBe('closed');
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('allows force-close from resolved without reporter confirmation', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ report_id: 105, status: 'resolved', reporter_confirmed_at: null, responder_status: null }],
      })
      .mockResolvedValueOnce({
        rows: [{ report_id: 105, status: 'closed', closure_method: 'Successful Response' }],
      });

    const updated = await Incident.transitionStatus(105, {
      next_status: 'closed',
      actor_user_id: 1,
      actor_role: 'dispatcher',
      allow_force_close: true,
      closure_method: 'Successful Response',
      closure_notes: 'Handled on scene.',
    });

    expect(updated.status).toBe('closed');
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('allows force-close when volunteer is Resolved but lifecycle status is desynced', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ report_id: 106, status: 'in_progress', reporter_confirmed_at: null, responder_status: 'Resolved' }],
      })
      .mockResolvedValueOnce({
        rows: [{ report_id: 106, status: 'closed', responder_status: 'Resolved' }],
      });

    const updated = await Incident.transitionStatus(106, {
      next_status: 'closed',
      actor_user_id: 1,
      actor_role: 'dispatcher',
      allow_force_close: true,
    });

    expect(updated.status).toBe('closed');
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('auto-closes on reporter confirmation from resolved', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ report_id: 103, user_id: 19, status: 'resolved', reporter_confirmed_at: null }],
      })
      .mockResolvedValueOnce({
        rows: [{
          report_id: 103,
          status: 'closed',
          reporter_confirmed_at: '2026-03-11T10:30:00.000Z',
          reporter_confirmed_by_user_id: 19,
          closed_at: '2026-03-11T10:30:00.000Z',
          closure_method: 'auto_from_reporter_confirmation',
        }],
      });

    const updated = await Incident.confirmResolution(103, 19);

    expect(updated.status).toBe('closed');
    expect(updated.closure_method).toBe('auto_from_reporter_confirmation');
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('returns existing incident when confirmation already happened and status is closed', async () => {
    const existing = {
      report_id: 104,
      user_id: 19,
      status: 'closed',
      reporter_confirmed_at: '2026-03-11T10:00:00.000Z',
    };
    pool.query.mockResolvedValueOnce({ rows: [existing] });

    const updated = await Incident.confirmResolution(104, 19);

    expect(updated).toEqual(existing);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('allows pending -> in_progress when a team is auto-assigned', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ report_id: 108, status: 'pending', reporter_confirmed_at: null, responder_status: null }],
      })
      .mockResolvedValueOnce({
        rows: [{ report_id: 108, status: 'in_progress' }],
      });

    const updated = await Incident.transitionStatus(108, {
      next_status: 'in_progress',
      actor_user_id: 1,
      actor_role: 'system',
    });

    expect(updated.status).toBe('in_progress');
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('persists closure notes on in_progress -> resolved', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ report_id: 109, status: 'in_progress', reporter_confirmed_at: null, responder_status: null }],
      })
      .mockResolvedValueOnce({
        rows: [{ report_id: 109, status: 'resolved', closure_method: 'Successful Response', closure_notes: 'Handled on scene.' }],
      });

    const updated = await Incident.transitionStatus(109, {
      next_status: 'resolved',
      actor_user_id: 25,
      actor_role: 'department_admin',
      closure_method: 'Successful Response',
      closure_notes: 'Handled on scene.',
    });

    expect(updated.status).toBe('resolved');
    expect(pool.query.mock.calls[1][1][4]).toBe('Successful Response');
    expect(pool.query.mock.calls[1][1][5]).toBe('Handled on scene.');
  });

  it('keeps resolve-time closure_method when reporter confirms', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ report_id: 110, user_id: 19, status: 'resolved', reporter_confirmed_at: null }],
      })
      .mockResolvedValueOnce({
        rows: [{
          report_id: 110,
          status: 'closed',
          reporter_confirmed_at: '2026-03-11T10:30:00.000Z',
          closure_method: 'Successful Response',
        }],
      });

    const updated = await Incident.confirmResolution(110, 19);

    expect(updated.closure_method).toBe('Successful Response');
    expect(pool.query.mock.calls[1][0]).toMatch(/COALESCE\(closure_method, 'auto_from_reporter_confirmation'\)/);
  });

  function mockOpenReport(reportId, status, responderStatus = 'En Route') {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          report_id: reportId,
          user_id: 19,
          status,
          responder_status: responderStatus,
          description: 'smoke',
          latitude: 16.04,
          longitude: 120.33,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
  }

  it('cancels a pending report that is only en route', async () => {
    mockOpenReport(201, 'pending', 'En Route');
    pool.query.mockResolvedValueOnce({
      rows: [{ report_id: 201, status: 'cancelled', closure_method: 'reporter_cancelled' }],
    });

    const updated = await Incident.cancelByReporter(201, 19);

    expect(updated.status).toBe('cancelled');
    expect(pool.query.mock.calls[3][0]).toMatch(/reporter_cancelled/);
  });

  it('rejects cancel when the caller is not the owner', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ report_id: 202, user_id: 19, status: 'pending', responder_status: null }],
    });

    await expect(Incident.cancelByReporter(202, 8)).rejects.toMatchObject({
      code: 'INCIDENT_REVISE_OWNERSHIP',
      httpStatus: 403,
    });
  });

  it('rejects cancel once the report is resolved', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ report_id: 203, user_id: 19, status: 'resolved', responder_status: null }],
    });

    await expect(Incident.cancelByReporter(203, 19)).rejects.toMatchObject({
      code: 'INCIDENT_REVISE_INVALID_STATUS',
      httpStatus: 409,
    });
  });

  it('rejects cancel when a responder is on scene', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ report_id: 204, user_id: 19, status: 'in_progress', responder_status: 'On Scene' }],
    });

    await expect(Incident.cancelByReporter(204, 19)).rejects.toMatchObject({
      code: 'INCIDENT_REVISE_ON_SCENE',
      httpStatus: 409,
    });
  });

  it('updates description and pin while the team is still en route', async () => {
    mockOpenReport(205, 'in_progress', 'En Route');
    pool.query.mockResolvedValueOnce({
      rows: [{
        report_id: 205,
        status: 'in_progress',
        description: 'updated',
        latitude: 16.05,
        longitude: 120.34,
        barangay: 'Pogo Chico',
      }],
    });

    const updated = await Incident.updateDetailsByReporter(205, 19, {
      description: 'updated',
      latitude: 16.05,
      longitude: 120.34,
      barangay: 'Pogo Chico',
    });

    expect(updated.barangay).toBe('Pogo Chico');
    expect(updated.latitude).toBe(16.05);
    expect(pool.query.mock.calls[3][1][2]).toBe(16.05);
    expect(pool.query.mock.calls[3][1][3]).toBe(120.34);
  });

  it('rejects a detail edit when a dispatch is already on scene', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ report_id: 206, user_id: 19, status: 'in_progress', responder_status: 'En Route' }],
      })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    await expect(Incident.updateDetailsByReporter(206, 19, {
      description: 'too late',
      latitude: 16.05,
      longitude: 120.34,
      barangay: 'Pogo Chico',
    })).rejects.toMatchObject({
      code: 'INCIDENT_REVISE_ON_SCENE',
      httpStatus: 409,
    });
  });
});
