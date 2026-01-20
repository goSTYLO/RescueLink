const pool = require('../config/db');

const Dispatch = {
  async create({ report_id, responder_id, response_status = null }) {
    const res = await pool.query(
      'INSERT INTO dispatches(report_id, responder_id, response_status) VALUES($1, $2, $3) RETURNING *',
      [report_id, responder_id, response_status]
    );
    return res.rows[0];
  },

  async findById(dispatch_id) {
    const res = await pool.query(
      'SELECT * FROM dispatches WHERE dispatch_id = $1',
      [dispatch_id]
    );
    return res.rows[0];
  },

  async findAll({ limit = 20, offset = 0, report_id = null, responder_id = null, response_status = null } = {}) {
    // Cap limit at 100
    const cappedLimit = Math.min(limit, 100);
    
    let query = 'SELECT * FROM dispatches WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (report_id) {
      paramCount++;
      query += ` AND report_id = $${paramCount}`;
      params.push(report_id);
    }

    if (responder_id) {
      paramCount++;
      query += ` AND responder_id = $${paramCount}`;
      params.push(responder_id);
    }

    if (response_status) {
      paramCount++;
      query += ` AND response_status = $${paramCount}`;
      params.push(response_status);
    }

    query += ` ORDER BY dispatched_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    const res = await pool.query(query, params);
    return res.rows;
  },

  async update(dispatch_id, { report_id, responder_id, response_status }) {
    const res = await pool.query(
      'UPDATE dispatches SET report_id = $1, responder_id = $2, response_status = $3 WHERE dispatch_id = $4 RETURNING *',
      [report_id, responder_id, response_status, dispatch_id]
    );
    return res.rows[0];
  },

  async delete(dispatch_id) {
    const res = await pool.query(
      'DELETE FROM dispatches WHERE dispatch_id = $1 RETURNING *',
      [dispatch_id]
    );
    return res.rows[0];
  },

  // Helper to check if report exists
  async reportExists(report_id) {
    const res = await pool.query(
      'SELECT 1 FROM incident_reports WHERE report_id = $1',
      [report_id]
    );
    return res.rows.length > 0;
  },

  // Helper to check if responder exists
  async responderExists(responder_id) {
    const res = await pool.query(
      'SELECT 1 FROM responders WHERE responder_id = $1',
      [responder_id]
    );
    return res.rows.length > 0;
  }
};

module.exports = Dispatch;
