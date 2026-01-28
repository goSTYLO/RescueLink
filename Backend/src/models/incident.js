const pool = require('../config/db');

const Incident = {
  async create({ user_id, incident_type = null, severity_level, description = null, latitude, longitude, media_url = null, status = 'pending' }) {
    const res = await pool.query(
      'INSERT INTO incident_reports(user_id, incident_type, severity_level, description, latitude, longitude, media_url, status) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [user_id, incident_type, severity_level, description, latitude, longitude, media_url, status]
    );
    return res.rows[0];
  },

  /**
   * Create incident with AI-related fields (audio, transcription, media)
   */
  async createWithAi({ 
    user_id, 
    incident_type = null, 
    severity_level, 
    description = null, 
    latitude, 
    longitude, 
    transcription = null,
    audio_path = null,
    media_paths = [],
    ai_pending = false,
    ai_attempted = false,
    status = 'pending' 
  }) {
    const res = await pool.query(
      `INSERT INTO incident_reports(
        user_id, incident_type, severity_level, description, latitude, longitude, 
        transcription, audio_path, media_paths, ai_pending, ai_attempted, status
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        user_id, incident_type, severity_level, description, latitude, longitude,
        transcription, audio_path, JSON.stringify(media_paths), ai_pending, ai_attempted, status
      ]
    );
    return res.rows[0];
  },

  async findById(report_id) {
    const res = await pool.query(
      'SELECT * FROM incident_reports WHERE report_id = $1',
      [report_id]
    );
    return res.rows[0];
  },

  async findAll({ limit = 20, offset = 0, user_id = null, severity_level = null, status = null } = {}) {
    // Cap limit at 100
    const cappedLimit = Math.min(limit, 100);
    
    let query = 'SELECT * FROM incident_reports WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(user_id);
    }

    if (severity_level) {
      paramCount++;
      query += ` AND severity_level = $${paramCount}`;
      params.push(severity_level);
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    const res = await pool.query(query, params);
    return res.rows;
  },

  async findByUserId(user_id, { limit = 20, offset = 0 } = {}) {
    const cappedLimit = Math.min(limit, 100);
    const res = await pool.query(
      'SELECT * FROM incident_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [user_id, cappedLimit, offset]
    );
    return res.rows;
  },

  async update(report_id, { incident_type, severity_level, description, latitude, longitude, media_url, status }) {
    const res = await pool.query(
      'UPDATE incident_reports SET incident_type = $1, severity_level = $2, description = $3, latitude = $4, longitude = $5, media_url = $6, status = $7 WHERE report_id = $8 RETURNING *',
      [incident_type, severity_level, description, latitude, longitude, media_url, status, report_id]
    );
    return res.rows[0];
  },

  async delete(report_id) {
    const res = await pool.query(
      'DELETE FROM incident_reports WHERE report_id = $1 RETURNING *',
      [report_id]
    );
    return res.rows[0];
  },

  /**
   * Create AI classification record
   */
  async createClassification({
    report_id,
    predicted_type,
    predicted_severity,
    confidence_score,
    low_confidence_flag = false,
    is_duplicate = false,
    is_override = false,
    retry_count = 0
  }) {
    const res = await pool.query(
      `INSERT INTO ai_classifications(
        report_id, predicted_type, predicted_severity, confidence_score,
        low_confidence_flag, is_duplicate, is_override, retry_count
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [report_id, predicted_type, predicted_severity, confidence_score, low_confidence_flag, is_duplicate, is_override, retry_count]
    );
    return res.rows[0];
  },

  /**
   * Get AI classification for an incident
   */
  async getClassificationByReportId(report_id) {
    const res = await pool.query(
      'SELECT * FROM ai_classifications WHERE report_id = $1 ORDER BY processed_at DESC LIMIT 1',
      [report_id]
    );
    return res.rows[0];
  },

  /**
   * Update incident with AI classification results
   */
  async updateWithAiResults(report_id, {
    incident_type,
    severity_level,
    transcription = null,
    ai_pending = false,
    ai_attempted = true
  }) {
    const res = await pool.query(
      `UPDATE incident_reports 
       SET incident_type = $1, severity_level = $2, transcription = $3, 
           ai_pending = $4, ai_attempted = $5
       WHERE report_id = $6 RETURNING *`,
      [incident_type, severity_level, transcription, ai_pending, ai_attempted, report_id]
    );
    return res.rows[0];
  },

  /**
   * Mark incident as AI pending (for retry)
   */
  async markAiPending(report_id, ai_pending = true) {
    const res = await pool.query(
      `UPDATE incident_reports 
       SET ai_pending = $1, ai_attempted = TRUE 
       WHERE report_id = $2 RETURNING *`,
      [ai_pending, report_id]
    );
    return res.rows[0];
  },

  /**
   * Get all incidents pending AI classification (for retry job)
   */
  async getPendingAiClassifications(limit = 50) {
    const res = await pool.query(
      `SELECT ir.*, ac.retry_count 
       FROM incident_reports ir
       LEFT JOIN ai_classifications ac ON ir.report_id = ac.report_id
       WHERE ir.ai_pending = TRUE 
         AND ir.audio_path IS NOT NULL
         AND (ac.retry_count IS NULL OR ac.retry_count < 3)
       ORDER BY ir.created_at ASC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  },

  /**
   * Update AI classification retry count
   */
  async updateClassificationRetryCount(report_id, retry_count) {
    const res = await pool.query(
      `UPDATE ai_classifications 
       SET retry_count = $1 
       WHERE report_id = $2 RETURNING *`,
      [retry_count, report_id]
    );
    return res.rows[0];
  },

  /**
   * Get incidents with low confidence classifications (for human review)
   */
  async getLowConfidenceIncidents(limit = 20, offset = 0) {
    const res = await pool.query(
      `SELECT ir.*, ac.* 
       FROM incident_reports ir
       INNER JOIN ai_classifications ac ON ir.report_id = ac.report_id
       WHERE ac.low_confidence_flag = TRUE
       ORDER BY ir.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows;
  }
};

module.exports = Incident;
