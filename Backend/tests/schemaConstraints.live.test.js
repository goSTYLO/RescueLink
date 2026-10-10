/**
 * Live DB checks for schema-audit constraints and RLS backstop. Skips when schema is not migrated.
 */
const pool = require('../src/config/db');
const Dispatch = require('../src/models/dispatch');
const Responder = require('../src/models/responder');

async function schemaReady() {
  try {
    await pool.query('SELECT 1 FROM incident_keys LIMIT 0');
    await pool.query('SELECT 1 FROM departments LIMIT 0');
    return true;
  } catch {
    return false;
  }
}

describe('schema audit constraints (live db)', () => {
  let ready = false;
  let userId;
  let responderId;
  let teamId;
  let dispatchId;
  let reportId;
  let deptCode;

  beforeAll(async () => {
    ready = await schemaReady();
    if (!ready) return;
    const dept = await pool.query('SELECT code FROM departments ORDER BY department_id LIMIT 1');
    deptCode = dept.rows[0]?.code;
  });

  afterAll(async () => {
    if (!ready) return;
    try {
      if (dispatchId) await pool.query('DELETE FROM dispatches WHERE dispatch_id = $1', [dispatchId]);
      if (reportId) await pool.query('DELETE FROM incident_keys WHERE report_id = $1', [reportId]);
      if (teamId) await pool.query('DELETE FROM responder_teams WHERE team_id = $1', [teamId]);
      if (responderId) await pool.query('DELETE FROM responders WHERE responder_id = $1', [responderId]);
      if (userId) await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    } catch (_) { /* cleanup best-effort */ }
  });

  it('still reads core tables after index dedupe', async () => {
    if (!ready) return;
    const counts = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM incident_reports) AS incidents,
         (SELECT count(*)::int FROM dispatches) AS dispatches,
         (SELECT count(*)::int FROM notifications) AS notifications`
    );
    expect(counts.rows[0].incidents).toBeGreaterThanOrEqual(0);
    expect(counts.rows[0].dispatches).toBeGreaterThanOrEqual(0);
    expect(counts.rows[0].notifications).toBeGreaterThanOrEqual(0);
  });

  it('backend pool reads and inserts users with RLS enabled', async () => {
    if (!ready) return;
    await pool.query('SELECT report_id FROM incident_reports LIMIT 1');
    const inserted = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password, role, role_id, phone_verified)
       VALUES ('Schema', 'Audit', $1, $2, 'x', 'user', 8, TRUE)
       RETURNING user_id`,
      [`schema.audit.${Date.now()}@rescuelink.test`, `63902${String(Date.now()).slice(-8)}`]
    );
    userId = inserted.rows[0].user_id;
    expect(userId).toBeTruthy();
  });

  it('enforces one responder profile per user_id and allows null user_id', async () => {
    if (!ready || !userId) return;
    const first = await Responder.create({
      name: 'Schema Audit Responder',
      user_id: userId,
    });
    responderId = first.responder_id;
    expect(responderId).toBeTruthy();

    await expect(
      Responder.create({ name: 'Duplicate Profile', user_id: userId })
    ).rejects.toMatchObject({ code: '23505' });

    const orphan = await Responder.create({ name: 'No User Responder' });
    expect(orphan.user_id).toBeNull();
    await pool.query('DELETE FROM responders WHERE responder_id = $1', [orphan.responder_id]);
  });

  it('validates department_code on teams and dispatches', async () => {
    if (!ready || !deptCode || !userId) return;
    const team = await Responder.createTeam({
      department_code: deptCode,
      team_name: `audit-${Date.now()}`,
    });
    teamId = team.team_id;
    expect(team.department_code).toBe(deptCode);

    await expect(
      Responder.createTeam({ department_code: 'not-a-real-dept', team_name: `bad-${Date.now()}` })
    ).rejects.toMatchObject({ code: '23503' });

    const key = await pool.query('INSERT INTO incident_keys DEFAULT VALUES RETURNING report_id');
    reportId = key.rows[0].report_id;
    await pool.query(
      `INSERT INTO incident_reports (report_id, user_id, severity_level, latitude, longitude, status)
       VALUES ($1, $2, 'low', 16.04, 120.33, 'pending')`,
      [reportId, userId]
    );

    const responder = await pool.query(
      'SELECT responder_id FROM responders WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    const rid = responder.rows[0]?.responder_id || responderId;

    const dispatch = await Dispatch.create({
      report_id: reportId,
      responder_id: rid,
      department_code: deptCode,
      response_status: 'Assigned',
    });
    dispatchId = dispatch.dispatch_id;
    expect(dispatch.department_code).toBe(deptCode);

    // Dispatch.create strips department_code on some errors; FK must be checked at SQL layer.
    await expect(
      pool.query(
        `INSERT INTO dispatches (report_id, responder_id, response_status, department_code)
         VALUES ($1, $2, $3, $4)`,
        [reportId, rid, 'Assigned', 'not-a-real-dept']
      )
    ).rejects.toMatchObject({ code: '23503' });
  });
});
