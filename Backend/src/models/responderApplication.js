const pool = require('../config/db');

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS responder_applications (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        status            VARCHAR(20) NOT NULL DEFAULT 'pending',
        gov_id_path       VARCHAR(500),
        certificate_paths JSONB DEFAULT '[]'::jsonb,
        other_doc_paths   JSONB DEFAULT '[]'::jsonb,
        personal_details  JSONB DEFAULT '{}'::jsonb,
        specialization_fields TEXT[] DEFAULT '{}',
        field_proof_paths JSONB DEFAULT '{}'::jsonb,
        notes             TEXT,
        submitted_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        reviewed_at       TIMESTAMP WITH TIME ZONE,
        reviewed_by       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
        revoke_reason     VARCHAR(50),
        revoke_reason_other TEXT,
        revoked_at        TIMESTAMP WITH TIME ZONE,
        revoked_by        INTEGER,
        CONSTRAINT chk_responder_app_status CHECK (status IN ('pending', 'approved', 'rejected', 'revoked'))
      );
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS gov_id_path VARCHAR(500);
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS certificate_paths JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS other_doc_paths JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS personal_details JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS specialization_fields TEXT[] DEFAULT '{}';
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS field_proof_paths JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS revoke_reason VARCHAR(50);
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS revoke_reason_other TEXT;
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS revoked_by INTEGER;
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'responder_applications' AND column_name = 'full_name'
        ) THEN
          ALTER TABLE responder_applications ALTER COLUMN full_name DROP NOT NULL;
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_responder_apps_user_id ON responder_applications(user_id);
      CREATE INDEX IF NOT EXISTS idx_responder_apps_status ON responder_applications(status);
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn('[ResponderApplication] Table initialization check notice:', err.message);
  }
}

const ResponderApplication = {
  async create({
    user_id,
    gov_id_path,
    certificate_paths = [],
    other_doc_paths = [],
    personal_details = {},
    specialization_fields = [],
    field_proof_paths = {},
  }) {
    await ensureTable();
    const res = await pool.query(
      `INSERT INTO responder_applications (
        user_id, gov_id_path, certificate_paths, other_doc_paths, personal_details, specialization_fields, field_proof_paths
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        user_id,
        gov_id_path,
        JSON.stringify(certificate_paths),
        JSON.stringify(other_doc_paths),
        JSON.stringify(personal_details),
        specialization_fields,
        JSON.stringify(field_proof_paths),
      ]
    );
    return res.rows[0];
  },

  async findById(id) {
    await ensureTable();
    const res = await pool.query(
      `SELECT ra.*,
              u.first_name, u.last_name, u.email, u.phone_number, u.role AS current_user_role,
              reviewer.first_name AS reviewer_first_name, reviewer.last_name AS reviewer_last_name
       FROM responder_applications ra
       JOIN users u ON u.user_id = ra.user_id
       LEFT JOIN users reviewer ON reviewer.user_id = ra.reviewed_by
       WHERE ra.id = $1`,
      [id]
    );
    return res.rows[0];
  },

  async findByUserId(user_id) {
    await ensureTable();
    try {
      const res = await pool.query(
        `SELECT ra.*,
                reviewer.first_name AS reviewer_first_name, reviewer.last_name AS reviewer_last_name
         FROM responder_applications ra
         LEFT JOIN users reviewer ON reviewer.user_id = ra.reviewed_by
         WHERE ra.user_id = $1
         ORDER BY ra.submitted_at DESC
         LIMIT 1`,
        [user_id]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42P01') return null;
      throw error;
    }
  },

  async findAll({ status = null, limit = 20, offset = 0 } = {}) {
    await ensureTable();
    const cappedLimit = Math.min(Number(limit) || 20, 100);
    let query = `
      SELECT ra.*,
             u.first_name, u.last_name, u.email, u.phone_number, u.role AS current_user_role
      FROM responder_applications ra
      JOIN users u ON u.user_id = ra.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND ra.status = $${params.length}`;
    }

    params.push(cappedLimit, Number(offset) || 0);
    query += ` ORDER BY ra.submitted_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    try {
      const res = await pool.query(query, params);

      let countQuery = `SELECT COUNT(*) FROM responder_applications WHERE 1=1`;
      const countParams = [];
      if (status) {
        countParams.push(status);
        countQuery += ` AND status = $1`;
      }
      const countRes = await pool.query(countQuery, countParams);

      return {
        applications: res.rows,
        total: parseInt(countRes.rows[0]?.count || 0, 10),
      };
    } catch (error) {
      if (error.code === '42P01') {
        return { applications: [], total: 0 };
      }
      throw error;
    }
  },

  async updateStatus(id, { status, notes, reviewed_by }) {
    await ensureTable();
    const res = await pool.query(
      `UPDATE responder_applications
       SET status = $1, notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, notes || null, reviewed_by, id]
    );
    return res.rows[0];
  },

  async revoke(id, {
    notes,
    revoke_reason,
    revoke_reason_other,
    revoked_by,
  }) {
    await ensureTable();
    const res = await pool.query(
      `UPDATE responder_applications
       SET status = 'revoked',
           notes = $1,
           revoke_reason = $2,
           revoke_reason_other = $3,
           revoked_at = CURRENT_TIMESTAMP,
           revoked_by = $4
       WHERE id = $5
       RETURNING *`,
      [notes || null, revoke_reason, revoke_reason_other || null, revoked_by, id]
    );
    return res.rows[0];
  },

  async delete(id) {
    await ensureTable();
    const res = await pool.query(
      'DELETE FROM responder_applications WHERE id = $1 RETURNING *',
      [id]
    );
    return res.rows[0];
  }
};

module.exports = ResponderApplication;
