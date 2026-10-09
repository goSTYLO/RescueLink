jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const Incident = require('../src/models/incident');

describe('incident physical archive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({ rows: [] });
  });

  it('lists live incidents from incident_reports', async () => {
    await Incident.findAll({ limit: 10, offset: 0 });
    expect(pool.query.mock.calls[0][0]).toContain('FROM incident_reports ir');
    expect(pool.query.mock.calls[0][0]).not.toContain('archived_incident_reports');
  });

  it('lists archived incidents from archived_incident_reports', async () => {
    pool.query.mockResolvedValue({ rows: [{ report_id: 5, is_archived: false }] });
    const rows = await Incident.findAll({ is_archived: true, limit: 10, offset: 0 });
    expect(pool.query.mock.calls[0][0]).toContain('FROM archived_incident_reports ir');
    expect(pool.query.mock.calls[0][0]).not.toContain('ir.is_archived');
    expect(rows[0].is_archived).toBe(true);
  });

  it('findById reads the UNION view', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await Incident.findById(7);
    expect(pool.query.mock.calls[0][0]).toContain('FROM incident_bodies ir');
  });

  it('reporter my-reports reads the UNION view', async () => {
    await Incident.findByUserId(3, { limit: 5, offset: 0 });
    expect(pool.query.mock.calls[0][0]).toContain('FROM incident_bodies');
  });

  it('create allocates incident_keys then inserts live row', async () => {
    pool.query.mockResolvedValue({ rows: [{ report_id: 11, status: 'pending', is_archived: false }] });
    await Incident.create({
      user_id: 1,
      severity_level: 'low',
      latitude: 1,
      longitude: 2,
    });
    expect(pool.query.mock.calls[0][0]).toContain('INSERT INTO incident_keys');
    expect(pool.query.mock.calls[0][0]).toContain('INSERT INTO incident_reports');
  });

  it('archive of a non-closed incident returns null', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await Incident.archive(9, { archived_by_user_id: 2 });
    expect(result).toBeNull();
  });

  it('archive of an already-archived id is a no-op', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ report_id: 9, status: 'closed', is_archived: true }],
    });
    const result = await Incident.archive(9, { archived_by_user_id: 2 });
    expect(result.report_id).toBe(9);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toContain('archived_incident_reports');
  });

  it('unarchive of a live id is a no-op', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ report_id: 4 }] });
    const result = await Incident.unarchive(4);
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('archive SQL moves the row into archived_incident_reports', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ report_id: 5, status: 'closed', is_archived: false }],
      })
      .mockResolvedValueOnce({
        rows: [{ report_id: 5, status: 'closed', is_archived: true }],
      });
    const result = await Incident.archive(5, { archived_by_user_id: 2, archive_notes: null });
    expect(result.is_archived).toBe(true);
    const sql = pool.query.mock.calls[1][0];
    expect(sql).toContain('DELETE FROM incident_reports');
    expect(sql).toContain('INSERT INTO archived_incident_reports');
    expect(sql).toContain("status = 'closed'");
    expect(sql).not.toContain('UPDATE incident_reports');
    expect(pool.query.mock.calls[2][0]).toContain('UPDATE archived_incident_reports');
  });

  it('unarchive SQL moves the row back to live', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ report_id: 5, status: 'closed', is_archived: true }] })
      .mockResolvedValueOnce({ rows: [{ report_id: 5, status: 'closed', is_archived: false }] });
    const result = await Incident.unarchive(5);
    expect(result.is_archived).toBe(false);
    expect(pool.query.mock.calls[1][0]).toContain('DELETE FROM archived_incident_reports');
    expect(pool.query.mock.calls[1][0]).toContain('INSERT INTO incident_reports');
  });

  it('create does not insert into the archive table', async () => {
    pool.query.mockResolvedValue({ rows: [{ report_id: 12, status: 'pending', is_archived: false }] });
    await Incident.create({
      user_id: 1,
      severity_level: 'low',
      latitude: 1,
      longitude: 2,
    });
    const sql = pool.query.mock.calls.map((call) => call[0]).join('\n');
    expect(sql).toContain('INSERT INTO incident_keys');
    expect(sql).toContain('INSERT INTO incident_reports');
    expect(sql).not.toContain('INSERT INTO archived_incident_reports');
  });

  it('countAll archived uses the archive table', async () => {
    pool.query.mockResolvedValue({ rows: [{ total: 3 }] });
    await Incident.countAll({ is_archived: true });
    expect(pool.query.mock.calls[0][0]).toContain('FROM archived_incident_reports');
  });
});
