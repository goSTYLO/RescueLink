jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const Incident = require('../src/models/incident');
const { encrypt } = require('../src/utils/encryption');

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

  it('decrypts volunteer acceptor name from first/last columns (not SQL concat)', async () => {
    const encFirst = encrypt('Alyssa');
    const encLast = encrypt('Reyes');
    pool.query.mockResolvedValue({
      rows: [{
        report_id: 99,
        user_id: 1,
        incident_type: 'medical',
        severity_level: 'medium',
        status: 'resolved',
        created_at: new Date().toISOString(),
        accepted_by_user_id: 2,
        reporter_first_name: encFirst,
        reporter_last_name: encLast,
        accepted_by_first_name: encFirst,
        accepted_by_last_name: encLast,
        accepted_by_name: `${encFirst} ${encLast}`,
        has_pending_backup: false,
        is_archived: false,
      }],
    });

    const rows = await Incident.findAll({ volunteer_accepted: true, limit: 1, offset: 0 });
    expect(rows[0].accepted_by_name).toBe('Alyssa Reyes');
    expect(rows[0].accepted_by_name).not.toMatch(/^[0-9a-f]{32,}/i);
  });
});
