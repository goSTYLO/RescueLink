const pool = require('../config/db');

const IncidentCoordinationNote = {
  async create({
    report_id,
    user_id,
    author_name,
    author_role,
    department,
    note,
    source = 'Dispatcher UI',
  }) {
    const res = await pool.query(
      `INSERT INTO incident_coordination_notes(
         report_id, user_id, author_name, author_role, department, note, source
       ) VALUES($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, report_id, user_id, author_name, author_role, department, note, source, created_at`,
      [report_id, user_id, author_name, author_role, department, note, source]
    );
    return res.rows[0];
  },

  async findByReportId(report_id, { limit = 100, offset = 0 } = {}) {
    const cappedLimit = Math.min(limit, 500);
    const res = await pool.query(
      `SELECT id, report_id, user_id, author_name, author_role, department, note, source, created_at
       FROM incident_coordination_notes
       WHERE report_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [report_id, cappedLimit, offset]
    );
    return res.rows;
  },

  async findById(id) {
    const res = await pool.query(
      `SELECT id, report_id, user_id, author_name, author_role, department, note, source, created_at
       FROM incident_coordination_notes
       WHERE id = $1`,
      [id]
    );
    return res.rows[0];
  },
};

module.exports = IncidentCoordinationNote;
