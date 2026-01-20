const pool = require('../config/db');

const Responder = {
  async create({ name, organization = null, contact_number = null, availability_status = null }) {
    const res = await pool.query(
      'INSERT INTO responders(name, organization, contact_number, availability_status) VALUES($1, $2, $3, $4) RETURNING *',
      [name, organization, contact_number, availability_status]
    );
    return res.rows[0];
  },

  async findById(responder_id) {
    const res = await pool.query(
      'SELECT * FROM responders WHERE responder_id = $1',
      [responder_id]
    );
    return res.rows[0];
  },

  async findAll({ limit = 20, offset = 0, organization = null, availability_status = null } = {}) {
    // Cap limit at 100
    const cappedLimit = Math.min(limit, 100);
    
    let query = 'SELECT * FROM responders WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (organization) {
      paramCount++;
      query += ` AND organization = $${paramCount}`;
      params.push(organization);
    }

    if (availability_status) {
      paramCount++;
      query += ` AND availability_status = $${paramCount}`;
      params.push(availability_status);
    }

    query += ` ORDER BY responder_id DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    const res = await pool.query(query, params);
    return res.rows;
  },

  async update(responder_id, { name, organization, contact_number, availability_status }) {
    const res = await pool.query(
      'UPDATE responders SET name = $1, organization = $2, contact_number = $3, availability_status = $4 WHERE responder_id = $5 RETURNING *',
      [name, organization, contact_number, availability_status, responder_id]
    );
    return res.rows[0];
  },

  async delete(responder_id) {
    const res = await pool.query(
      'DELETE FROM responders WHERE responder_id = $1 RETURNING *',
      [responder_id]
    );
    return res.rows[0];
  }
};

module.exports = Responder;
