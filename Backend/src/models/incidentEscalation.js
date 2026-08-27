/**
 * IncidentEscalation model — manages the incident_escalations table.
 *
 * Uses ensureSchema() on first call so it is safe to call at boot or from
 * tests without a prior manual migration run.
 */
const pool = require('../config/db');

let schemaEnsured = false;

const IncidentEscalation = {
  async ensureSchema() {
    if (schemaEnsured) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS incident_escalations (
        id                     SERIAL PRIMARY KEY,
        report_id              INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
        from_department_id     INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
        to_department_id       INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
        requested_by_user_id   INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
        urgency                VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low','medium','high','critical')),
        justification_notes    TEXT NOT NULL,
        status                 VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','resolved','cancelled')),
        response_notes         TEXT,
        responded_by_user_id   INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
        responded_at           TIMESTAMP,
        resolved_at            TIMESTAMP,
        created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_incident_escalations_report_id ON incident_escalations(report_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_incident_escalations_to_dept ON incident_escalations(to_department_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_incident_escalations_status ON incident_escalations(status)');
    schemaEnsured = true;
  },

  /**
   * Create an escalation request.
   */
  async create({ report_id, from_department_id, to_department_id, requested_by_user_id, urgency = 'medium', justification_notes }) {
    await this.ensureSchema();
    const res = await pool.query(
      `INSERT INTO incident_escalations
         (report_id, from_department_id, to_department_id, requested_by_user_id, urgency, justification_notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [report_id, from_department_id || null, to_department_id, requested_by_user_id, urgency, justification_notes]
    );
    return res.rows[0];
  },

  /**
   * List escalations for an incident, joining department and user names.
   */
  async findByReportId(report_id) {
    await this.ensureSchema();
    try {
      const res = await pool.query(
        `SELECT
           e.*,
           fd.name AS from_department_name,
           fd.code AS from_department_code,
           td.name AS to_department_name,
           td.code AS to_department_code,
           req.first_name AS requester_first_name,
           req.last_name  AS requester_last_name,
           req.role       AS requester_role,
           resp.first_name AS responder_first_name,
           resp.last_name  AS responder_last_name
         FROM incident_escalations e
         LEFT JOIN departments  fd   ON fd.department_id  = e.from_department_id
         LEFT JOIN departments  td   ON td.department_id  = e.to_department_id
         LEFT JOIN users        req  ON req.user_id       = e.requested_by_user_id
         LEFT JOIN users        resp ON resp.user_id      = e.responded_by_user_id
         WHERE e.report_id = $1
         ORDER BY e.created_at DESC`,
        [report_id]
      );
      return res.rows;
    } catch (err) {
      if (err.code === '42P01') return [];
      throw err;
    }
  },

  /**
   * Find a single escalation by primary key.
   */
  async findById(id) {
    await this.ensureSchema();
    const res = await pool.query(
      `SELECT e.*, td.name AS to_department_name, td.code AS to_department_code
       FROM incident_escalations e
       LEFT JOIN departments td ON td.department_id = e.to_department_id
       WHERE e.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  },

  /**
   * Update status, response notes, responded_by, and timestamps.
   * @param {number} id
   * @param {'accepted'|'declined'|'resolved'|'cancelled'} status
   * @param {{ response_notes?: string, responded_by_user_id?: number }} opts
   */
  async updateStatus(id, status, { response_notes, responded_by_user_id } = {}) {
    await this.ensureSchema();
    const res = await pool.query(
      `UPDATE incident_escalations
       SET status               = $1::varchar,
           response_notes       = COALESCE($2::text, response_notes),
           responded_by_user_id = COALESCE($3::integer, responded_by_user_id),
           responded_at         = CASE WHEN $1::varchar IN ('accepted','declined') THEN CURRENT_TIMESTAMP ELSE responded_at END,
           resolved_at          = CASE WHEN $1::varchar = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
           updated_at           = CURRENT_TIMESTAMP
       WHERE id = $4::integer
       RETURNING *`,
      [status, response_notes || null, responded_by_user_id || null, id]
    );
    return res.rows[0] || null;
  },

  /**
   * Get all pending/accepted escalation department IDs for an incident (for notification routing).
   */
  async getActiveDepartmentIds(report_id) {
    try {
      await this.ensureSchema();
      const res = await pool.query(
        `SELECT DISTINCT to_department_id FROM incident_escalations
         WHERE report_id = $1 AND status IN ('pending','accepted')`,
        [report_id]
      );
      return res.rows.map((r) => r.to_department_id).filter(Boolean);
    } catch {
      return [];
    }
  },
};

module.exports = IncidentEscalation;
