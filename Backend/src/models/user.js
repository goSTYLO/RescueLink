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

function decodeUserFields(row) {
  if (!row || typeof row !== 'object') {
    return row;
  }

  return {
    ...row,
    email: tryDecryptValue(row.email),
    first_name: tryDecryptValue(row.first_name),
    last_name: tryDecryptValue(row.last_name),
    phone_number: tryDecryptValue(row.phone_number),
    address: tryDecryptValue(row.address),
    role: tryDecryptValue(row.role),
    department_id: row.department_id != null ? row.department_id : undefined,
  };
}

const User = {
  async findByEmail(email) {
    const directMatch = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, department_id, created_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (directMatch.rows[0]) {
      return decodeUserFields(directMatch.rows[0]);
    }

    const allUsers = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, department_id, created_at FROM users'
    );

    const normalizedEmail = String(email).trim().toLowerCase();
    const matchedUser = allUsers.rows
      .map(decodeUserFields)
      .find((user) => {
        if (!user?.email) return false;
        return String(user.email).trim().toLowerCase() === normalizedEmail;
      });

    return matchedUser || null;
  },

  async findByPhone(phone) {
    const directMatch = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, department_id, created_at FROM users WHERE phone_number = $1',
      [phone]
    );

    if (directMatch.rows[0]) {
      return decodeUserFields(directMatch.rows[0]);
    }

    const allUsers = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, department_id, created_at FROM users'
    );

    const normalizedPhone = String(phone).trim();
    const matchedUser = allUsers.rows
      .map(decodeUserFields)
      .find((user) => {
        if (!user?.phone_number) return false;
        return String(user.phone_number).trim() === normalizedPhone;
      });

    return matchedUser || null;
  },

  async findById(user_id) {
    const res = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, department_id, created_at FROM users WHERE user_id = $1',
      [user_id]
    );
    return decodeUserFields(res.rows[0]);
  },

  async create({ email = null, phone_number = null, address = null, password = null, phone_verified = false, first_name = null, last_name = null, role = 'user', department_id = null }) {
    const res = await pool.query(
      `INSERT INTO users(email, phone_number, address, password, phone_verified, first_name, last_name, role, department_id)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, department_id, created_at`,
      [email, phone_number, address, password, phone_verified, first_name, last_name, role, department_id]
    );
    return decodeUserFields(res.rows[0]);
  },

  async updatePhoneVerified(phone_number, verified = true) {
    const res = await pool.query(
      'UPDATE users SET phone_verified = $1 WHERE phone_number = $2 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, created_at',
      [verified, phone_number]
    );
    return decodeUserFields(res.rows[0]);
  },

  async updatePassword(user_id, password_hash) {
    const res = await pool.query(
      'UPDATE users SET password = $1 WHERE user_id = $2 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, created_at',
      [password_hash, user_id]
    );
    return decodeUserFields(res.rows[0]);
  },

  /**
   * Get paginated list of all users (active and inactive), with department name when department_id set
   * @param {number} offset - Pagination offset
   * @param {number} limit - Number of users per page
   * @param {object} options - Optional parameters
   * @param {string|string[]} options.excludeRole - Role(s) to exclude (e.g. 'user' or ['user', 'responder'])
   * @returns {object} { users: [], total: number }
   */
  async getPaginated(offset, limit, options = {}) {
    const { excludeRole } = options;
    const excludeRoles = Array.isArray(excludeRole)
      ? excludeRole.filter((r) => typeof r === 'string' && r.trim() !== '')
      : (typeof excludeRole === 'string' && excludeRole.trim() !== '' ? [excludeRole.trim()] : []);
    const hasExclude = excludeRoles.length > 0;

    const countQuery = hasExclude
      ? `SELECT COUNT(*) as total FROM users WHERE role NOT IN (${excludeRoles.map((_, i) => `$${i + 1}`).join(', ')})`
      : 'SELECT COUNT(*) as total FROM users';
    const countParams = hasExclude ? excludeRoles : [];
    const countRes = await pool.query(countQuery, countParams);
    const total = parseInt(countRes.rows[0].total, 10);

    const placeholders = hasExclude ? excludeRoles.map((_, i) => `$${i + 1}`).join(', ') : '';
    const usersQuery = hasExclude
      ? `SELECT u.user_id, u.email, u.phone_number, u.address, u.phone_verified, u.first_name, u.last_name, u.role, u.department_id, u.is_active, u.created_at, d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.department_id = u.department_id
         WHERE u.role NOT IN (${placeholders})
         ORDER BY u.created_at DESC
         LIMIT $${excludeRoles.length + 1} OFFSET $${excludeRoles.length + 2}`
      : `SELECT u.user_id, u.email, u.phone_number, u.address, u.phone_verified, u.first_name, u.last_name, u.role, u.department_id, u.is_active, u.created_at, d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.department_id = u.department_id
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`;
    const usersParams = hasExclude ? [...excludeRoles, limit, offset] : [limit, offset];
    const usersRes = await pool.query(usersQuery, usersParams);

    return { users: usersRes.rows.map((row) => ({ ...decodeUserFields(row), department_name: row.department_name || null })), total };
  },

  /**
   * Count users with a specific role
   * @param {string} role - Role to count
   * @returns {number} User count
   */
  async countByRole(role) {
    const res = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true',
      [role]
    );
    return parseInt(res.rows[0].count, 10);
  },

  /**
   * Update user role
   * @param {number} user_id - User ID
   * @param {string} role - New role value
   * @returns {object} Updated user
   */
  async updateRole(user_id, role) {
    const res = await pool.query(
      'UPDATE users SET role = $1 WHERE user_id = $2 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, department_id, is_active, created_at',
      [role, user_id]
    );
    return decodeUserFields(res.rows[0]);
  },

  /**
   * Update user role and department_id
   * @param {number} user_id - User ID
   * @param {string} role - New role value
   * @param {number|null} department_id - Department ID (null to clear)
   * @returns {object} Updated user
   */
  async updateRoleAndDepartment(user_id, role, department_id) {
    const res = await pool.query(
      'UPDATE users SET role = $1, department_id = $2 WHERE user_id = $3 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, department_id, is_active, created_at',
      [role, department_id, user_id]
    );
    return decodeUserFields(res.rows[0]);
  },

  /**
   * Update user role, department_id, first_name, and last_name
   * @param {number} user_id - User ID
   * @param {string} role - New role value
   * @param {number|null} department_id - Department ID (null to clear)
   * @param {string|null} first_name - First name
   * @param {string|null} last_name - Last name
   * @returns {object} Updated user
   */
  async updateRoleDepartmentAndName(user_id, role, department_id, first_name, last_name) {
    const res = await pool.query(
      'UPDATE users SET role = $1, department_id = $2, first_name = $3, last_name = $4 WHERE user_id = $5 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, department_id, is_active, created_at',
      [role, department_id, first_name, last_name, user_id]
    );
    return decodeUserFields(res.rows[0]);
  },

  /**
   * Deactivate user account (soft delete)
   * @param {number} user_id - User ID to deactivate
   * @returns {object} Deactivated user
   */
  async deactivate(user_id) {
    const res = await pool.query(
      'UPDATE users SET is_active = false WHERE user_id = $1 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, is_active, created_at',
      [user_id]
    );
    return decodeUserFields(res.rows[0]);
  },

  /**
   * Permanently delete user
   * @param {number} user_id - User ID to delete
   * @returns {boolean} Success
   */
  async delete(user_id) {
    await pool.query('DELETE FROM users WHERE user_id = $1', [user_id]);
    return true;
  },

  /**
   * Get system statistics
   * @returns {object} Statistics about users and their roles
   */
  async getStats() {
    const totalRes = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE is_active = true'
    );

    const roleRes = await pool.query(
      'SELECT role, COUNT(*) as count FROM users WHERE is_active = true GROUP BY role'
    );

    const roleCount = {};
    roleRes.rows.forEach(row => {
      roleCount[row.role] = parseInt(row.count, 10);
    });

    return {
      total_users: parseInt(totalRes.rows[0].total, 10),
      by_role: roleCount,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = User;
