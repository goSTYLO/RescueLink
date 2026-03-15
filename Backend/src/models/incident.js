const pool = require('../config/db');
const { decrypt } = require('../utils/encryption');
const { ROLES } = require('../config/roles');

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

function decodeReporterFields(row, options = {}) {
  if (!row || typeof row !== 'object') {
    return row;
  }

  const includeDescription = options.includeDescription !== false;
  const includeTranscription = options.includeTranscription !== false;
  const includeReporterPhone = options.includeReporterPhone !== false;

  function safeParseNumber(value) {
    const v = tryDecryptValue(value);
    if (v === null || v === undefined) return v;
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    const n = Number(s);
    return Number.isNaN(n) ? v : n;
  }

  return {
    ...row,
    reporter_first_name: tryDecryptValue(row.reporter_first_name),
    reporter_last_name: tryDecryptValue(row.reporter_last_name),
    reporter_phone: includeReporterPhone ? tryDecryptValue(row.reporter_phone) : row.reporter_phone,
    description: includeDescription ? tryDecryptValue(row.description) : row.description,
    transcription: includeTranscription ? tryDecryptValue(row.transcription) : row.transcription,
    barangay: tryDecryptValue(row.barangay),
    latitude: safeParseNumber(row.latitude),
    longitude: safeParseNumber(row.longitude),
  };
}

const INCIDENT_STATUS_FLOW = {
  pending: new Set(['verified']),
  verified: new Set(['in_progress']),
  in_progress: new Set(['resolved']),
  resolved: new Set(['closed']),
  closed: new Set([]),
};

function normalizeIncidentStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'in-progress') return 'in_progress';
  if (Object.hasOwn(INCIDENT_STATUS_FLOW, normalized)) return normalized;
  return 'pending';
}

function createIncidentStateError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = status;
  return error;
}

function normalizeActorRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (!normalized) return '';
  if (['super-admin', 'superadmin', 'super admin'].includes(normalized)) return ROLES.ADMIN;
  return normalized;
}

const Incident = {
  async create({ user_id, incident_type = null, severity_level, description = null, latitude, longitude, barangay = null, media_url = null, status = 'pending' }) {
    const res = await pool.query(
      'INSERT INTO incident_reports(user_id, incident_type, severity_level, description, latitude, longitude, barangay, media_url, status) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [user_id, incident_type, severity_level, description, latitude, longitude, barangay, media_url, status]
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
    barangay = null,
    transcription = null,
    audio_path = null,
    media_paths = [],
    ai_pending = false,
    ai_attempted = false,
    scan_status = 'pending',
    scan_engine = null,
    scan_error = null,
    status = 'pending' 
  }) {
    try {
      const res = await pool.query(
        `INSERT INTO incident_reports(
          user_id, incident_type, severity_level, description, latitude, longitude, barangay,
          transcription, audio_path, media_paths, ai_pending, ai_attempted,
          scan_status, scan_engine, scan_error, status
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
        [
          user_id, incident_type, severity_level, description, latitude, longitude, barangay,
          transcription, audio_path, JSON.stringify(media_paths), ai_pending, ai_attempted,
          scan_status, scan_engine, scan_error, status
        ]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /scan_status|scan_engine|scan_error/i.test(error.message)) {
        const fallbackRes = await pool.query(
          `INSERT INTO incident_reports(
            user_id, incident_type, severity_level, description, latitude, longitude, barangay,
            transcription, audio_path, media_paths, ai_pending, ai_attempted, status
          ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
          [
            user_id, incident_type, severity_level, description, latitude, longitude, barangay,
            transcription, audio_path, JSON.stringify(media_paths), ai_pending, ai_attempted, status
          ]
        );
        return fallbackRes.rows[0];
      }
      throw error;
    }
  },

  async findById(report_id) {
    const res = await pool.query(
      `SELECT ir.*, u.first_name AS reporter_first_name, u.last_name AS reporter_last_name, u.phone_number AS reporter_phone
       FROM incident_reports ir
       LEFT JOIN users u ON ir.user_id = u.user_id
       WHERE ir.report_id = $1`,
      [report_id]
    );
    return decodeReporterFields(res.rows[0]);
  },

  async findAll({
    limit = 20,
    offset = 0,
    user_id = null,
    severity_level = null,
    status = null,
    incident_type = null,
    barangay = null,
    department_code = null,
    exclude_duplicates = false,
    search = null,
    exclude_report_id = null,
  } = {}) {
    // Keep incident list payloads bounded to protect API latency under encrypted datasets.
    const cappedLimit = Math.min(limit, 60);

    let query = `SELECT ir.report_id, ir.user_id, ir.incident_type, ir.severity_level, ir.status,
                        ir.description, ir.latitude, ir.longitude, ir.barangay, ir.created_at,
                        ir.ai_pending, ir.ai_attempted, ir.is_duplicate, ir.parent_report_id, ir.flagged_for_review,
                        u.first_name AS reporter_first_name, u.last_name AS reporter_last_name, u.phone_number AS reporter_phone
      FROM incident_reports ir
      LEFT JOIN users u ON ir.user_id = u.user_id
      WHERE 1=1`;
    const params = [];
    let paramCount = 0;

    if (department_code) {
      paramCount++;
      query += ` AND ir.report_id IN (SELECT report_id FROM dispatches WHERE department_code = $${paramCount})`;
      params.push(department_code);
    }

    if (user_id) {
      paramCount++;
      query += ` AND ir.user_id = $${paramCount}`;
      params.push(user_id);
    }

    if (severity_level) {
      paramCount++;
      query += ` AND ir.severity_level = $${paramCount}`;
      params.push(severity_level);
    }

    if (status) {
      paramCount++;
      query += ` AND ir.status = $${paramCount}`;
      params.push(status);
    }

    if (incident_type) {
      paramCount++;
      query += ` AND ir.incident_type = $${paramCount}`;
      params.push(incident_type);
    }

    if (barangay) {
      paramCount++;
      query += ` AND ir.barangay = $${paramCount}`;
      params.push(barangay);
    }

    if (exclude_duplicates) {
      query += ` AND (ir.is_duplicate IS NULL OR ir.is_duplicate = FALSE)`;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const searchTerm = search.trim();
      const reportIdNum = parseInt(searchTerm, 10);
      if (!Number.isNaN(reportIdNum) && String(reportIdNum) === searchTerm) {
        paramCount++;
        query += ` AND ir.report_id = $${paramCount}`;
        params.push(reportIdNum);
      } else {
        paramCount++;
        query += ` AND (ir.description ILIKE $${paramCount} OR ir.barangay ILIKE $${paramCount})`;
        params.push(`%${searchTerm}%`);
      }
    }

    if (exclude_report_id != null && Number.isInteger(Number(exclude_report_id))) {
      paramCount++;
      query += ` AND ir.report_id != $${paramCount}`;
      params.push(Number(exclude_report_id));
    }

    query += ` ORDER BY ir.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    const res = await pool.query(query, params);
    return res.rows.map((row) => decodeReporterFields(row, {
      includeDescription: false,
      includeTranscription: false,
      includeReporterPhone: false,
    }));
  },

  async findByUserId(
    user_id,
    { limit = 20, offset = 0, severity_level = null, status = null, incident_type = null, barangay = null } = {}
  ) {
    const cappedLimit = Math.min(limit, 100);
    let query = 'SELECT * FROM incident_reports WHERE user_id = $1';
    const params = [user_id];
    let paramCount = 1;

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

    if (incident_type) {
      paramCount++;
      query += ` AND incident_type = $${paramCount}`;
      params.push(incident_type);
    }

    if (barangay) {
      paramCount++;
      query += ` AND barangay = $${paramCount}`;
      params.push(barangay);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);
    const res = await pool.query(query, params);
    return res.rows.map(decodeReporterFields);
  },

  async countAll({ user_id = null, severity_level = null, status = null, incident_type = null, barangay = null, department_code = null, exclude_duplicates = false, search = null, exclude_report_id = null } = {}) {
    let query = 'SELECT COUNT(*)::int AS total FROM incident_reports WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (department_code) {
      paramCount++;
      query += ` AND report_id IN (SELECT report_id FROM dispatches WHERE department_code = $${paramCount})`;
      params.push(department_code);
    }

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

    if (incident_type) {
      paramCount++;
      query += ` AND incident_type = $${paramCount}`;
      params.push(incident_type);
    }

    if (barangay) {
      paramCount++;
      query += ` AND barangay = $${paramCount}`;
      params.push(barangay);
    }

    if (exclude_duplicates) {
      query += ` AND (is_duplicate IS NULL OR is_duplicate = FALSE)`;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const searchTerm = search.trim();
      const reportIdNum = parseInt(searchTerm, 10);
      if (!Number.isNaN(reportIdNum) && String(reportIdNum) === searchTerm) {
        paramCount++;
        query += ` AND report_id = $${paramCount}`;
        params.push(reportIdNum);
      } else {
        paramCount++;
        query += ` AND (description ILIKE $${paramCount} OR barangay ILIKE $${paramCount})`;
        params.push(`%${searchTerm}%`);
      }
    }

    if (exclude_report_id != null && Number.isInteger(Number(exclude_report_id))) {
      paramCount++;
      query += ` AND report_id != $${paramCount}`;
      params.push(Number(exclude_report_id));
    }

    const res = await pool.query(query, params);
    return Number(res.rows?.[0]?.total || 0);
  },

  async update(report_id, { incident_type, severity_level, description, latitude, longitude, barangay, media_url, status }) {
    const res = await pool.query(
      'UPDATE incident_reports SET incident_type = $1, severity_level = $2, description = $3, latitude = $4, longitude = $5, barangay = $6, media_url = $7, status = $8 WHERE report_id = $9 RETURNING *',
      [incident_type, severity_level, description, latitude, longitude, barangay, media_url, status, report_id]
    );
    return res.rows[0];
  },

  async updateClassification(report_id, { incident_type, severity_level }) {
    try {
      const res = await pool.query(
        `UPDATE incident_reports
         SET incident_type = $1,
             severity_level = $2,
             primary_classification = $1
         WHERE report_id = $3
         RETURNING *`,
        [incident_type, severity_level, report_id]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /primary_classification/i.test(error.message)) {
        const fallback = await pool.query(
          `UPDATE incident_reports
           SET incident_type = $1, severity_level = $2
           WHERE report_id = $3
           RETURNING *`,
          [incident_type, severity_level, report_id]
        );
        return fallback.rows[0];
      }
      throw error;
    }
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
    secondary_predicted_type = null,
    secondary_confidence_score = null,
    low_confidence_flag = false,
    is_duplicate = false,
    is_override = false,
    retry_count = 0
  }) {
    try {
      const res = await pool.query(
        `INSERT INTO ai_classifications(
          report_id, predicted_type, predicted_severity, confidence_score,
          secondary_predicted_type, secondary_confidence_score,
          low_confidence_flag, is_duplicate, is_override, retry_count
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          report_id,
          predicted_type,
          predicted_severity,
          confidence_score,
          secondary_predicted_type,
          secondary_confidence_score,
          low_confidence_flag,
          is_duplicate,
          is_override,
          retry_count,
        ]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /secondary_predicted_type|secondary_confidence_score/i.test(error.message)) {
        const fallback = await pool.query(
          `INSERT INTO ai_classifications(
            report_id, predicted_type, predicted_severity, confidence_score,
            low_confidence_flag, is_duplicate, is_override, retry_count
          ) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [report_id, predicted_type, predicted_severity, confidence_score, low_confidence_flag, is_duplicate, is_override, retry_count]
        );
        return fallback.rows[0];
      }
      throw error;
    }
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
    primary_classification = null,
    primary_confidence = null,
    secondary_classification = null,
    secondary_confidence = null,
    transcription = null,
    ai_pending = false,
    ai_attempted = true
  }) {
    try {
      const res = await pool.query(
        `UPDATE incident_reports 
         SET incident_type = $1, severity_level = $2, primary_classification = $3, primary_confidence = $4,
             secondary_classification = $5, secondary_confidence = $6, transcription = $7,
             ai_pending = $8, ai_attempted = $9
         WHERE report_id = $10 RETURNING *`,
        [
          incident_type,
          severity_level,
          primary_classification,
          primary_confidence,
          secondary_classification,
          secondary_confidence,
          transcription,
          ai_pending,
          ai_attempted,
          report_id,
        ]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /primary_classification|secondary_classification/i.test(error.message)) {
        const fallback = await pool.query(
          `UPDATE incident_reports
           SET incident_type = $1, severity_level = $2, transcription = $3,
               ai_pending = $4, ai_attempted = $5
           WHERE report_id = $6 RETURNING *`,
          [incident_type, severity_level, transcription, ai_pending, ai_attempted, report_id]
        );
        return fallback.rows[0];
      }
      throw error;
    }
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

  async updateScanStatus(report_id, {
    scan_status,
    scan_engine = null,
    scan_error = null,
    scanned_at = null,
    quarantined = false,
    quarantine_reason = null,
  }) {
    try {
      const res = await pool.query(
        `UPDATE incident_reports
         SET scan_status = $1,
             scan_engine = $2,
             scan_error = $3,
             scanned_at = $4,
             quarantined = $5,
             quarantine_reason = $6
         WHERE report_id = $7
         RETURNING *`,
        [scan_status, scan_engine, scan_error, scanned_at, quarantined, quarantine_reason, report_id]
      );

      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /scan_status|scan_engine|scan_error|scanned_at|quarantine/i.test(error.message)) {
        const fallback = await pool.query(
          'SELECT * FROM incident_reports WHERE report_id = $1',
          [report_id]
        );
        return fallback.rows[0] || null;
      }
      throw error;
    }
  },

  async getPendingFileScans(limit = 50) {
    const res = await pool.query(
      `SELECT *
       FROM incident_reports
       WHERE (scan_status = 'pending' OR scan_status = 'unscanned')
         AND quarantined = FALSE
         AND (
           audio_path IS NOT NULL
           OR (
             media_paths IS NOT NULL
             AND NULLIF(TRIM(media_paths::text), '') IS NOT NULL
             AND TRIM(media_paths::text) NOT IN ('[]', '{}', 'null')
           )
         )
       ORDER BY created_at ASC
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
  },

  /**
   * Mark incident as verified (dispatcher-confirmed) and set status to 'verified'
   */
  async setVerified(report_id) {
    const res = await pool.query(
      'UPDATE incident_reports SET verified = TRUE, status = $2 WHERE report_id = $1 RETURNING *',
      [report_id, 'verified']
    );
    return res.rows[0];
  },

  async transitionStatus(report_id, { next_status, actor_user_id = null, actor_role = null } = {}) {
    const normalizedNext = normalizeIncidentStatus(next_status);
    let currentResult;
    try {
      currentResult = await pool.query(
        `SELECT report_id, status, reporter_confirmed_at
         FROM incident_reports
         WHERE report_id = $1`,
        [report_id]
      );
    } catch (error) {
      if (error.code === '42703' || /reporter_confirmed_at/i.test(error.message)) {
        currentResult = await pool.query(
          `SELECT report_id, status
           FROM incident_reports
           WHERE report_id = $1`,
          [report_id]
        );
      } else {
        throw error;
      }
    }
    const incident = currentResult.rows[0];
    if (!incident) {
      return null;
    }

    const currentStatus = normalizeIncidentStatus(incident.status);
    if (currentStatus === normalizedNext) {
      throw createIncidentStateError(
        'INCIDENT_STATUS_ALREADY_SET',
        `Incident is already in "${normalizedNext}" status.`,
        409
      );
    }

    const allowedTargets = INCIDENT_STATUS_FLOW[currentStatus] || new Set();
    if (!allowedTargets.has(normalizedNext)) {
      throw createIncidentStateError(
        'INCIDENT_INVALID_TRANSITION',
        `Invalid status transition: ${currentStatus} -> ${normalizedNext}.`,
        400
      );
    }

    const resolvedByUserId = normalizedNext === 'resolved' ? actor_user_id : null;
    const actorRole = normalizeActorRole(actor_role);
    const canResolve = [ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN].includes(actorRole);
    if (normalizedNext === 'resolved' && (!actor_user_id || !canResolve)) {
      throw createIncidentStateError(
        'INCIDENT_RESOLVE_ROLE_REQUIRED',
        'Only dispatcher, admin, or department admin can mark incident as resolved.',
        403
      );
    }

    if (normalizedNext === 'closed' && !incident.reporter_confirmed_at) {
      throw createIncidentStateError(
        'INCIDENT_CLOSE_CONFIRMATION_REQUIRED',
        'Incident can only be closed after reporter confirmation.',
        400
      );
    }

    try {
      const updated = await pool.query(
        `UPDATE incident_reports
         SET status = $2,
             verified = CASE WHEN $3 IN ('verified', 'in_progress', 'resolved', 'closed') THEN TRUE ELSE verified END,
             resolved_by_user_id = CASE WHEN $3 = 'resolved' THEN $4 ELSE resolved_by_user_id END,
             resolved_at = CASE WHEN $3 = 'resolved' THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE resolved_at END,
             closed_at = CASE WHEN $3 = 'closed' THEN COALESCE(closed_at, CURRENT_TIMESTAMP) ELSE closed_at END,
             closed_by_user_id = CASE WHEN $3 = 'closed' THEN COALESCE($4, closed_by_user_id) ELSE closed_by_user_id END,
             closure_method = CASE WHEN $3 = 'closed' THEN COALESCE(closure_method, 'manual') ELSE closure_method END
         WHERE report_id = $1
         RETURNING *`,
        [report_id, normalizedNext, normalizedNext, resolvedByUserId]
      );
      return updated.rows[0] || null;
    } catch (error) {
      if (error.code === '42703' || /resolved_by_user_id|resolved_at|closed_at|closed_by_user_id|closure_method/i.test(error.message)) {
        try {
          const fallbackWithResolvedBy = await pool.query(
            `UPDATE incident_reports
             SET status = $2,
                 verified = CASE WHEN $3 IN ('verified', 'in_progress', 'resolved', 'closed') THEN TRUE ELSE verified END,
                 resolved_by_user_id = CASE WHEN $3 = 'resolved' THEN $4 ELSE resolved_by_user_id END,
                 resolved_at = CASE WHEN $3 = 'resolved' THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE resolved_at END
             WHERE report_id = $1
             RETURNING *`,
            [report_id, normalizedNext, normalizedNext, resolvedByUserId]
          );
          return fallbackWithResolvedBy.rows[0] || null;
        } catch (fallbackError) {
          if (fallbackError.code === '42703' || /resolved_by_user_id|resolved_at/i.test(fallbackError.message)) {
            const fallbackWithoutResolvedBy = await pool.query(
              `UPDATE incident_reports
               SET status = $2,
                   verified = CASE WHEN $3 IN ('verified', 'in_progress', 'resolved', 'closed') THEN TRUE ELSE verified END
               WHERE report_id = $1
               RETURNING *`,
              [report_id, normalizedNext, normalizedNext]
            );
            return fallbackWithoutResolvedBy.rows[0] || null;
          }
          throw fallbackError;
        }
      }
      throw error;
    }
  },

  async confirmResolution(report_id, reporter_user_id) {
    let currentResult;
    try {
      currentResult = await pool.query(
        `SELECT report_id, user_id, status, reporter_confirmed_at
         FROM incident_reports
         WHERE report_id = $1`,
        [report_id]
      );
    } catch (error) {
      if (error.code === '42703' || /reporter_confirmed_at/i.test(error.message)) {
        currentResult = await pool.query(
          `SELECT report_id, user_id, status, NULL::timestamp AS reporter_confirmed_at
           FROM incident_reports
           WHERE report_id = $1`,
          [report_id]
        );
      } else {
        throw error;
      }
    }
    const incident = currentResult.rows[0];
    if (!incident) {
      return null;
    }

    if (Number(incident.user_id) !== Number(reporter_user_id)) {
      throw createIncidentStateError(
        'INCIDENT_CONFIRMATION_OWNERSHIP',
        'Only the reporting user can confirm this incident resolution.',
        403
      );
    }

    const currentStatus = normalizeIncidentStatus(incident.status);
    if (currentStatus === 'closed' && incident.reporter_confirmed_at) {
      return incident;
    }

    if (currentStatus !== 'resolved') {
      throw createIncidentStateError(
        'INCIDENT_CONFIRMATION_INVALID_STATUS',
        'Incident can only be confirmed after it is resolved.',
        400
      );
    }

    if (incident.reporter_confirmed_at) {
      return incident;
    }

    try {
      const updated = await pool.query(
        `UPDATE incident_reports
         SET reporter_confirmed_at = CURRENT_TIMESTAMP,
             reporter_confirmed_by_user_id = $2,
             status = 'closed',
             verified = TRUE,
             closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
             closed_by_user_id = COALESCE(closed_by_user_id, $2),
             closure_method = COALESCE(closure_method, 'auto_from_reporter_confirmation')
         WHERE report_id = $1
         RETURNING *`,
        [report_id, reporter_user_id]
      );
      return updated.rows[0] || null;
    } catch (error) {
      if (error.code === '42703' || /reporter_confirmed|closed_at|closed_by_user_id|closure_method/i.test(error.message)) {
        try {
          const fallbackWithReporterFields = await pool.query(
            `UPDATE incident_reports
             SET reporter_confirmed_at = CURRENT_TIMESTAMP,
                 reporter_confirmed_by_user_id = $2,
                 status = 'closed',
                 verified = TRUE
             WHERE report_id = $1
             RETURNING *`,
            [report_id, reporter_user_id]
          );
          return fallbackWithReporterFields.rows[0] || null;
        } catch (fallbackError) {
          if (fallbackError.code === '42703' || /reporter_confirmed_at|reporter_confirmed_by_user_id/i.test(fallbackError.message)) {
            const fallbackStatusOnly = await pool.query(
              `UPDATE incident_reports
               SET status = 'closed',
                   verified = TRUE
               WHERE report_id = $1
               RETURNING *`,
              [report_id]
            );
            return fallbackStatusOnly.rows[0] || null;
          }
          throw fallbackError;
        }
      }
      throw error;
    }
  },

  /**
   * Create blockchain record for verified incident
   */
  async createBlockchainRecord({ report_id, hash_value, network_reference }) {
    const res = await pool.query(
      'INSERT INTO blockchain_records (report_id, hash_value, network_reference) VALUES ($1, $2, $3) RETURNING *',
      [report_id, hash_value, network_reference]
    );
    return res.rows[0];
  },

  /**
   * Get blockchain record for an incident
   */
  async getBlockchainRecord(report_id) {
    const res = await pool.query(
      'SELECT * FROM blockchain_records WHERE report_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [report_id]
    );
    return res.rows[0];
  }
};

module.exports = Incident;
