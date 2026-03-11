const pool = require('../config/db');

const IncidentCoordinationNote = {
  async ensureSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS incident_coordination_notes (
        id SERIAL PRIMARY KEY,
        report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
        author_name VARCHAR(150) NOT NULL,
        author_role VARCHAR(80) NOT NULL,
        department VARCHAR(150) NOT NULL,
        note TEXT NOT NULL,
        source VARCHAR(80) DEFAULT 'Dispatcher UI',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_incident_coordination_notes_report_id ON incident_coordination_notes(report_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_incident_coordination_notes_report_created ON incident_coordination_notes(report_id, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_incident_coordination_notes_user_id ON incident_coordination_notes(user_id)');
  },

  async create({
    report_id,
    user_id,
    author_name,
    author_role,
    department,
    note,
    source = 'Dispatcher UI',
  }) {
    await this.ensureSchema();
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
    try {
      await this.ensureSchema();
      const res = await pool.query(
        `SELECT id, report_id, user_id, author_name, author_role, department, note, source, created_at
         FROM incident_coordination_notes
         WHERE report_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [report_id, cappedLimit, offset]
      );
      return res.rows;
    } catch (error) {
      if (error.code === '42P01' || /incident_coordination_notes/i.test(error.message)) {
        return [];
      }
      throw error;
    }
  },

  async findById(id) {
    await this.ensureSchema();
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
