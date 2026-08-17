jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const Incident = require('../src/models/incident');

describe('Incident.findByUserInvolvement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to reported-only incidents for the user', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ report_id: 1, user_id: 5, involvement: 'reported' }],
    });

    const rows = await Incident.findByUserInvolvement(5);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE user_id = $1');
    expect(sql).toContain("THEN 'reported'");
    expect(params[0]).toBe(5);
    expect(rows[0].involvement).toBe('reported');
  });

  it('returns accepted incidents when involvement is accepted', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ report_id: 2, accepted_by_user_id: 7, involvement: 'accepted' }],
    });

    await Incident.findByUserInvolvement(7, { involvement: 'accepted' });

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE accepted_by_user_id = $1');
    expect(sql).not.toContain('OR accepted_by_user_id');
  });

  it('returns both reported and accepted incidents when involvement is all', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { report_id: 3, user_id: 9, involvement: 'reported' },
        { report_id: 4, accepted_by_user_id: 9, involvement: 'accepted' },
        { report_id: 5, user_id: 9, accepted_by_user_id: 9, involvement: 'both' },
      ],
    });

    await Incident.findByUserInvolvement(9, { involvement: 'all' });

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('(user_id = $1 OR accepted_by_user_id = $1)');
    expect(sql).toContain("THEN 'both'");
  });

  it('findByUserId delegates to reported involvement', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await Incident.findByUserId(12);

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE user_id = $1');
  });
});
