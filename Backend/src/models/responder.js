const pool = require('../config/db');
const { encryptFields, decryptFields, decryptRows } = require('../utils/encryptedField');

// Sensitive fields that should be encrypted at rest
const SENSITIVE_FIELDS = ['contact_number', 'name'];

// Field types for proper deserialization
const FIELD_TYPES = {
  contact_number: 'string',
  name: 'string'
};

const Responder = {
  async create({ name, organization = null, contact_number = null, availability_status = null }) {
    // Encrypt sensitive fields before saving
    const dataToSave = encryptFields({
      name,
      contact_number
    }, SENSITIVE_FIELDS);

    const res = await pool.query(
      'INSERT INTO responders(name, organization, contact_number, availability_status) VALUES($1, $2, $3, $4) RETURNING *',
      [dataToSave.name, organization, dataToSave.contact_number, availability_status]
    );
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
    return res.rows[0];
  },

  async findById(responder_id) {
    const res = await pool.query(
      'SELECT * FROM responders WHERE responder_id = $1',
      [responder_id]
    );
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
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
    // Decrypt all sensitive fields before returning
    return decryptRows(res.rows, SENSITIVE_FIELDS, FIELD_TYPES);
  },

  async update(responder_id, { name, organization, contact_number, availability_status }) {
    // Encrypt sensitive fields before saving
    const dataToSave = encryptFields({
      name,
      contact_number
    }, SENSITIVE_FIELDS);

    const res = await pool.query(
      'UPDATE responders SET name = $1, organization = $2, contact_number = $3, availability_status = $4 WHERE responder_id = $5 RETURNING *',
      [dataToSave.name, organization, dataToSave.contact_number, availability_status, responder_id]
    );
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
    return res.rows[0];
  },

  async delete(responder_id) {
    const res = await pool.query(
      'DELETE FROM responders WHERE responder_id = $1 RETURNING *',
      [responder_id]
    );
    // Decrypt sensitive fields before returning
    if (res.rows[0]) {
      return decryptFields(res.rows[0], SENSITIVE_FIELDS, FIELD_TYPES);
    }
    return res.rows[0];
  }
};

module.exports = Responder;
