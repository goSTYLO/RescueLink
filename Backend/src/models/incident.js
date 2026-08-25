const pool = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');
const { ROLES } = require('../config/roles');
const { incidentTypesFromRow } = require('../utils/incidentTypeNormalize');

const OPEN_BACKUP_STATUS_SQL = `COALESCE(br.status, 'pending') IN ('pending', 'acknowledged')`;

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

function tryEncryptValue(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  if (value.trim() === '') {
    return value;
  }
  // Don't double-encrypt
  if (looksEncryptedValue(value)) {
    return value;
  }
  try {
    const encrypted = encrypt(value);
    console.log(`[incident-model] Encrypted value of length ${value.length} to ${encrypted.length}`);
    return encrypted;
  } catch (err) {
    console.warn(`[incident-model] Encryption failed: ${err.message}, returning original value`);
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
    incident_types: incidentTypesFromRow(row),
    reporter_first_name: tryDecryptValue(row.reporter_first_name),
    reporter_last_name: tryDecryptValue(row.reporter_last_name),
    reporter_phone: includeReporterPhone ? tryDecryptValue(row.reporter_phone) : row.reporter_phone,
    accepted_by_first_name: tryDecryptValue(row.accepted_by_first_name),
    accepted_by_last_name: tryDecryptValue(row.accepted_by_last_name),
    accepted_by_phone: tryDecryptValue(row.accepted_by_phone),
    accepted_by_name: row.accepted_by_name
      ? tryDecryptValue(row.accepted_by_name)
      : [tryDecryptValue(row.accepted_by_first_name), tryDecryptValue(row.accepted_by_last_name)]
          .filter(Boolean)
          .join(' ')
          .trim() || null,
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

function isVolunteerResponderResolved(responderStatus) {
  return String(responderStatus || '').trim().toLowerCase() === 'resolved';
}

const Incident = {
  async create({ user_id, incident_type = null, severity_level, description = null, latitude, longitude, barangay = null, media_url = null, status = 'pending' }) {
    const res = await pool.query(
      'INSERT INTO incident_reports(user_id, incident_type, severity_level, description, latitude, longitude, barangay, media_url, status) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [user_id, incident_type, severity_level, tryEncryptValue(description), latitude, longitude, barangay, media_url, status]
    );
    return decodeReporterFields(res.rows[0]);
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
          user_id, incident_type, severity_level, tryEncryptValue(description), latitude, longitude, barangay,
          tryEncryptValue(transcription), audio_path, JSON.stringify(media_paths), ai_pending, ai_attempted,
          scan_status, scan_engine, scan_error, status
        ]
      );
      return decodeReporterFields(res.rows[0]);
    } catch (error) {
      if (error.code === '42703' || /scan_status|scan_engine|scan_error/i.test(error.message)) {
        const fallbackRes = await pool.query(
          `INSERT INTO incident_reports(
            user_id, incident_type, severity_level, description, latitude, longitude, barangay,
            transcription, audio_path, media_paths, ai_pending, ai_attempted, status
          ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
          [
            user_id, incident_type, severity_level, tryEncryptValue(description), latitude, longitude, barangay,
            tryEncryptValue(transcription), audio_path, JSON.stringify(media_paths), ai_pending, ai_attempted, status
          ]
        );
        return decodeReporterFields(fallbackRes.rows[0]);
      }
      throw error;
    }
  },

  async findById(report_id) {
    const res = await pool.query(
      `SELECT ir.*,
              u.first_name AS reporter_first_name,
              u.last_name AS reporter_last_name,
              u.phone_number AS reporter_phone,
              EXISTS (
                SELECT 1 FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                   AND COALESCE(br.status, 'pending') = 'pending'
              ) AS has_pending_backup,
              (
                SELECT br.id FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                   AND COALESCE(br.status, 'pending') = 'pending'
                 ORDER BY br.created_at DESC
                 LIMIT 1
              ) AS pending_backup_request_id,
              (
                SELECT br.status FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                 ORDER BY br.created_at DESC
                 LIMIT 1
              ) AS latest_backup_status,
              (
                SELECT br.target FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                   AND ${OPEN_BACKUP_STATUS_SQL}
                 ORDER BY br.created_at DESC
                 LIMIT 1
              ) AS pending_backup_target,
              (
                SELECT COALESCE(br.broadcast_count, 0) FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                   AND ${OPEN_BACKUP_STATUS_SQL}
                 ORDER BY br.created_at DESC
                 LIMIT 1
              ) AS pending_backup_broadcast_count,
              EXISTS (
                SELECT 1 FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                   AND ${OPEN_BACKUP_STATUS_SQL}
              ) AS has_open_backup_request,
              (
                SELECT br.id FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                   AND ${OPEN_BACKUP_STATUS_SQL}
                 ORDER BY br.created_at DESC
                 LIMIT 1
              ) AS active_backup_request_id,
              (
                SELECT br.status FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                   AND ${OPEN_BACKUP_STATUS_SQL}
                 ORDER BY br.created_at DESC
                 LIMIT 1
              ) AS open_backup_status,
              (
                SELECT COUNT(*)::int FROM backup_responses brsp
                 WHERE brsp.report_id = ir.report_id AND brsp.status = 'joined'
              ) AS backup_volunteer_count
       FROM incident_reports ir
       LEFT JOIN users u ON ir.user_id = u.user_id
       WHERE ir.report_id = $1`,
      [report_id]
    );
    const row = res.rows[0];
    if (!row) return null;
    const decoded = decodeReporterFields(row);
    return {
      ...decoded,
      has_pending_backup: Boolean(row.has_pending_backup),
      pending_backup_request_id: row.pending_backup_request_id != null
        ? Number(row.pending_backup_request_id)
        : null,
      latest_backup_status: row.latest_backup_status || null,
      pending_backup_target: row.pending_backup_target || null,
      pending_backup_broadcast_count: row.pending_backup_broadcast_count != null
        ? Number(row.pending_backup_broadcast_count)
        : null,
      backup_volunteer_count: row.backup_volunteer_count != null
        ? Number(row.backup_volunteer_count)
        : 0,
      has_open_backup_request: Boolean(row.has_open_backup_request),
      active_backup_request_id: row.active_backup_request_id != null
        ? Number(row.active_backup_request_id)
        : null,
      open_backup_status: row.open_backup_status || null,
    };
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
    volunteer_accepted = false,
    is_archived = false,
  } = {}) {
    // Keep incident list payloads bounded to protect API latency under encrypted datasets.
    const cappedLimit = Math.min(limit, 60);

    let query = `SELECT ir.report_id, ir.user_id, ir.incident_type, ir.incident_types, ir.severity_level, ir.status,
                        ir.description, ir.latitude, ir.longitude, ir.barangay, ir.created_at,
                        ir.ai_pending, ir.ai_attempted, ir.is_duplicate, ir.parent_report_id, ir.flagged_for_review,
                        ir.secondary_classification, ir.secondary_confidence,
                        ir.responder_status, ir.accepted_by_user_id, ir.accepted_at,
                        u.first_name AS reporter_first_name, u.last_name AS reporter_last_name, u.phone_number AS reporter_phone,
                        acceptor.first_name AS accepted_by_first_name,
                        acceptor.last_name AS accepted_by_last_name,
                        acceptor.phone_number AS accepted_by_phone,
                        TRIM(COALESCE(acceptor.first_name, '') || ' ' || COALESCE(acceptor.last_name, '')) AS accepted_by_name,
                        EXISTS (
                          SELECT 1 FROM backup_requests br
                           WHERE br.report_id = ir.report_id
                             AND COALESCE(br.status, 'pending') = 'pending'
                        ) AS has_pending_backup,
                        (
                          SELECT br.id FROM backup_requests br
                           WHERE br.report_id = ir.report_id
                             AND COALESCE(br.status, 'pending') = 'pending'
                           ORDER BY br.created_at DESC
                           LIMIT 1
                        ) AS pending_backup_request_id,
                        (
                          SELECT br.status FROM backup_requests br
                           WHERE br.report_id = ir.report_id
                           ORDER BY br.created_at DESC
                           LIMIT 1
                        ) AS latest_backup_status,
                        (
                          SELECT br.target FROM backup_requests br
                           WHERE br.report_id = ir.report_id
                             AND ${OPEN_BACKUP_STATUS_SQL}
                           ORDER BY br.created_at DESC
                           LIMIT 1
                        ) AS pending_backup_target,
                        (
                          SELECT COALESCE(br.broadcast_count, 0) FROM backup_requests br
                           WHERE br.report_id = ir.report_id
                             AND ${OPEN_BACKUP_STATUS_SQL}
                           ORDER BY br.created_at DESC
                           LIMIT 1
                        ) AS pending_backup_broadcast_count,
                        EXISTS (
                          SELECT 1 FROM backup_requests br
                           WHERE br.report_id = ir.report_id
                             AND ${OPEN_BACKUP_STATUS_SQL}
                        ) AS has_open_backup_request,
                        (
                          SELECT br.id FROM backup_requests br
                           WHERE br.report_id = ir.report_id
                             AND ${OPEN_BACKUP_STATUS_SQL}
                           ORDER BY br.created_at DESC
                           LIMIT 1
                        ) AS active_backup_request_id,
                        (
                          SELECT br.status FROM backup_requests br
                           WHERE br.report_id = ir.report_id
                             AND ${OPEN_BACKUP_STATUS_SQL}
                           ORDER BY br.created_at DESC
                           LIMIT 1
                        ) AS open_backup_status,
                        (
                          SELECT COUNT(*)::int FROM backup_responses brsp
                           WHERE brsp.report_id = ir.report_id AND brsp.status = 'joined'
                        ) AS backup_volunteer_count
      FROM incident_reports ir
      LEFT JOIN users u ON ir.user_id = u.user_id
      LEFT JOIN users acceptor ON acceptor.user_id = ir.accepted_by_user_id
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
      query += ` AND LOWER(ir.incident_type) = LOWER($${paramCount})`;
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

    if (volunteer_accepted) {
      query += ` AND ir.accepted_by_user_id IS NOT NULL`;
    }

    // Archive filter — default hides archived from active dashboard
    query += ` AND ir.is_archived = ${is_archived ? 'TRUE' : 'FALSE'}`;

    query += ` ORDER BY ir.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    const res = await pool.query(query, params);
    return res.rows.map((row) => {
      const decoded = decodeReporterFields(row, {
        includeDescription: false,
        includeTranscription: false,
        includeReporterPhone: false,
      });
      return {
        ...decoded,
        has_pending_backup: Boolean(row.has_pending_backup),
        pending_backup_request_id: row.pending_backup_request_id != null
          ? Number(row.pending_backup_request_id)
          : null,
        latest_backup_status: row.latest_backup_status || null,
        pending_backup_target: row.pending_backup_target || null,
        pending_backup_broadcast_count: row.pending_backup_broadcast_count != null
          ? Number(row.pending_backup_broadcast_count)
          : null,
        backup_volunteer_count: row.backup_volunteer_count != null
          ? Number(row.backup_volunteer_count)
          : 0,
        has_open_backup_request: Boolean(row.has_open_backup_request),
        active_backup_request_id: row.active_backup_request_id != null
          ? Number(row.active_backup_request_id)
          : null,
        open_backup_status: row.open_backup_status || null,
      };
    });
  },

  /**
   * Archive an incident. Only permitted when status = 'closed'.
   * Auto-called by updateStatus when transitioning to 'closed'.
   * Can also be called manually by a dispatcher.
   */
  async archive(report_id, { archived_by_user_id, archive_notes = null }) {
    const res = await pool.query(
      `UPDATE incident_reports
         SET is_archived = TRUE,
             archived_at = NOW(),
             archived_by_user_id = $2,
             archive_notes = $3
       WHERE report_id = $1
         AND status = 'closed'
       RETURNING *`,
      [report_id, archived_by_user_id, archive_notes]
    );
    return res.rows[0] ? decodeReporterFields(res.rows[0]) : null;
  },

  /** Restore an archived incident back to the active dashboard. */
  async unarchive(report_id) {
    const res = await pool.query(
      `UPDATE incident_reports
         SET is_archived = FALSE,
             archived_at = NULL,
             archived_by_user_id = NULL,
             archive_notes = NULL
       WHERE report_id = $1
         AND is_archived = TRUE
       RETURNING *`,
      [report_id]
    );
    return res.rows[0] ? decodeReporterFields(res.rows[0]) : null;
  },

  async findByUserId(
    user_id,
    options = {}
  ) {
    return this.findByUserInvolvement(user_id, { ...options, involvement: 'reported' });
  },

  async findByUserInvolvement(
    user_id,
    {
      limit = 20,
      offset = 0,
      severity_level = null,
      status = null,
      incident_type = null,
      barangay = null,
      involvement = 'reported',
    } = {}
  ) {
    const cappedLimit = Math.min(limit, 100);
    const normalizedInvolvement = ['reported', 'accepted', 'all'].includes(involvement)
      ? involvement
      : 'reported';

    let whereClause;
    switch (normalizedInvolvement) {
      case 'accepted':
        whereClause = 'accepted_by_user_id = $1';
        break;
      case 'all':
        whereClause = '(user_id = $1 OR accepted_by_user_id = $1)';
        break;
      default:
        whereClause = 'user_id = $1';
        break;
    }

    let query = `
      SELECT *,
        CASE
          WHEN user_id = $1 AND accepted_by_user_id = $1 THEN 'both'
          WHEN user_id = $1 THEN 'reported'
          WHEN accepted_by_user_id = $1 THEN 'accepted'
          ELSE NULL
        END AS involvement
      FROM incident_reports
      WHERE ${whereClause}`;
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
      query += ` AND LOWER(incident_type) = LOWER($${paramCount})`;
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

  async countAll({ user_id = null, severity_level = null, status = null, incident_type = null, barangay = null, department_code = null, exclude_duplicates = false, search = null, exclude_report_id = null, volunteer_accepted = false, is_archived = false } = {}) {
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
      query += ` AND LOWER(incident_type) = LOWER($${paramCount})`;
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

    if (volunteer_accepted) {
      query += ` AND accepted_by_user_id IS NOT NULL`;
    }

    // Archive filter
    query += ` AND is_archived = ${is_archived ? 'TRUE' : 'FALSE'}`;

    const res = await pool.query(query, params);
    return Number(res.rows?.[0]?.total || 0);
  },

  async update(report_id, { incident_type, severity_level, description, latitude, longitude, barangay, media_url, status }) {
    const res = await pool.query(
      'UPDATE incident_reports SET incident_type = $1, severity_level = $2, description = $3, latitude = $4, longitude = $5, barangay = $6, media_url = $7, status = $8 WHERE report_id = $9 RETURNING *',
      [incident_type, severity_level, tryEncryptValue(description), latitude, longitude, barangay, media_url, status, report_id]
    );
    return decodeReporterFields(res.rows[0]);
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
    stt_confidence = null,
    max_confidence_score = null,
    fallback_used = false,
    keyword_promoted = false,
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
          stt_confidence, max_confidence_score, fallback_used, keyword_promoted,
          low_confidence_flag, is_duplicate, is_override, retry_count
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          report_id,
          predicted_type,
          predicted_severity,
          confidence_score,
          secondary_predicted_type,
          secondary_confidence_score,
          stt_confidence,
          max_confidence_score,
          fallback_used,
          keyword_promoted,
          low_confidence_flag,
          is_duplicate,
          is_override,
          retry_count,
        ]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /secondary_predicted_type|secondary_confidence_score|stt_confidence|fallback_used|keyword_promoted|max_confidence_score/i.test(error.message)) {
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
   * List incidents that have stored audio (for bulk reclassification jobs).
   */
  async listIncidentsWithAudio({ reportId = null, limit = null, offset = 0 } = {}) {
    const params = [];
    let paramCount = 0;
    let query = `
      SELECT ir.report_id, ir.audio_path, ir.incident_type, ir.incident_types, ir.created_at,
             latest.is_override
      FROM incident_reports ir
      LEFT JOIN LATERAL (
        SELECT ac.is_override
        FROM ai_classifications ac
        WHERE ac.report_id = ir.report_id
        ORDER BY ac.processed_at DESC NULLS LAST, ac.classification_id DESC
        LIMIT 1
      ) latest ON true
      WHERE ir.audio_path IS NOT NULL AND btrim(ir.audio_path) <> ''
    `;

    if (reportId != null) {
      paramCount += 1;
      query += ` AND ir.report_id = $${paramCount}`;
      params.push(reportId);
    }

    query += ' ORDER BY ir.report_id ASC';

    if (limit != null) {
      paramCount += 1;
      query += ` LIMIT $${paramCount}`;
      params.push(limit);
      paramCount += 1;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);
    }

    const res = await pool.query(query, params);
    return res.rows;
  },

  /**
   * Persist a fresh AI classification run on incident + ai_classifications (append row).
   */
  async applyAiClassificationResult(report_id, aiResult, { is_override = false, retry_count = 0 } = {}) {
    await this.updateWithAiResults(report_id, {
      incident_type: aiResult.primaryType,
      severity_level: aiResult.severity,
      primary_classification: aiResult.primaryType,
      primary_confidence: aiResult.primaryConfidence,
      secondary_classification: aiResult.secondaryType,
      secondary_confidence: aiResult.secondaryConfidence,
      stt_confidence: aiResult.sttConfidence,
      incident_types: aiResult.incidentTypes,
      transcription: aiResult.transcription,
      ai_pending: false,
      ai_attempted: true,
    });

    return this.createClassification({
      report_id,
      predicted_type: aiResult.primaryType,
      predicted_severity: aiResult.severity,
      confidence_score: aiResult.primaryConfidence,
      secondary_predicted_type: aiResult.secondaryType,
      secondary_confidence_score: aiResult.secondaryConfidence,
      stt_confidence: aiResult.sttConfidence,
      max_confidence_score: aiResult.maxConfidence,
      fallback_used: aiResult.fallbackUsed,
      keyword_promoted: aiResult.keywordPromoted,
      low_confidence_flag: aiResult.lowConfidenceFlag,
      is_duplicate: false,
      is_override,
      retry_count,
    });
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
    stt_confidence = null,
    incident_types = [],
    transcription = null,
    ai_pending = false,
    ai_attempted = true
  }) {
    const normalizedIncidentTypes = Array.isArray(incident_types)
      ? incident_types.filter(Boolean)
      : [];

    try {
      const res = await pool.query(
        `UPDATE incident_reports 
         SET incident_type = $1, severity_level = $2, primary_classification = $3, primary_confidence = $4,
             secondary_classification = $5, secondary_confidence = $6, incident_types = $7, transcription = $8,
             stt_confidence = $9, ai_pending = $10, ai_attempted = $11
         WHERE report_id = $12 RETURNING *`,
        [
          incident_type,
          severity_level,
          primary_classification,
          primary_confidence,
          secondary_classification,
          secondary_confidence,
          normalizedIncidentTypes,
          transcription,
          stt_confidence,
          ai_pending,
          ai_attempted,
          report_id,
        ]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /primary_classification|secondary_classification|incident_types|stt_confidence/i.test(error.message)) {
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

  async transitionStatus(report_id, {
    next_status,
    actor_user_id = null,
    actor_role = null,
    allow_force_close = false,
    closure_notes = null,
    closure_method = null,
  } = {}) {
    const normalizedNext = normalizeIncidentStatus(next_status);
    let currentResult;
    try {
      currentResult = await pool.query(
        `SELECT report_id, status, reporter_confirmed_at, responder_status
         FROM incident_reports
         WHERE report_id = $1`,
        [report_id]
      );
    } catch (error) {
      if (error.code === '42703' || /reporter_confirmed_at|responder_status/i.test(error.message)) {
        try {
          currentResult = await pool.query(
            `SELECT report_id, status, reporter_confirmed_at
             FROM incident_reports
             WHERE report_id = $1`,
            [report_id]
          );
        } catch (innerError) {
          if (innerError.code === '42703' || /reporter_confirmed_at/i.test(innerError.message)) {
            currentResult = await pool.query(
              `SELECT report_id, status
               FROM incident_reports
               WHERE report_id = $1`,
              [report_id]
            );
          } else {
            throw innerError;
          }
        }
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

    const volunteerResolved = isVolunteerResponderResolved(incident.responder_status);
    const canForceCloseToClosed = allow_force_close
      && normalizedNext === 'closed'
      && (currentStatus === 'resolved' || volunteerResolved);

    if (!canForceCloseToClosed) {
      const allowedTargets = INCIDENT_STATUS_FLOW[currentStatus] || new Set();
      if (!allowedTargets.has(normalizedNext)) {
        throw createIncidentStateError(
          'INCIDENT_INVALID_TRANSITION',
          `Invalid status transition: ${currentStatus} -> ${normalizedNext}.`,
          400
        );
      }
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

    if (normalizedNext === 'closed' && !incident.reporter_confirmed_at && !allow_force_close) {
      throw createIncidentStateError(
        'INCIDENT_CLOSE_CONFIRMATION_REQUIRED',
        'Incident can only be closed after reporter confirmation.',
        400
      );
    }

    const normalizedClosureMethod = closure_method
      ? String(closure_method).trim().slice(0, 80)
      : null;
    const normalizedClosureNotes = closure_notes
      ? String(closure_notes).trim().slice(0, 2000)
      : null;

    const actorUserIdForClose = normalizedNext === 'closed' ? actor_user_id : resolvedByUserId;

    try {
      const updated = await pool.query(
        `UPDATE incident_reports
         SET status = $2,
             verified = CASE WHEN $3 IN ('verified', 'in_progress', 'resolved', 'closed') THEN TRUE ELSE verified END,
             resolved_by_user_id = CASE WHEN $3 = 'resolved' THEN $4 ELSE resolved_by_user_id END,
             resolved_at = CASE WHEN $3 IN ('resolved', 'closed') THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE resolved_at END,
             closed_at = CASE WHEN $3 = 'closed' THEN COALESCE(closed_at, CURRENT_TIMESTAMP) ELSE closed_at END,
             closed_by_user_id = CASE WHEN $3 = 'closed' THEN COALESCE($7, closed_by_user_id) ELSE closed_by_user_id END,
             closure_method = CASE WHEN $3 = 'closed' THEN COALESCE($5::varchar, closure_method, 'manual') ELSE closure_method END,
             closure_notes = CASE WHEN $3 = 'closed' AND $6::text IS NOT NULL THEN $6::text ELSE closure_notes END,
             is_archived = CASE WHEN $3 = 'closed' THEN TRUE ELSE is_archived END,
             archived_at = CASE WHEN $3 = 'closed' THEN COALESCE(archived_at, CURRENT_TIMESTAMP) ELSE archived_at END,
             archived_by_user_id = CASE WHEN $3 = 'closed' THEN COALESCE(archived_by_user_id, $7) ELSE archived_by_user_id END
         WHERE report_id = $1
         RETURNING *`,
        [report_id, normalizedNext, normalizedNext, resolvedByUserId, normalizedClosureMethod, normalizedClosureNotes, actorUserIdForClose]
      );
      return updated.rows[0] || null;
    } catch (error) {
      if (error.code === '42703' || /resolved_by_user_id|resolved_at|closed_at|closed_by_user_id|closure_method|closure_notes/i.test(error.message)) {
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
             closure_method = COALESCE(closure_method, 'auto_from_reporter_confirmation'),
             is_archived = TRUE,
             archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
             archived_by_user_id = COALESCE(archived_by_user_id, $2)
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
