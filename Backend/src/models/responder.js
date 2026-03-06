const pool = require('../config/db');

const Responder = {
  async create({
    name,
    organization = null,
    contact_number = null,
    availability_status = null,
    source_type = 'account',
    team_name = null,
  }) {
    try {
      const res = await pool.query(
        `INSERT INTO responders(name, organization, contact_number, availability_status, source_type, team_name)
         VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, organization, contact_number, availability_status, source_type, team_name]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /source_type|team_name/i.test(error.message)) {
        const fallback = await pool.query(
          'INSERT INTO responders(name, organization, contact_number, availability_status) VALUES($1, $2, $3, $4) RETURNING *',
          [name, organization, contact_number, availability_status]
        );
        return fallback.rows[0];
      }
      throw error;
    }
  },

  async findById(responder_id) {
    const res = await pool.query(
      'SELECT * FROM responders WHERE responder_id = $1',
      [responder_id]
    );
    return res.rows[0];
  },

  async findAll({
    limit = 20,
    offset = 0,
    organization = null,
    availability_status = null,
    source_type = null,
    team_name = null,
  } = {}) {
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

    if (source_type) {
      paramCount++;
      query += ` AND source_type = $${paramCount}`;
      params.push(source_type);
    }

    if (team_name) {
      paramCount++;
      query += ` AND team_name = $${paramCount}`;
      params.push(team_name);
    }

    query += ` ORDER BY responder_id DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    try {
      const res = await pool.query(query, params);
      return res.rows;
    } catch (error) {
      if (error.code === '42703' || /source_type|team_name/i.test(error.message)) {
        let fallbackQuery = 'SELECT * FROM responders WHERE 1=1';
        const fallbackParams = [];
        let fallbackCount = 0;
        if (organization) {
          fallbackCount++;
          fallbackQuery += ` AND organization = $${fallbackCount}`;
          fallbackParams.push(organization);
        }
        if (availability_status) {
          fallbackCount++;
          fallbackQuery += ` AND availability_status = $${fallbackCount}`;
          fallbackParams.push(availability_status);
        }
        fallbackQuery += ` ORDER BY responder_id DESC LIMIT $${fallbackCount + 1} OFFSET $${fallbackCount + 2}`;
        fallbackParams.push(cappedLimit, offset);
        const fallback = await pool.query(fallbackQuery, fallbackParams);
        return fallback.rows;
      }
      throw error;
    }
  },

  async update(responder_id, { name, organization, contact_number, availability_status, source_type, team_name }) {
    try {
      const res = await pool.query(
        `UPDATE responders
         SET name = $1, organization = $2, contact_number = $3, availability_status = $4, source_type = $5, team_name = $6
         WHERE responder_id = $7 RETURNING *`,
        [name, organization, contact_number, availability_status, source_type, team_name, responder_id]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /source_type|team_name/i.test(error.message)) {
        const fallback = await pool.query(
          'UPDATE responders SET name = $1, organization = $2, contact_number = $3, availability_status = $4 WHERE responder_id = $5 RETURNING *',
          [name, organization, contact_number, availability_status, responder_id]
        );
        return fallback.rows[0];
      }
      throw error;
    }
  },

  async findOrCreateDirectory({ name, organization = null, contact_number = null, team_name = null }) {
    let existing;
    try {
      existing = await pool.query(
        `SELECT *
         FROM responders
         WHERE source_type = 'directory'
           AND LOWER(name) = LOWER($1)
           AND COALESCE(LOWER(organization), '') = COALESCE(LOWER($2), '')
           AND COALESCE(LOWER(team_name), '') = COALESCE(LOWER($3), '')
         LIMIT 1`,
        [name, organization, team_name]
      );
    } catch (error) {
      if (error.code === '42703' || /source_type|team_name/i.test(error.message)) {
        existing = await pool.query(
          `SELECT *
           FROM responders
           WHERE LOWER(name) = LOWER($1)
             AND COALESCE(LOWER(organization), '') = COALESCE(LOWER($2), '')
           LIMIT 1`,
          [name, organization]
        );
      } else {
        throw error;
      }
    }
    if (existing.rows[0]) {
      return existing.rows[0];
    }
    return this.create({
      name,
      organization,
      contact_number,
      availability_status: 'Available',
      source_type: 'directory',
      team_name,
    });
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
