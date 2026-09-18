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
});
