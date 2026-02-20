const pool = require('../config/db');
const { encryptFields, decryptFields, decryptRows } = require('../utils/encryptedField');

// Sensitive fields that should be encrypted at rest (AES-256-GCM)
// NOTE: 'password' is intentionally EXCLUDED - passwords use bcrypt hashing (one-way), not encryption
const SENSITIVE_FIELDS = ['phone_number', 'email', 'first_name', 'last_name', 'address'];

// Field types for proper deserialization
const FIELD_TYPES = {
  phone_number: 'string',
  email: 'string',
  first_name: 'string',
  last_name: 'string',
  address: 'string'
};

const User = {
  async findByEmail(email) {
    console.log('🔍 [User.findByEmail] Searching for email (will decrypt all to match)');
    
    // Since email is encrypted, we need to fetch all users and decrypt to find match
    const res = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, created_at FROM users WHERE email IS NOT NULL'
    );
    
    if (res.rows.length === 0) {
      console.log('   No users found in database');
      return null;
    }
    
    // Decrypt and find matching email (case-insensitive)
    const normalizedSearchEmail = email.toLowerCase();
    for (const row of res.rows) {
      const decryptedUser = decryptFields(row, SENSITIVE_FIELDS, FIELD_TYPES);
      if (decryptedUser.email && decryptedUser.email.toLowerCase() === normalizedSearchEmail) {
        console.log('   ✅ Found user by email:', { user_id: decryptedUser.user_id });
        return decryptedUser;
      }
    }
    
    console.log('   ❌ No user found with email:', email);
    return null;
  },

  async findByPhone(phone) {
    console.log('🔍 [User.findByPhone] Searching for phone (will decrypt all to match)');
    
    // Since phone_number is encrypted, we need to fetch all users and decrypt to find match
    const res = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, created_at FROM users WHERE phone_number IS NOT NULL'
    );
    
    if (res.rows.length === 0) {
      console.log('   No users found in database');
      return null;
    }
    
    // Decrypt and find matching phone
    for (const row of res.rows) {
      const decryptedUser = decryptFields(row, SENSITIVE_FIELDS, FIELD_TYPES);
      if (decryptedUser.phone_number === phone) {
        console.log('   ✅ Found user by phone:', { user_id: decryptedUser.user_id });
        return decryptedUser;
      }
    }
    
    console.log('   ❌ No user found with phone:', phone);
    return null;
  },

  async findById(user_id) {
    const res = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, created_at FROM users WHERE user_id = $1',
      [user_id]
    );
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
    return res.rows[0];
  },

  async create({ email = null, phone_number = null, address = null, password = null, phone_verified = false, first_name = null, last_name = null, role = 'user' }) {
    // Encrypt sensitive PII fields before saving (NOT password - it's already bcrypt-hashed by controller)
    const dataToSave = encryptFields({
      email,
      phone_number,
      address,
      first_name,
      last_name
    }, SENSITIVE_FIELDS);

    // Password is stored as-is (already a bcrypt hash from hashPassword() in controller)
    const res = await pool.query(
      'INSERT INTO users(email, phone_number, address, password, phone_verified, first_name, last_name, role) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, created_at',
      [dataToSave.email, dataToSave.phone_number, dataToSave.address, password, phone_verified, dataToSave.first_name, dataToSave.last_name, role]
    );
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
    return res.rows[0];
  },

  async updatePhoneVerified(phone_number, verified = true) {
    const res = await pool.query(
      'UPDATE users SET phone_verified = $1 WHERE phone_number = $2 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, created_at',
      [verified, phone_number]
    );
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
    return res.rows[0];
  },

  async updatePassword(user_id, password_hash) {
    // Update password with bcrypt hash (NOT encrypted - passwords use one-way hashing)
    const res = await pool.query(
      'UPDATE users SET password = $1 WHERE user_id = $2 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, created_at',
      [password_hash, user_id]
    );
    // Decrypt sensitive PII fields before returning (password is already excluded)
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
    return res.rows[0];
  },

  /**
   * Get paginated list of all active users
   * @param {number} offset - Pagination offset
   * @param {number} limit - Number of users per page
   * @returns {object} { users: [], total: number }
   */
  async getPaginated(offset, limit) {
    const countRes = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE is_active = true'
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const usersRes = await pool.query(
      'SELECT user_id, email, phone_number, address, phone_verified, first_name, last_name, role, is_active, created_at FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    // Decrypt all sensitive fields in the results
    const decryptedUsers = decryptRows(usersRes.rows, SENSITIVE_FIELDS, FIELD_TYPES);
    return { users: decryptedUsers, total };
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
      'UPDATE users SET role = $1 WHERE user_id = $2 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, is_active, created_at',
      [role, user_id]
    );
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
    return res.rows[0];
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
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
    return res.rows[0];
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
