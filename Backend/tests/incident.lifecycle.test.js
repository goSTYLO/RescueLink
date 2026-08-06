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
        rows: [{ report_id: 102, status: 'resolved', reporter_confirmed_at: '2026-03-11T10:00:00.000Z' }],
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
});
