const pool = require('../config/db');

const Notification = {
  async create({ user_id, report_id = null, message, sent_via = null, is_read = false, event_type = null }) {
    try {
      const res = await pool.query(
        'INSERT INTO notifications(user_id, report_id, message, sent_via, is_read, event_type) VALUES($1, $2, $3, $4, $5, $6) RETURNING *',
        [user_id, report_id, message, sent_via, is_read, event_type]
      );
      return res.rows[0];
    } catch (err) {
      if (err.message && err.message.includes('event_type')) {
        const res = await pool.query(
          'INSERT INTO notifications(user_id, report_id, message, sent_via, is_read) VALUES($1, $2, $3, $4, $5) RETURNING *',
          [user_id, report_id, message, sent_via, is_read]
        );
        return res.rows[0];
      }
      if (err.message && err.message.includes('is_read')) {
        const res = await pool.query(
          'INSERT INTO notifications(user_id, report_id, message, sent_via) VALUES($1, $2, $3, $4) RETURNING *',
          [user_id, report_id, message, sent_via]
        );
        return res.rows[0];
      }
      throw err;
    }
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
    
    let query = `SELECT n.*, i.incident_type, i.status AS incident_status
      FROM notifications n
      LEFT JOIN incident_reports i ON i.report_id = n.report_id
      WHERE 1=1`;
    const params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      query += ` AND n.user_id = $${paramCount}`;
      params.push(user_id);
    }

    if (report_id) {
      paramCount++;
      query += ` AND n.report_id = $${paramCount}`;
      params.push(report_id);
    }

    if (sent_via) {
      paramCount++;
      query += ` AND n.sent_via = $${paramCount}`;
      params.push(sent_via);
    }

    query += ` ORDER BY n.sent_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    try {
      const res = await pool.query(query, params);
      return res.rows;
    } catch (err) {
      if (err.code === '42703' || /incident_type|incident_status/i.test(err.message)) {
        const fallbackParams = [];
        let fallbackQuery = 'SELECT * FROM notifications WHERE 1=1';
        let p = 0;
        if (user_id) { p++; fallbackQuery += ` AND user_id = $${p}`; fallbackParams.push(user_id); }
        if (report_id) { p++; fallbackQuery += ` AND report_id = $${p}`; fallbackParams.push(report_id); }
        if (sent_via) { p++; fallbackQuery += ` AND sent_via = $${p}`; fallbackParams.push(sent_via); }
        p++; fallbackQuery += ` ORDER BY sent_at DESC LIMIT $${p} OFFSET $${p + 1}`;
        fallbackParams.push(cappedLimit, offset);
        const fallback = await pool.query(fallbackQuery, fallbackParams);
        return fallback.rows;
      }
      throw err;
    }
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
  },

  // Count unread notifications for a user (for badge display)
  async countUnreadByUserId(user_id) {
    try {
      const res = await pool.query(
        'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND (is_read IS NULL OR is_read = FALSE)',
        [user_id]
      );
      return res.rows[0]?.count ?? 0;
    } catch (err) {
      if (err.message && err.message.includes('is_read')) {
        const res = await pool.query(
          'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1',
          [user_id]
        );
        return res.rows[0]?.count ?? 0;
      }
      return 0;
    }
  },

  // Mark notification(s) as read
  async markAsRead(notification_id, user_id) {
    const res = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2 RETURNING *',
      [notification_id, user_id]
    );
    return res.rows[0];
  },

  // Mark all notifications as read for a user
  async markAllAsReadByUserId(user_id) {
    try {
      const res = await pool.query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND (is_read IS NULL OR is_read = FALSE) RETURNING notification_id',
        [user_id]
      );
      return res.rowCount ?? 0;
    } catch (err) {
      if (err.message && err.message.includes('is_read')) {
        return 0;
      }
      throw err;
    }
  }
};

module.exports = Notification;
