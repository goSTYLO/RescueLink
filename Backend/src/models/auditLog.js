const pool = require('../config/db');
const { encryptFields, decryptFields, decryptRows } = require('../utils/encryptedField');

// Sensitive fields that should be encrypted at rest (from dispatcher_audit_logs table)
const SENSITIVE_FIELDS = ['ip_address', 'details'];

// User fields from JOIN with users table (also encrypted)
const USER_FIELDS = ['user_email', 'user_first_name', 'user_last_name'];

// Field types for proper deserialization
const FIELD_TYPES = {
  ip_address: 'string',
  details: 'string', // Store as encrypted string, parse to JSON after decrypt
  // User field types (from users table JOIN)
  user_email: 'string',
  user_first_name: 'string',
  user_last_name: 'string'
};

const AuditLog = {
  async create({ user_id, action, resource_type, resource_id = null, details = null, ip_address = null, user_agent = null }) {
    console.log('\n📝 [AuditLog.create] Creating audit log entry');
    
    // Convert details object to JSON string BEFORE encryption
    const detailsString = details ? JSON.stringify(details) : null;
    
    // Encrypt sensitive fields before saving
    const dataToSave = encryptFields({
      ip_address,
      details: detailsString
    }, SENSITIVE_FIELDS);
    
    console.log('💾 [AuditLog.create] Encrypted data ready for database');

    const res = await pool.query(
      `INSERT INTO dispatcher_audit_logs(user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user_id, action, resource_type, resource_id, dataToSave.details, dataToSave.ip_address, user_agent]
    );
    
    console.log('✅ [AuditLog.create] Audit log created successfully');
    
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      const decrypted = decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
      // Parse details string back to JSON object
      if (decrypted.details) {
        try {
          decrypted.details = JSON.parse(decrypted.details);
        } catch (e) {
          console.warn('⚠️  [AuditLog.create] Could not parse details as JSON:', e.message);
        }
      }
      return decrypted;
    }
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
    // Decrypt audit log fields AND user fields (from JOIN with users table)
    const allFieldsToDecrypt = [...SENSITIVE_FIELDS, ...USER_FIELDS];
    const decryptedRows = decryptRows(res.rows, allFieldsToDecrypt, FIELD_TYPES);
    
    // Parse details string back to JSON for each row
    return decryptedRows.map(row => {
      if (row.details) {
        try {
          row.details = JSON.parse(row.details);
        } catch (e) {
          console.warn('⚠️  [AuditLog.findAll] Could not parse details as JSON');
        }
      }
      return row;
    });
  }
};

module.exports = AuditLog;
