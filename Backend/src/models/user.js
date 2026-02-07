const pool = require('../config/db');

const User = {
  async findByEmail(email) {
    const res = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, created_at FROM users WHERE email = $1',
      [email]
    );
    return res.rows[0];
  },

  async findByPhone(phone) {
    const res = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, created_at FROM users WHERE phone_number = $1',
      [phone]
    );
    return res.rows[0];
  },

  async findById(user_id) {
    const res = await pool.query(
      'SELECT user_id, email, phone_number, address, password, phone_verified, first_name, last_name, role, created_at FROM users WHERE user_id = $1',
      [user_id]
    );
    return res.rows[0];
  },

  async create({ email = null, phone_number = null, address = null, password = null, phone_verified = false, first_name = null, last_name = null, role = 'user' }) {
    const res = await pool.query(
      'INSERT INTO users(email, phone_number, address, password, phone_verified, first_name, last_name, role) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, created_at',
      [email, phone_number, address, password, phone_verified, first_name, last_name, role]
    );
    return res.rows[0];
  },

  async updatePhoneVerified(phone_number, verified = true) {
    const res = await pool.query(
      'UPDATE users SET phone_verified = $1 WHERE phone_number = $2 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, created_at',
      [verified, phone_number]
    );
    return res.rows[0];
  },

  async updatePassword(user_id, password_hash) {
    const res = await pool.query(
      'UPDATE users SET password = $1 WHERE user_id = $2 RETURNING user_id, email, phone_number, address, phone_verified, first_name, last_name, role, created_at',
      [password_hash, user_id]
    );
    return res.rows[0];
  }
};

module.exports = User;
