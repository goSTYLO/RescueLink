jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const Incident = require('../src/models/incident');

describe('Incident.findAll volunteer_accepted filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({ rows: [] });
  });

  it('adds accepted_by_user_id filter when volunteer_accepted is true', async () => {
    await Incident.findAll({ volunteer_accepted: true, limit: 10, offset: 0 });

    expect(pool.query).toHaveBeenCalled();
    const sql = pool.query.mock.calls[0][0];
    expect(sql).toContain('ir.accepted_by_user_id IS NOT NULL');
  });

  it('selects acceptor name, phone, and pending backup fields', async () => {
    await Incident.findAll({ volunteer_accepted: true, limit: 5, offset: 0 });

    const sql = pool.query.mock.calls[0][0];
    expect(sql).toContain('accepted_by_name');
    expect(sql).toContain('accepted_by_phone');
    expect(sql).toContain('has_pending_backup');
  });
});
