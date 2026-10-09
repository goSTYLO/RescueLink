/**
 * Live DB checks for the physical archive move. Skips when the schema is not migrated.
 */
const pool = require('../src/config/db');
const Incident = require('../src/models/incident');

async function schemaReady() {
  try {
    await pool.query('SELECT 1 FROM incident_keys LIMIT 0');
    await pool.query('SELECT 1 FROM archived_incident_reports LIMIT 0');
    await pool.query('SELECT 1 FROM roles LIMIT 0');
    return true;
  } catch {
    return false;
  }
}

describe('incident archive move (live db)', () => {
  let ready = false;
  let userId;
  let reportId;

  beforeAll(async () => {
    ready = await schemaReady();
  });

  afterAll(async () => {
    if (!ready) return;
    try {
      if (reportId) await pool.query('DELETE FROM incident_keys WHERE report_id = $1', [reportId]);
      if (userId) await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    } catch (_) { /* cleanup best-effort */ }
  });

  it('moves a closed incident, keeps a child row, and reverses on unarchive', async () => {
    if (!ready) return;
    const user = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password, role, role_id, phone_verified)
       VALUES ('Archive', 'Test', $1, $2, 'x', 'user', 8, TRUE)
       RETURNING user_id`,
      [`archive.move.${Date.now()}@rescuelink.test`, `63900${String(Date.now()).slice(-8)}`]
    );
    userId = user.rows[0].user_id;

    const key = await pool.query('INSERT INTO incident_keys DEFAULT VALUES RETURNING report_id');
    reportId = key.rows[0].report_id;
    await pool.query(
      `INSERT INTO incident_reports (
         report_id, user_id, incident_type, severity_level, description,
         latitude, longitude, status, is_archived
       ) VALUES ($1, $2, 'police', 'low', 'archive-move-check', 16.04, 120.33, 'closed', FALSE)`,
      [reportId, userId]
    );

    await pool.query(
      `INSERT INTO incident_coordination_notes(report_id, user_id, author_name, author_role, department, note)
       VALUES ($1, $2, 'T', 'dispatcher', 'CDRRMO', 'keep-me')`,
      [reportId, userId]
    );

    const before = await pool.query(
      'SELECT report_id, status, is_archived FROM incident_reports WHERE report_id = $1',
      [reportId]
    );
    expect(before.rows[0]).toMatchObject({ status: 'closed' });

    const archived = await Incident.archive(reportId, { archived_by_user_id: userId, archive_notes: null });
    expect(archived).toBeTruthy();
    expect(archived.is_archived).toBe(true);

    const live = await pool.query('SELECT 1 FROM incident_reports WHERE report_id = $1', [reportId]);
    const arch = await pool.query('SELECT 1 FROM archived_incident_reports WHERE report_id = $1', [reportId]);
    expect(live.rows.length).toBe(0);
    expect(arch.rows.length).toBe(1);

    const note = await pool.query(
      'SELECT 1 FROM incident_coordination_notes WHERE report_id = $1',
      [reportId]
    );
    expect(note.rows.length).toBe(1);

    const byId = await Incident.findById(reportId);
    expect(byId).toBeTruthy();
    expect(byId.is_archived).toBe(true);

    const restored = await Incident.unarchive(reportId);
    expect(restored).toBeTruthy();
    expect(restored.is_archived).toBe(false);
    const liveAgain = await pool.query('SELECT 1 FROM incident_reports WHERE report_id = $1', [reportId]);
    expect(liveAgain.rows.length).toBe(1);
  });
});
