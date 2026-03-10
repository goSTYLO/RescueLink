const pool = require('../config/db');
const { decrypt } = require('../utils/encryption');

function looksEncryptedValue(value) {
  return typeof value === 'string'
    && /^[0-9a-f]+$/i.test(value)
    && value.length >= 184
    && value.length % 2 === 0;
}

function tryDecryptValue(value) {
  if (!looksEncryptedValue(value)) {
    return value;
  }

  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

function decodeAuditUserFields(row) {
  if (!row || typeof row !== 'object') {
    return row;
  }

  return {
    ...row,
    user_email: tryDecryptValue(row.user_email),
    user_first_name: tryDecryptValue(row.user_first_name),
    user_last_name: tryDecryptValue(row.user_last_name)
  };
}

const { recursivelyDecrypt } = require('../utils/encryption');

function decodeAuditRow(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    user_email: row.user_email != null ? tryDecryptValue(row.user_email) : row.user_email,
    user_first_name: row.user_first_name != null ? tryDecryptValue(row.user_first_name) : row.user_first_name,
    user_last_name: row.user_last_name != null ? tryDecryptValue(row.user_last_name) : row.user_last_name,
    details: row.details != null ? recursivelyDecrypt(row.details) : row.details,
  };
}

const AuditLog = {
  async create({ user_id, action, resource_type, resource_id = null, details = null, ip_address = null, user_agent = null }) {
    const res = await pool.query(
      `INSERT INTO dispatcher_audit_logs(user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user_id, action, resource_type, resource_id, details ? JSON.stringify(details) : null, ip_address, user_agent]
    );
    return res.rows[0];
  },

  async findAll({ user_id = null, action = null, resource_type = null, from = null, to = null, limit = 50, offset = 0 } = {}) {
    const cappedLimit = Math.min(limit, 100);
    let query = `
      SELECT al.id, al.user_id, al.action, al.resource_type, al.resource_id, al.details, al.ip_address, al.user_agent, al.created_at,
             u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name
      FROM dispatcher_audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      query += ` AND al.user_id = $${paramCount}`;
      params.push(user_id);
    }
    if (action) {
      paramCount++;
      query += ` AND al.action = $${paramCount}`;
      params.push(action);
    }
    if (resource_type) {
      paramCount++;
      query += ` AND al.resource_type = $${paramCount}`;
      params.push(resource_type);
    }
    if (from) {
      paramCount++;
      query += ` AND al.created_at >= $${paramCount}`;
      params.push(from);
    }
    if (to) {
      paramCount++;
      query += ` AND al.created_at <= $${paramCount}`;
      params.push(to);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    const res = await pool.query(query, params);
    return res.rows;
  }
};

module.exports = AuditLog;
