const pool = require('../config/db');

const User = {
  async findByEmail(email) {
    const res = await pool.query(
      'SELECT id, email, phone_number, phone_verified, first_name, last_name, password, created_at FROM users WHERE email = $1',
      [email]
    );
    return res.rows[0];
  },

  async findByPhone(phone) {
    const res = await pool.query(
      'SELECT id, email, phone_number, phone_verified, first_name, last_name, password, created_at FROM users WHERE phone_number = $1',
      [phone]
    );
    return res.rows[0];
  },

  async create({ email = null, phone_number = null, password, phone_verified = false, first_name = null, last_name = null }) {
    const res = await pool.query(
      'INSERT INTO users(email, phone_number, password, phone_verified, first_name, last_name) VALUES($1, $2, $3, $4, $5, $6) RETURNING id, email, phone_number, phone_verified, first_name, last_name, created_at',
      [email, phone_number, password, phone_verified, first_name, last_name]
    );
    return res.rows[0];
  }
};

module.exports = User;
