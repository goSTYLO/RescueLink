/**
 * Incident Acceptance Controller — Phase 3
 * Handles responder-specific incident workflows:
 *   - Accept / Decline incident
 *   - Update responder field status (En Route, On Scene, Resolved)
 *   - Request backup
 *   - List active assigned / history
 */
const pool = require('../config/db');
const { validateInteger, validateString, validateAllowedValue, validatePagination } = require('../utils/validation');
const { logDispatcherAction } = require('../utils/auditLog');
const Notification = require('../models/notification');
const { buildIncidentEventPayload, emitIncidentEvent } = require('../utils/incidentEvents');
const { tryDecryptValue } = require('../utils/encryption');

const RESPONDER_STATUSES = ['Assigned', 'En Route', 'On Scene', 'Resolved'];
const STATUS_TRANSITIONS = {
  Assigned:   ['En Route'],
  'En Route': ['On Scene'],
  'On Scene': ['Resolved'],
  Resolved:   [],
};

const ALERT_RADIUS_KM = parseFloat(process.env.RESPONDER_ALERT_RADIUS_KM || '10');

/** Parse latitude/longitude that may be stored as numbers or encrypted text. */
function parseCoordinate(value) {
  const decrypted = tryDecryptValue(value);
  if (decrypted === null || decrypted === undefined) return null;
  if (typeof decrypted === 'number') {
    return Number.isFinite(decrypted) ? decrypted : null;
  }
  const text = String(decrypted).trim();
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Avoid casting encrypted coordinate strings to float8 in SQL. */
function sqlSafeDouble(columnRef) {
  return `(CASE WHEN ${columnRef}::text ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${columnRef}::text)::double precision ELSE NULL END)`;
}

function mapActiveIncidentRow(row, volunteerLat, volunteerLon) {
  const latitude = parseCoordinate(row.latitude);
  const longitude = parseCoordinate(row.longitude);
  let distance_km = row.distance_km != null ? Number(row.distance_km) : null;
  if (
    (distance_km == null || Number.isNaN(distance_km))
    && latitude != null
    && longitude != null
    && volunteerLat != null
    && volunteerLon != null
  ) {
    distance_km = Math.round(haversineKm(volunteerLat, volunteerLon, latitude, longitude) * 10) / 10;
  }
  return {
    ...row,
    latitude,
    longitude,
    distance_km: Number.isFinite(distance_km) ? distance_km : null,
  };
}

function filterNearbyOpenIncidents(rows, userId, volunteerLat, volunteerLon) {
  return rows.filter((row) => {
    const acceptedBy = row.accepted_by_user_id != null ? Number(row.accepted_by_user_id) : null;
    if (acceptedBy === userId) return true;
    if (acceptedBy != null) return false;

    if (volunteerLat == null || volunteerLon == null) return true;
    if (row.latitude == null || row.longitude == null) return false;

    const distance = row.distance_km ?? haversineKm(volunteerLat, volunteerLon, row.latitude, row.longitude);
    return distance <= ALERT_RADIUS_KM;
  });
}

async function loadVolunteerCoordinates(userId) {
  try {
    const result = await pool.query(
      'SELECT latitude, longitude FROM users WHERE user_id = $1',
      [userId]
    );
    const row = result.rows[0] || {};
    return {
      latitude: parseCoordinate(row.latitude),
      longitude: parseCoordinate(row.longitude),
    };
  } catch (err) {
    if (err.code === '42703') {
      return { latitude: null, longitude: null };
    }
    throw err;
  }
}

// ─── Self-healing DB Schema Helper ──────────────────────────────────────────
async function ensurePhase3Schema() {
  try {
    await pool.query(`
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_online BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS accepted_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
      ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS responder_status VARCHAR(50);
      ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'incident';
      CREATE TABLE IF NOT EXISTS responder_status_history (
        id SERIAL PRIMARY KEY,
        report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
        updated_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
        old_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS backup_requests (
        id SERIAL PRIMARY KEY,
        report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
        requested_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
        target VARCHAR(50) NOT NULL CHECK (target IN ('nearby_responders', 'cdrrmo', 'both')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.warn('ensurePhase3Schema warning:', err.message);
  }
}

// ─── Haversine distance (km) ─────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Mirrors websocket/responder alert specialization rules for tests and docs. */
function incidentMatchesVolunteerSpecialization(incidentType, supportedTypes) {
  if (!Array.isArray(supportedTypes) || supportedTypes.length === 0) return true;
  const normalized = String(incidentType || '').trim().toLowerCase();
  if (normalized === 'sos') return true;
  return supportedTypes.some((entry) => String(entry || '').trim().toLowerCase() === normalized);
}

/** Mirrors radius skip rules: no volunteer coords means no radius filter. */
function isWithinVolunteerRadius(volunteerLat, volunteerLon, incidentLat, incidentLon, radiusKm = ALERT_RADIUS_KM) {
  if (volunteerLat == null || volunteerLon == null || incidentLat == null || incidentLon == null) {
    return true;
  }
  return haversineKm(volunteerLat, volunteerLon, incidentLat, incidentLon) <= radiusKm;
}

// ─── Helper: emit WebSocket event via app-level broadcaster ──────────────────
function emitWs(req, event, data) {
  const wss = req.app?.locals?.wss;
  if (wss?.broadcast) {
    wss.broadcast(event, data).catch(() => {});
  }
}

// ─── Helper: emit WS event to a specific user_id only ────────────────────────
function emitWsToUser(req, userId, event, data) {
  const broadcastToUser = req.app?.locals?.broadcastToUser;
  if (typeof broadcastToUser === 'function') {
    broadcastToUser(userId, event, data);
  }
}

// ─── Helper: radius check when responder location columns exist ────────────────
async function assertResponderRadius(req, userId, incidentLat, incidentLon) {
  const lat = parseCoordinate(incidentLat);
  const lon = parseCoordinate(incidentLon);
  if (lat == null || lon == null) return;
  try {
    const responderRow = await pool.query(
      'SELECT latitude, longitude FROM users WHERE user_id = $1',
      [userId]
    );
    const rLat = parseCoordinate(responderRow.rows[0]?.latitude);
    const rLon = parseCoordinate(responderRow.rows[0]?.longitude);
    if (rLat != null && rLon != null) {
      const dist = haversineKm(rLat, rLon, lat, lon);
      if (dist > ALERT_RADIUS_KM) {
        const err = new Error(`Incident is ${dist.toFixed(1)} km away — outside your alert radius (${ALERT_RADIUS_KM} km).`);
        err.statusCode = 403;
        throw err;
      }
    }
  } catch (err) {
    if (err.code === '42703') return;
    throw err;
  }
}

// ─── POST /api/incidents/:id/accept ──────────────────────────────────────────
async function acceptIncident(req, res) {
  try {
    const reportId = validateInteger(req.params.id, 'report ID');
    const userId = req.user.user_id;

    // Verify responder is registered and online
    const responderRow = await pool.query(
      'SELECT responder_online FROM users WHERE user_id = $1',
      [userId]
    );
    if (!responderRow.rows[0]) return res.status(404).json({ error: 'Responder user not found.' });
    if (!responderRow.rows[0].responder_online) {
      return res.status(403).json({ error: 'You must be online to accept incidents.' });
    }

    // Load incident
    const incRow = await pool.query(
      'SELECT report_id, accepted_by_user_id, status, latitude, longitude FROM incident_reports WHERE report_id = $1',
      [reportId]
    );
    if (!incRow.rows[0]) return res.status(404).json({ error: 'Incident not found.' });
    const incident = incRow.rows[0];

    if (incident.accepted_by_user_id) {
      return res.status(409).json({ error: 'This incident has already been accepted by another responder.' });
    }
    if (['resolved', 'closed'].includes(String(incident.status).toLowerCase())) {
      return res.status(409).json({ error: 'Cannot accept a resolved or closed incident.' });
    }

    // Radius check (only when responder has a registered location)
    try {
      await assertResponderRadius(req, userId, incident.latitude, incident.longitude);
    } catch (radiusErr) {
      if (radiusErr.statusCode === 403) {
        return res.status(403).json({ error: radiusErr.message });
      }
      throw radiusErr;
    }

    // Atomic acceptance
    const now = new Date().toISOString();
    await pool.query(
      `UPDATE incident_reports
         SET accepted_by_user_id = $1, responder_status = 'Assigned', accepted_at = $2
       WHERE report_id = $3 AND accepted_by_user_id IS NULL`,
      [userId, now, reportId]
    );

    // Re-check — someone else may have accepted in the tiny race window
    const confirm = await pool.query(
      'SELECT accepted_by_user_id FROM incident_reports WHERE report_id = $1',
      [reportId]
    );
    if (confirm.rows[0]?.accepted_by_user_id !== userId) {
      return res.status(409).json({ error: 'Race condition: incident accepted by another responder simultaneously.' });
    }

    // Write initial history entry
    await pool.query(
      `INSERT INTO responder_status_history(report_id, updated_by_user_id, old_status, new_status)
       VALUES($1, $2, NULL, 'Assigned')`,
      [reportId, userId]
    );

    // Notify reporter
    await Notification.create({
      user_id: incident.user_id || userId,
      report_id: reportId,
      message: 'A responder has accepted your incident report and is on the way.',
      sent_via: 'websocket',
      event_type: 'responder_assigned',
      category: 'responder_alert',
    }).catch(() => {});

    // WS broadcast
    const nameRow = await pool.query(
      "SELECT first_name || ' ' || last_name AS full_name FROM users WHERE user_id = $1",
      [userId]
    );
    const acceptedByName = nameRow.rows[0]?.full_name || 'Responder';
    // WS broadcast — include reporter_id so the citizen receives the event
    const reporterRow = await pool.query(
      'SELECT user_id FROM incident_reports WHERE report_id = $1',
      [reportId]
    );
    const reporterId = reporterRow.rows[0]?.user_id ?? null;
    emitWs(req, 'incident:accepted', {
      report_id: reportId,
      reporter_id: reporterId,
      accepted_by_name: acceptedByName,
      accepted_at: now,
      responder_status: 'Assigned',
    });

    await logDispatcherAction(req, 'incident_accepted', 'incident', reportId, { accepted_by_user_id: userId });

    res.json({ message: 'Incident accepted.', report_id: reportId, responder_status: 'Assigned', accepted_at: now });
  } catch (err) {
    if (err.message?.includes('must be')) return res.status(400).json({ error: err.message });
    console.error('acceptIncident error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── POST /api/incidents/:id/decline ─────────────────────────────────────────
async function declineIncident(req, res) {
  try {
    const reportId = validateInteger(req.params.id, 'report ID');
    const userId = req.user.user_id;

    await logDispatcherAction(req, 'incident_declined', 'incident', reportId, { declined_by_user_id: userId });

    res.json({ message: 'Incident declined.', report_id: reportId });
  } catch (err) {
    if (err.message?.includes('must be')) return res.status(400).json({ error: err.message });
    console.error('declineIncident error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── PATCH /api/incidents/:id/responder-status ───────────────────────────────
async function updateResponderStatus(req, res) {
  try {
    const reportId = validateInteger(req.params.id, 'report ID');
    const userId = req.user.user_id;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: 'status is required.' });
    const newStatus = validateAllowedValue(status, RESPONDER_STATUSES, 'status');

    // Load incident and verify ownership
    const incRow = await pool.query(
      'SELECT accepted_by_user_id, responder_status FROM incident_reports WHERE report_id = $1',
      [reportId]
    );
    if (!incRow.rows[0]) return res.status(404).json({ error: 'Incident not found.' });
    const incident = incRow.rows[0];

    if (incident.accepted_by_user_id !== userId) {
      return res.status(403).json({ error: 'You are not the primary responder for this incident.' });
    }

    const currentStatus = incident.responder_status || 'Assigned';
    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: `Invalid transition: ${currentStatus} → ${newStatus}. Allowed next: ${allowed.join(', ') || 'none'}.`,
      });
    }

    if (newStatus === 'Resolved') {
      await pool.query(
        `UPDATE incident_reports
            SET responder_status = $1,
                status = 'resolved',
                verified = TRUE,
                resolved_by_user_id = $2,
                resolved_at = CURRENT_TIMESTAMP
          WHERE report_id = $3`,
        [newStatus, userId, reportId]
      );
    } else {
      await pool.query(
        'UPDATE incident_reports SET responder_status = $1 WHERE report_id = $2',
        [newStatus, reportId]
      );
    }

    await pool.query(
      `INSERT INTO responder_status_history(report_id, updated_by_user_id, old_status, new_status)
       VALUES($1, $2, $3, $4)`,
      [reportId, userId, currentStatus, newStatus]
    );

    // Notify reporter of status change
    await Notification.create({
      user_id: (await pool.query('SELECT user_id FROM incident_reports WHERE report_id = $1', [reportId])).rows[0]?.user_id,
      report_id: reportId,
      message: `Responder status updated to: ${newStatus}.`,
      sent_via: 'websocket',
      event_type: 'responder_status_updated',
      category: 'responder_alert',
    }).catch(() => {});

    const reporterRow = await pool.query(
      'SELECT user_id FROM incident_reports WHERE report_id = $1',
      [reportId]
    );
    const reporterId = reporterRow.rows[0]?.user_id ?? null;
    emitWs(req, 'responder:status_changed', {
      report_id: reportId,
      reporter_id: reporterId,
      old_status: currentStatus,
      new_status: newStatus,
      responder_status: newStatus,
    });

    if (newStatus === 'Resolved') {
      const updatedRow = await pool.query(
        'SELECT * FROM incident_reports WHERE report_id = $1',
        [reportId]
      );
      if (updatedRow.rows[0]) {
        emitIncidentEvent(req, 'incident:status_updated', updatedRow.rows[0]);
      }
    }

    res.json({ message: 'Status updated.', report_id: reportId, old_status: currentStatus, new_status: newStatus });
  } catch (err) {
    if (err.message?.includes('must be') || err.message?.includes('must not')) return res.status(400).json({ error: err.message });
    console.error('updateResponderStatus error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── POST /api/incidents/:id/backup ──────────────────────────────────────────
async function requestBackup(req, res) {
  try {
    const reportId = validateInteger(req.params.id, 'report ID');
    const userId = req.user.user_id;
    const { target, notes } = req.body;

    const validTarget = validateAllowedValue(target, ['nearby_responders', 'cdrrmo', 'both'], 'target');
    const validNotes = notes ? validateString(notes, 'notes', 1, 500) : null;

    // Verify caller is the primary responder
    const incRow = await pool.query(
      'SELECT accepted_by_user_id, latitude, longitude FROM incident_reports WHERE report_id = $1',
      [reportId]
    );
    if (!incRow.rows[0]) return res.status(404).json({ error: 'Incident not found.' });
    if (incRow.rows[0].accepted_by_user_id !== userId) {
      return res.status(403).json({ error: 'Only the primary responder can request backup.' });
    }

    await pool.query(
      `INSERT INTO backup_requests(report_id, requested_by_user_id, target, notes) VALUES($1, $2, $3, $4)`,
      [reportId, userId, validTarget, validNotes]
    );

    // Notify dispatcher
    await Notification.create({
      user_id: userId, // dispatcher-visible; actual routing is via WS
      report_id: reportId,
      message: `Backup requested for Incident #${reportId}. Target: ${validTarget}.`,
      sent_via: 'websocket',
      event_type: 'backup_requested',
      category: 'backup_request',
    }).catch(() => {});

    const nameRow = await pool.query(
      "SELECT first_name || ' ' || last_name AS full_name FROM users WHERE user_id = $1",
      [userId]
    );
    emitWs(req, 'responder:backup_requested', {
      report_id: reportId,
      target: validTarget,
      requested_by_name: nameRow.rows[0]?.full_name || 'Responder',
    });

    res.status(201).json({ message: 'Backup request submitted.', report_id: reportId, target: validTarget });
  } catch (err) {
    if (err.message?.includes('must be') || err.message?.includes('must not')) return res.status(400).json({ error: err.message });
    console.error('requestBackup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── GET /api/incidents/:id/backup ───────────────────────────────────────────
async function getBackupRequests(req, res) {
  try {
    const reportId = validateInteger(req.params.id, 'report ID');
    const result = await pool.query(
      `SELECT br.*, u.first_name || ' ' || u.last_name AS requester_name
         FROM backup_requests br
         JOIN users u ON u.user_id = br.requested_by_user_id
        WHERE br.report_id = $1
        ORDER BY br.created_at DESC`,
      [reportId]
    );
    res.json(result.rows);
  } catch (err) {
    if (err.message?.includes('must be')) return res.status(400).json({ error: err.message });
    console.error('getBackupRequests error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── GET /api/incidents/responder/active ─────────────────────────────────────
// Returns the volunteer's own active assignments plus nearby unaccepted open incidents
// matching supported_incident_types (SOS always included). Radius uses ALERT_RADIUS_KM.
function buildActiveAssignedSql(includeUserLocation) {
  const volunteerLat = includeUserLocation ? sqlSafeDouble('u.latitude') : 'NULL::double precision';
  const volunteerLon = includeUserLocation ? sqlSafeDouble('u.longitude') : 'NULL::double precision';
  const incidentLat = sqlSafeDouble('ir.latitude');
  const incidentLon = sqlSafeDouble('ir.longitude');

  return `WITH volunteer AS (
         SELECT u.user_id,
                ${volunteerLat} AS latitude,
                ${volunteerLon} AS longitude,
                COALESCE(r.supported_incident_types, ARRAY[]::text[]) AS supported_types
           FROM users u
           LEFT JOIN responders r ON r.user_id = u.user_id
          WHERE u.user_id = $1
       )
       SELECT ir.report_id,
              ir.incident_type,
              ir.severity_level,
              ir.barangay,
              ir.latitude,
              ir.longitude,
              ir.description,
              ir.status,
              ir.responder_status,
              ir.accepted_at,
              ir.created_at,
              ir.accepted_by_user_id,
              CASE
                WHEN v.latitude IS NOT NULL
                 AND v.longitude IS NOT NULL
                 AND ${incidentLat} IS NOT NULL
                 AND ${incidentLon} IS NOT NULL
                THEN ROUND(
                  (
                    6371 * 2 * ASIN(
                      SQRT(
                        POWER(SIN(RADIANS((${incidentLat} - v.latitude) / 2)), 2) +
                        COS(RADIANS(v.latitude)) * COS(RADIANS(${incidentLat})) *
                        POWER(SIN(RADIANS((${incidentLon} - v.longitude) / 2)), 2)
                      )
                    )
                  )::numeric,
                  1
                )
                ELSE NULL
              END AS distance_km
         FROM incident_reports ir
         CROSS JOIN volunteer v
        WHERE (
          ir.accepted_by_user_id = $1
          AND (ir.responder_status IS NULL OR ir.responder_status != 'Resolved')
        )
           OR (
          ir.accepted_by_user_id IS NULL
          AND LOWER(ir.status) IN ('pending', 'verified', 'in_progress')
          AND (
            COALESCE(array_length(v.supported_types, 1), 0) = 0
            OR LOWER(ir.incident_type) = 'sos'
            OR LOWER(ir.incident_type) = ANY(
              SELECT LOWER(unnest(v.supported_types))
            )
          )
          AND (
            v.latitude IS NULL
            OR v.longitude IS NULL
            OR ${incidentLat} IS NULL
            OR ${incidentLon} IS NULL
            OR (
              6371 * 2 * ASIN(
                SQRT(
                  POWER(SIN(RADIANS((${incidentLat} - v.latitude) / 2)), 2) +
                  COS(RADIANS(v.latitude)) * COS(RADIANS(${incidentLat})) *
                  POWER(SIN(RADIANS((${incidentLon} - v.longitude) / 2)), 2)
                )
              )
            ) <= $2
          )
        )
        ORDER BY
          CASE WHEN ir.accepted_by_user_id = $1 THEN 0 ELSE 1 END,
          distance_km NULLS LAST,
          ir.created_at DESC`;
}

async function queryActiveAssigned(userId) {
  try {
    return await pool.query(buildActiveAssignedSql(true), [userId, ALERT_RADIUS_KM]);
  } catch (err) {
    if (err.code !== '42703') throw err;
    return pool.query(buildActiveAssignedSql(false), [userId, ALERT_RADIUS_KM]);
  }
}

async function getActiveAssigned(req, res) {
  try {
    const userId = req.user.user_id;
    await ensurePhase3Schema();
    const volunteerCoords = await loadVolunteerCoordinates(userId);
    const result = await queryActiveAssigned(userId);
    const mapped = result.rows.map((row) =>
      mapActiveIncidentRow(row, volunteerCoords.latitude, volunteerCoords.longitude)
    );
    const rows = filterNearbyOpenIncidents(
      mapped,
      userId,
      volunteerCoords.latitude,
      volunteerCoords.longitude
    );
    res.json(rows);
  } catch (err) {
    console.error('getActiveAssigned error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── GET /api/incidents/responder/history ────────────────────────────────────
async function getResponderHistory(req, res) {
  try {
    const userId = req.user.user_id;
    const { limit, offset } = validatePagination(req.query.limit, req.query.offset);
    const result = await pool.query(
      `SELECT ir.report_id, ir.incident_type, ir.severity_level, ir.barangay,
              ir.status, ir.responder_status, ir.accepted_at, ir.created_at,
              (SELECT json_agg(h ORDER BY h.updated_at)
                 FROM responder_status_history h
                WHERE h.report_id = ir.report_id
                  AND h.updated_by_user_id = $1) AS status_history
         FROM incident_reports ir
        WHERE ir.accepted_by_user_id = $1
          AND ir.responder_status = 'Resolved'
        ORDER BY ir.accepted_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getResponderHistory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── GET /api/incidents/:id/responder-preview ────────────────────────────────
async function getIncidentPreview(req, res) {
  try {
    const reportId = validateInteger(req.params.id, 'report ID');
    const userId = req.user.user_id;

    const responderRow = await pool.query(
      'SELECT responder_online FROM users WHERE user_id = $1',
      [userId]
    );
    if (!responderRow.rows[0]) return res.status(404).json({ error: 'Responder user not found.' });

    const poolRow = await pool.query('SELECT user_id FROM responders WHERE user_id = $1', [userId]);
    const isVolunteer = poolRow.rows.length > 0 || String(req.user.role || '').toLowerCase() === 'responder';
    if (!isVolunteer) {
      return res.status(403).json({ error: 'Only registered responders can preview incidents.' });
    }

    const incRow = await pool.query(
      `SELECT ir.report_id, ir.user_id, ir.incident_type, ir.severity_level, ir.status,
              ir.barangay, ir.description, ir.transcription, ir.audio_path, ir.media_paths,
              ir.latitude, ir.longitude, ir.accepted_by_user_id, ir.created_at,
              u.first_name AS reporter_first_name, u.last_name AS reporter_last_name,
              u.phone_number AS reporter_phone
         FROM incident_reports ir
         JOIN users u ON u.user_id = ir.user_id
        WHERE ir.report_id = $1`,
      [reportId]
    );
    if (!incRow.rows[0]) return res.status(404).json({ error: 'Incident not found.' });
    const incident = incRow.rows[0];

    if (incident.accepted_by_user_id) {
      return res.status(409).json({ error: 'This incident has already been accepted by another responder.' });
    }
    if (['resolved', 'closed'].includes(String(incident.status).toLowerCase())) {
      return res.status(409).json({ error: 'Cannot preview a resolved or closed incident.' });
    }

    await assertResponderRadius(req, userId, incident.latitude, incident.longitude);

    let mediaPaths = incident.media_paths;
    if (typeof mediaPaths === 'string') {
      try {
        mediaPaths = JSON.parse(mediaPaths);
      } catch {
        mediaPaths = [];
      }
    }
    if (!Array.isArray(mediaPaths)) mediaPaths = [];

    const classRow = await pool.query(
      `SELECT predicted_type, confidence_score, low_confidence_flag,
              secondary_predicted_type, secondary_confidence_score
         FROM ai_classifications
        WHERE report_id = $1
        ORDER BY processed_at DESC
        LIMIT 1`,
      [reportId]
    );
    const classification = classRow.rows[0] || null;

    res.json({
      report_id: incident.report_id,
      incident_type: incident.incident_type,
      severity_level: incident.severity_level,
      status: incident.status,
      barangay: incident.barangay,
      description: incident.description || 'No description provided.',
      transcription: incident.transcription || null,
      audio_path: incident.audio_path || null,
      media_paths: mediaPaths,
      latitude: parseCoordinate(incident.latitude),
      longitude: parseCoordinate(incident.longitude),
      created_at: incident.created_at,
      updated_at: incident.created_at,
      reporter_first_name: incident.reporter_first_name,
      reporter_last_name: incident.reporter_last_name,
      reporter_phone: incident.reporter_phone,
      ai_classification: classification
        ? {
            predicted_type: classification.predicted_type,
            confidence_score: classification.confidence_score,
            low_confidence_flag: classification.low_confidence_flag,
            secondary_predicted_type: classification.secondary_predicted_type,
            secondary_confidence_score: classification.secondary_confidence_score,
          }
        : null,
    });
  } catch (err) {
    if (err.statusCode === 403) return res.status(403).json({ error: err.message });
    if (err.message?.includes('must be')) return res.status(400).json({ error: err.message });
    console.error('getIncidentPreview error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
  acceptIncident,
  declineIncident,
  updateResponderStatus,
  requestBackup,
  getBackupRequests,
  getActiveAssigned,
  getResponderHistory,
  getIncidentPreview,
  ALERT_RADIUS_KM,
  incidentMatchesVolunteerSpecialization,
  isWithinVolunteerRadius,
  parseCoordinate,
};
