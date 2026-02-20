const pool = require('../config/db');

const Notification = {
  async create({ user_id, report_id = null, message, sent_via = null }) {
    const res = await pool.query(
      'INSERT INTO notifications(user_id, report_id, message, sent_via) VALUES($1, $2, $3, $4) RETURNING *',
      [user_id, report_id, message, sent_via]
    );
    return res.rows[0];
  },

  async findById(notification_id) {
    const res = await pool.query(
      'SELECT * FROM notifications WHERE notification_id = $1',
      [notification_id]
    );
    return res.rows[0];
  },

  async findAll({ limit = 20, offset = 0, user_id = null, report_id = null, sent_via = null } = {}) {
    // Cap limit at 100
    const cappedLimit = Math.min(limit, 100);
    
    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(user_id);
    }

    if (report_id) {
      paramCount++;
      query += ` AND report_id = $${paramCount}`;
      params.push(report_id);
    }

    if (sent_via) {
      paramCount++;
      query += ` AND sent_via = $${paramCount}`;
      params.push(sent_via);
    }

    query += ` ORDER BY sent_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    const res = await pool.query(query, params);
    return res.rows;
  },

  async update(notification_id, { user_id, report_id, message, sent_via }) {
    const res = await pool.query(
      'UPDATE notifications SET user_id = $1, report_id = $2, message = $3, sent_via = $4 WHERE notification_id = $5 RETURNING *',
      [user_id, report_id, message, sent_via, notification_id]
    );
    return res.rows[0];
  },

  async delete(notification_id) {
    const res = await pool.query(
      'DELETE FROM notifications WHERE notification_id = $1 RETURNING *',
      [notification_id]
    );
    return res.rows[0];
  },

  // Helper to check if user exists
  async userExists(user_id) {
    const res = await pool.query(
      'SELECT 1 FROM users WHERE user_id = $1',
      [user_id]
    );
    return res.rows.length > 0;
  },

  // Helper to check if report exists
  async reportExists(report_id) {
    const res = await pool.query(
      'SELECT 1 FROM incident_reports WHERE report_id = $1',
      [report_id]
    );
    return res.rows.length > 0;
  }
};

module.exports = Notification;
