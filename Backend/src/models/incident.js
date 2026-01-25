const pool = require('../config/db');

const Incident = {
  async create({ user_id, incident_type = null, severity_level, description = null, latitude, longitude, media_url = null, status = 'pending' }) {
    const res = await pool.query(
      'INSERT INTO incident_reports(user_id, incident_type, severity_level, description, latitude, longitude, media_url, status) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [user_id, incident_type, severity_level, description, latitude, longitude, media_url, status]
    );
    return res.rows[0];
  },

  async findById(report_id) {
    const res = await pool.query(
      'SELECT * FROM incident_reports WHERE report_id = $1',
      [report_id]
    );
    return res.rows[0];
  },

  async findAll({ limit = 20, offset = 0, user_id = null, severity_level = null, status = null } = {}) {
    // Cap limit at 100
    const cappedLimit = Math.min(limit, 100);
    
    let query = 'SELECT * FROM incident_reports WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(user_id);
    }

    if (severity_level) {
      paramCount++;
      query += ` AND severity_level = $${paramCount}`;
      params.push(severity_level);
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    const res = await pool.query(query, params);
    return res.rows;
  },

  async findByUserId(user_id, { limit = 20, offset = 0 } = {}) {
    const cappedLimit = Math.min(limit, 100);
    const res = await pool.query(
      'SELECT * FROM incident_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [user_id, cappedLimit, offset]
    );
    return res.rows;
  },

  async update(report_id, { incident_type, severity_level, description, latitude, longitude, media_url, status }) {
    const res = await pool.query(
      'UPDATE incident_reports SET incident_type = $1, severity_level = $2, description = $3, latitude = $4, longitude = $5, media_url = $6, status = $7 WHERE report_id = $8 RETURNING *',
      [incident_type, severity_level, description, latitude, longitude, media_url, status, report_id]
    );
    return res.rows[0];
  },

  async delete(report_id) {
    const res = await pool.query(
      'DELETE FROM incident_reports WHERE report_id = $1 RETURNING *',
      [report_id]
    );
    return res.rows[0];
  }
};

module.exports = Incident;
