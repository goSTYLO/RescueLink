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
const User = require('../models/user');
const Department = require('../models/department');
const Dispatch = require('../models/dispatch');
const { ROLES } = require('../config/roles');

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
    has_pending_backup: Boolean(row.has_pending_backup),
    latest_backup_status: row.latest_backup_status || null,
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
        status VARCHAR(20) DEFAULT 'pending',
        acknowledged_by_user_id INTEGER REFERENCES users(user_id),
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
      ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS acknowledged_by_user_id INTEGER REFERENCES users(user_id);
      ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE;
      UPDATE backup_requests SET status = 'pending' WHERE status IS NULL;
      ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS broadcast_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS broadcast_count INTEGER DEFAULT 0;
      CREATE TABLE IF NOT EXISTS backup_responses (
        id SERIAL PRIMARY KEY,
        backup_request_id INTEGER NOT NULL REFERENCES backup_requests(id) ON DELETE CASCADE,
        report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'joined'
          CHECK (status IN ('joined', 'declined', 'withdrawn')),
        responder_status VARCHAR(50) DEFAULT 'Assigned'
          CHECK (responder_status IN ('Assigned', 'En Route', 'On Scene', 'Resolved')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (backup_request_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_backup_responses_report_joined
        ON backup_responses(report_id, status)
        WHERE status = 'joined';
      CREATE INDEX IF NOT EXISTS idx_backup_responses_user_joined
        ON backup_responses(user_id, status)
        WHERE status = 'joined';
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

const GLOBAL_STAFF_ROLES = new Set([
  ROLES.DISPATCHER,
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
  'supervisor',
  'Supervisor',
  'super-admin',
  'superadmin',
  'Super Admin',
]);

const DEPARTMENT_STAFF_ROLES = new Set([
  ROLES.DEPARTMENT_ADMIN,
  ROLES.DEPARTMENT_HEAD,
  ROLES.PERSONNEL,
  'department-admin',
  'department-head',
  'personnel',
]);

async function getAssignedDepartmentUserIds(reportId) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT u.user_id
         FROM dispatches d
         JOIN departments dept ON LOWER(dept.code) = LOWER(d.department_code)
         JOIN users u ON u.department_id = dept.department_id
        WHERE d.report_id = $1
          AND u.role IN ('department-admin', 'department-head', 'personnel')`,
      [reportId]
    );
    return result.rows.map((row) => row.user_id).filter((id) => id != null);
  } catch (err) {
    console.warn('getAssignedDepartmentUserIds warning:', err.message);
    return [];
  }
}

async function notifyStaffBackupRequest(reportId, message) {
  try {
    const staffResult = await pool.query(
      `SELECT user_id FROM users
        WHERE role IN ('dispatcher', 'admin', 'supervisor', 'Supervisor', 'super-admin', 'superadmin', 'Super Admin')`
    );
    const deptUserIds = await getAssignedDepartmentUserIds(reportId);
    const targetIds = new Set([
      ...staffResult.rows.map((row) => row.user_id),
      ...deptUserIds,
    ]);
    await Promise.all(
      [...targetIds].map((user_id) =>
        Notification.create({
          user_id,
          report_id: reportId,
          message,
          sent_via: 'websocket',
          event_type: 'backup_requested',
        }).catch(() => {})
      )
    );
  } catch (err) {
    console.warn('notifyStaffBackupRequest warning:', err.message);
  }
}

async function loadBackupResponseExclusions(backupRequestId) {
  if (!backupRequestId) return new Set();
  try {
    const result = await pool.query(
      `SELECT user_id FROM backup_responses
        WHERE backup_request_id = $1 AND status IN ('joined', 'declined')`,
      [backupRequestId]
    );
    return new Set(result.rows.map((row) => Number(row.user_id)));
  } catch (_) {
    return new Set();
  }
}

async function findEligibleNearbyVolunteerUserIds(reportId, backupRequestId, incident) {
  const incLat = parseCoordinate(incident.latitude);
  const incLon = parseCoordinate(incident.longitude);
  const incidentType = incident.incident_type;
  const excluded = await loadBackupResponseExclusions(backupRequestId);
  if (incident.accepted_by_user_id != null) {
    excluded.add(Number(incident.accepted_by_user_id));
  }

  try {
    const reporterRes = await pool.query(
      'SELECT user_id FROM incident_reports WHERE report_id = $1',
      [reportId]
    );
    if (reporterRes.rows[0]?.user_id != null) {
      excluded.add(Number(reporterRes.rows[0].user_id));
    }
  } catch (_) {}

  let volunteers;
  try {
    volunteers = await pool.query(
      `SELECT u.user_id, u.latitude, u.longitude, r.supported_incident_types
         FROM users u
         LEFT JOIN responders r ON r.user_id = u.user_id
        WHERE u.role = 'volunteer' AND COALESCE(u.responder_online, FALSE) = TRUE`
    );
  } catch (err) {
    if (err.code !== '42703') throw err;
    volunteers = await pool.query(
      `SELECT u.user_id, NULL::double precision AS latitude, NULL::double precision AS longitude,
              r.supported_incident_types
         FROM users u
         LEFT JOIN responders r ON r.user_id = u.user_id
        WHERE u.role = 'volunteer' AND COALESCE(u.responder_online, FALSE) = TRUE`
    );
  }

  const eligible = [];
  for (const row of volunteers.rows) {
    const uid = Number(row.user_id);
    if (excluded.has(uid)) continue;
    if (!incidentMatchesVolunteerSpecialization(incidentType, row.supported_incident_types)) continue;
    const rLat = parseCoordinate(row.latitude);
    const rLon = parseCoordinate(row.longitude);
    if (!isWithinVolunteerRadius(rLat, rLon, incLat, incLon)) continue;
    eligible.push(uid);
  }
  return eligible;
}

async function notifyVolunteersBackupAlert(reportId, backupRequestId, message, userIds) {
  await Promise.all(
    userIds.map((user_id) =>
      Notification.create({
        user_id,
        report_id: reportId,
        message,
        sent_via: 'websocket',
        event_type: 'backup_alert',
      }).catch(() => {})
    )
  );
}

async function emitNearbyBackupAlert(req, reportId, backupRequestId, incident, requestedByName, notes) {
  const payload = {
    ...buildIncidentEventPayload({
      report_id: reportId,
      user_id: incident.user_id ?? null,
      incident_type: incident.incident_type,
      severity_level: incident.severity_level,
      barangay: incident.barangay,
      description: incident.description ?? null,
      latitude: incident.latitude,
      longitude: incident.longitude,
      accepted_by_user_id: incident.accepted_by_user_id,
      responder_status: incident.responder_status ?? null,
      status: incident.status,
      created_at: incident.created_at ?? null,
    }),
    backup_request_id: backupRequestId,
    is_backup: true,
    requested_by_name: requestedByName,
    notes: notes || null,
  };
  emitWs(req, 'responder:backup_alert', payload);

  const eligibleIds = await findEligibleNearbyVolunteerUserIds(reportId, backupRequestId, incident);
  const alertMessage = `Backup needed for Incident #${reportId}. ${requestedByName} requested nearby volunteer support.`;
  await notifyVolunteersBackupAlert(reportId, backupRequestId, alertMessage, eligibleIds);

  await pool.query(
    `UPDATE backup_requests
        SET broadcast_at = CURRENT_TIMESTAMP,
            broadcast_count = $2
      WHERE id = $1`,
    [backupRequestId, eligibleIds.length]
  );
  return eligibleIds.length;
}

async function attachBackupVolunteers(incident, reportId) {
  if (!incident || reportId == null) return incident;
  try {
    const result = await pool.query(
      `SELECT brs.user_id, brs.responder_status, brs.status, brs.created_at, brs.updated_at,
              brs.backup_request_id,
              u.first_name, u.last_name, u.phone_number,
              TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS name
         FROM backup_responses brs
         JOIN users u ON u.user_id = brs.user_id
        WHERE brs.report_id = $1 AND brs.status = 'joined'
        ORDER BY brs.created_at ASC`,
      [reportId]
    );
    incident.backup_volunteers = result.rows.map((row) => ({
      user_id: row.user_id,
      name: row.name || 'Volunteer',
      first_name: row.first_name,
      last_name: row.last_name,
      phone_number: row.phone_number,
      responder_status: row.responder_status,
      backup_request_id: row.backup_request_id,
      joined_at: row.created_at,
      updated_at: row.updated_at,
    }));
    incident.backup_volunteer_count = incident.backup_volunteers.length;
  } catch (err) {
    if (err.code !== '42P01') {
      console.warn('attachBackupVolunteers warning:', err.message);
    }
    incident.backup_volunteers = [];
    incident.backup_volunteer_count = 0;
  }
  return incident;
}

async function loadBackupRequestContext(reportId, backupId) {
  const result = await pool.query(
    `SELECT br.*, ir.accepted_by_user_id, ir.status AS incident_status,
            ir.latitude, ir.longitude, ir.incident_type, ir.user_id AS reporter_user_id
       FROM backup_requests br
       JOIN incident_reports ir ON ir.report_id = br.report_id
      WHERE br.id = $1 AND br.report_id = $2`,
    [backupId, reportId]
  );
  return result.rows[0] || null;
}

function isIncidentActiveForBackup(incidentStatus, responderStatus) {
  const status = String(incidentStatus || '').toLowerCase();
  if (status === 'closed' || status === 'resolved') return false;
  if (String(responderStatus || '') === 'Resolved') return false;
  return true;
}

async function assertVolunteerOnline(userId) {
  try {
    const row = await pool.query(
      'SELECT responder_online FROM users WHERE user_id = $1',
      [userId]
    );
    if (!row.rows[0]?.responder_online) {
      const err = new Error('You must be online to respond to backup requests.');
      err.statusCode = 403;
      throw err;
    }
  } catch (err) {
    if (err.code === '42703') return;
    throw err;
  }
}

async function assertCanManageBackup(req, reportId) {
  const role = req.user?.role;
  if (GLOBAL_STAFF_ROLES.has(role)) return true;
  if (!DEPARTMENT_STAFF_ROLES.has(role)) return false;

  const fullUser = await User.findById(req.user.user_id);
  if (!fullUser?.department_id) return false;
  const dept = await Department.findById(fullUser.department_id);
  if (!dept?.code) return false;

  const dispatchCheck = await pool.query(
    'SELECT 1 FROM dispatches WHERE report_id = $1 AND LOWER(department_code) = LOWER($2) LIMIT 1',
    [reportId, dept.code]
  );
  return dispatchCheck.rows.length > 0;
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
    await ensurePhase3Schema();
    const reportId = validateInteger(req.params.id, 'report ID');
    const userId = req.user.user_id;
    const { target, notes } = req.body;

    const validTarget = validateAllowedValue(target, ['nearby_responders', 'cdrrmo', 'both'], 'target');
    const validNotes = notes ? validateString(notes, 'notes', 1, 500) : null;

    const incRow = await pool.query(
      `SELECT ir.accepted_by_user_id, ir.latitude, ir.longitude, ir.incident_type, ir.barangay,
              ir.severity_level, ir.status, ir.responder_status, ir.user_id, ir.description, ir.created_at
         FROM incident_reports ir WHERE ir.report_id = $1`,
      [reportId]
    );
    if (!incRow.rows[0]) return res.status(404).json({ error: 'Incident not found.' });
    const incident = incRow.rows[0];
    if (incident.accepted_by_user_id !== userId) {
      return res.status(403).json({ error: 'Only the primary responder can request backup.' });
    }
    if (await Dispatch.hasPrimaryTeamAssignment(reportId)) {
      return res.status(409).json({
        error: 'A formal team is already assigned. Volunteer backup is disabled.',
        code: 'TEAM_ALREADY_ASSIGNED',
      });
    }

    const insertResult = await pool.query(
      `INSERT INTO backup_requests(report_id, requested_by_user_id, target, notes, status)
       VALUES($1, $2, $3, $4, 'pending')
       RETURNING id, created_at`,
      [reportId, userId, validTarget, validNotes]
    );
    const backupRequestId = insertResult.rows[0]?.id;

    const nameRow = await pool.query(
      "SELECT first_name || ' ' || last_name AS full_name FROM users WHERE user_id = $1",
      [userId]
    );
    const requestedByName = nameRow.rows[0]?.full_name || 'Responder';
    const notifyMessage = `Backup requested for Incident #${reportId}. Target: ${validTarget}.`;
    await notifyStaffBackupRequest(reportId, notifyMessage);

    emitWs(req, 'responder:backup_requested', {
      report_id: reportId,
      backup_request_id: backupRequestId,
      target: validTarget,
      notes: validNotes,
      requested_by_name: requestedByName,
      incident_type: incident.incident_type,
      barangay: tryDecryptValue(incident.barangay),
      severity_level: incident.severity_level,
      accepted_by_user_id: incident.accepted_by_user_id,
    });

    let broadcastCount = 0;
    if (validTarget === 'nearby_responders' || validTarget === 'both') {
      broadcastCount = await emitNearbyBackupAlert(
        req,
        reportId,
        backupRequestId,
        incident,
        requestedByName,
        validNotes
      );
    }

    await logDispatcherAction(req, 'backup_requested', 'incident', reportId, {
      target: validTarget,
      backup_request_id: backupRequestId,
      broadcast_count: broadcastCount,
    });

    res.status(201).json({
      message: 'Backup request submitted.',
      report_id: reportId,
      target: validTarget,
      backup_request_id: backupRequestId,
      broadcast_count: broadcastCount,
    });
  } catch (err) {
    if (err.message?.includes('must be') || err.message?.includes('must not')) return res.status(400).json({ error: err.message });
    console.error('requestBackup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── GET /api/incidents/:id/backup ───────────────────────────────────────────
async function getBackupRequests(req, res) {
  try {
    await ensurePhase3Schema();
    const reportId = validateInteger(req.params.id, 'report ID');
    const requests = await pool.query(
      `SELECT br.*, u.first_name || ' ' || u.last_name AS requester_name,
              ack.first_name || ' ' || ack.last_name AS acknowledged_by_name
         FROM backup_requests br
         JOIN users u ON u.user_id = br.requested_by_user_id
         LEFT JOIN users ack ON ack.user_id = br.acknowledged_by_user_id
        WHERE br.report_id = $1
        ORDER BY br.created_at DESC`,
      [reportId]
    );

    const responses = await pool.query(
      `SELECT brs.*,
              u.first_name, u.last_name, u.phone_number,
              TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS name
         FROM backup_responses brs
         JOIN users u ON u.user_id = brs.user_id
        WHERE brs.report_id = $1
        ORDER BY brs.created_at ASC`,
      [reportId]
    );

    const responsesByRequest = new Map();
    for (const row of responses.rows) {
      const key = row.backup_request_id;
      if (!responsesByRequest.has(key)) responsesByRequest.set(key, []);
      responsesByRequest.get(key).push({
        id: row.id,
        user_id: row.user_id,
        name: row.name || 'Volunteer',
        first_name: row.first_name,
        last_name: row.last_name,
        phone_number: row.phone_number,
        status: row.status,
        responder_status: row.responder_status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    res.json(
      requests.rows.map((row) => ({
        ...row,
        responses: responsesByRequest.get(row.id) || [],
      }))
    );
  } catch (err) {
    if (err.message?.includes('must be')) return res.status(400).json({ error: err.message });
    console.error('getBackupRequests error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── POST /api/incidents/:id/backup/:backupId/join ─────────────────────────────
async function joinBackup(req, res) {
  try {
    await ensurePhase3Schema();
    const reportId = validateInteger(req.params.id, 'report ID');
    const backupId = validateInteger(req.params.backupId, 'backup request ID');
    const userId = req.user.user_id;

    const ctx = await loadBackupRequestContext(reportId, backupId);
    if (!ctx) return res.status(404).json({ error: 'Backup request not found.' });
    if (Number(ctx.accepted_by_user_id) === Number(userId)) {
      return res.status(403).json({ error: 'Primary responder cannot join their own backup request.' });
    }
    if (!isIncidentActiveForBackup(ctx.incident_status, ctx.responder_status)) {
      return res.status(409).json({ error: 'Incident is no longer active for backup joins.' });
    }

    await assertVolunteerOnline(userId);
    await assertResponderRadius(req, userId, ctx.latitude, ctx.longitude);
    const specRow = await pool.query(
      'SELECT supported_incident_types FROM responders WHERE user_id = $1',
      [userId]
    );
    if (!incidentMatchesVolunteerSpecialization(ctx.incident_type, specRow.rows[0]?.supported_incident_types)) {
      return res.status(403).json({ error: 'This incident type is outside your supported specializations.' });
    }

    const existing = await pool.query(
      `SELECT id, status FROM backup_responses WHERE backup_request_id = $1 AND user_id = $2`,
      [backupId, userId]
    );
    if (existing.rows[0]?.status === 'joined') {
      return res.status(409).json({ error: 'You have already joined this backup request.' });
    }
    if (existing.rows[0]?.status === 'declined') {
      return res.status(409).json({ error: 'You already declined this backup request.' });
    }

    const insert = await pool.query(
      `INSERT INTO backup_responses (backup_request_id, report_id, user_id, status, responder_status)
       VALUES ($1, $2, $3, 'joined', 'Assigned')
       ON CONFLICT (backup_request_id, user_id)
       DO UPDATE SET status = 'joined', responder_status = 'Assigned', updated_at = CURRENT_TIMESTAMP
       RETURNING id, responder_status, created_at`,
      [backupId, reportId, userId]
    );

    const nameRow = await pool.query(
      "SELECT first_name || ' ' || last_name AS full_name FROM users WHERE user_id = $1",
      [userId]
    );
    const volunteerName = nameRow.rows[0]?.full_name || 'Volunteer';

    emitWs(req, 'responder:backup_joined', {
      report_id: reportId,
      backup_request_id: backupId,
      backup_user_id: userId,
      volunteer_name: volunteerName,
      responder_status: insert.rows[0]?.responder_status || 'Assigned',
    });

    await logDispatcherAction(req, 'backup_joined', 'incident', reportId, {
      backup_request_id: backupId,
      backup_user_id: userId,
    });

    res.status(201).json({
      message: 'Joined backup request.',
      report_id: reportId,
      backup_request_id: backupId,
      backup_response_id: insert.rows[0]?.id,
      responder_status: insert.rows[0]?.responder_status || 'Assigned',
      volunteer_name: volunteerName,
    });
  } catch (err) {
    if (err.statusCode === 403) return res.status(403).json({ error: err.message });
    if (err.message?.includes('must be') || err.message?.includes('must not')) return res.status(400).json({ error: err.message });
    console.error('joinBackup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── POST /api/incidents/:id/backup/:backupId/decline ────────────────────────
async function declineBackup(req, res) {
  try {
    await ensurePhase3Schema();
    const reportId = validateInteger(req.params.id, 'report ID');
    const backupId = validateInteger(req.params.backupId, 'backup request ID');
    const userId = req.user.user_id;

    const ctx = await loadBackupRequestContext(reportId, backupId);
    if (!ctx) return res.status(404).json({ error: 'Backup request not found.' });

    await pool.query(
      `INSERT INTO backup_responses (backup_request_id, report_id, user_id, status, responder_status)
       VALUES ($1, $2, $3, 'declined', NULL)
       ON CONFLICT (backup_request_id, user_id)
       DO UPDATE SET status = 'declined', updated_at = CURRENT_TIMESTAMP`,
      [backupId, reportId, userId]
    );

    emitWs(req, 'responder:backup_declined', {
      report_id: reportId,
      backup_request_id: backupId,
      backup_user_id: userId,
    });

    res.json({ message: 'Backup request declined.', report_id: reportId, backup_request_id: backupId });
  } catch (err) {
    if (err.message?.includes('must be')) return res.status(400).json({ error: err.message });
    console.error('declineBackup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── POST /api/incidents/:id/backup/:backupId/withdraw ───────────────────────
async function withdrawBackup(req, res) {
  try {
    await ensurePhase3Schema();
    const reportId = validateInteger(req.params.id, 'report ID');
    const backupId = validateInteger(req.params.backupId, 'backup request ID');
    const userId = req.user.user_id;

    const existing = await pool.query(
      `SELECT id, status FROM backup_responses
        WHERE backup_request_id = $1 AND report_id = $2 AND user_id = $3`,
      [backupId, reportId, userId]
    );
    if (!existing.rows[0] || existing.rows[0].status !== 'joined') {
      return res.status(404).json({ error: 'Active backup assignment not found.' });
    }

    await pool.query(
      `UPDATE backup_responses
          SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [existing.rows[0].id]
    );

    emitWs(req, 'responder:backup_withdrawn', {
      report_id: reportId,
      backup_request_id: backupId,
      backup_user_id: userId,
    });

    res.json({ message: 'Withdrew from backup assignment.', report_id: reportId, backup_request_id: backupId });
  } catch (err) {
    if (err.message?.includes('must be')) return res.status(400).json({ error: err.message });
    console.error('withdrawBackup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── PATCH /api/incidents/:id/backup/:backupId/responder-status ────────────────
async function updateBackupResponderStatus(req, res) {
  try {
    await ensurePhase3Schema();
    const reportId = validateInteger(req.params.id, 'report ID');
    const backupId = validateInteger(req.params.backupId, 'backup request ID');
    const userId = req.user.user_id;
    const newStatus = validateAllowedValue(req.body.status, RESPONDER_STATUSES, 'status');

    const row = await pool.query(
      `SELECT id, responder_status FROM backup_responses
        WHERE backup_request_id = $1 AND report_id = $2 AND user_id = $3 AND status = 'joined'`,
      [backupId, reportId, userId]
    );
    if (!row.rows[0]) {
      return res.status(404).json({ error: 'Active backup assignment not found.' });
    }

    const currentStatus = row.rows[0].responder_status || 'Assigned';
    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: `Invalid transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'none'}.`,
      });
    }

    await pool.query(
      `UPDATE backup_responses
          SET responder_status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
      [newStatus, row.rows[0].id]
    );

    emitWs(req, 'responder:backup_status_changed', {
      report_id: reportId,
      backup_request_id: backupId,
      backup_user_id: userId,
      old_status: currentStatus,
      new_status: newStatus,
    });

    res.json({
      message: 'Backup responder status updated.',
      report_id: reportId,
      backup_request_id: backupId,
      old_status: currentStatus,
      new_status: newStatus,
    });
  } catch (err) {
    if (err.message?.includes('must be') || err.message?.includes('must not')) return res.status(400).json({ error: err.message });
    console.error('updateBackupResponderStatus error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─── PATCH /api/incidents/:id/backup/:backupId/acknowledge ───────────────────
async function acknowledgeBackupRequest(req, res) {
  try {
    await ensurePhase3Schema();
    const reportId = validateInteger(req.params.id, 'report ID');
    const backupId = validateInteger(req.params.backupId, 'backup request ID');
    const userId = req.user.user_id;

    const allowed = await assertCanManageBackup(req, reportId);
    if (!allowed) {
      return res.status(403).json({ error: 'You are not authorized to acknowledge backup for this incident.' });
    }

    const existing = await pool.query(
      `SELECT id, report_id, status FROM backup_requests WHERE id = $1 AND report_id = $2`,
      [backupId, reportId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Backup request not found.' });
    if (existing.rows[0].status === 'acknowledged') {
      return res.json({
        message: 'Backup request already acknowledged.',
        report_id: reportId,
        backup_request_id: backupId,
        status: 'acknowledged',
      });
    }

    const now = new Date().toISOString();
    await pool.query(
      `UPDATE backup_requests
          SET status = 'acknowledged',
              acknowledged_by_user_id = $1,
              acknowledged_at = $2
        WHERE id = $3 AND report_id = $4`,
      [userId, now, backupId, reportId]
    );

    emitWs(req, 'responder:backup_acknowledged', {
      report_id: reportId,
      backup_request_id: backupId,
      acknowledged_by_user_id: userId,
      acknowledged_at: now,
    });

    await logDispatcherAction(req, 'backup_acknowledged', 'incident', reportId, {
      backup_request_id: backupId,
    });

    res.json({
      message: 'Backup request acknowledged.',
      report_id: reportId,
      backup_request_id: backupId,
      status: 'acknowledged',
      acknowledged_at: now,
    });
  } catch (err) {
    if (err.message?.includes('must be')) return res.status(400).json({ error: err.message });
    console.error('acknowledgeBackupRequest error:', err);
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
              EXISTS (
                SELECT 1 FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                   AND COALESCE(br.status, 'pending') = 'pending'
              ) AS has_pending_backup,
              (
                SELECT br.status FROM backup_requests br
                 WHERE br.report_id = ir.report_id
                 ORDER BY br.created_at DESC
                 LIMIT 1
              ) AS latest_backup_status,
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
    let rows = filterNearbyOpenIncidents(
      mapped,
      userId,
      volunteerCoords.latitude,
      volunteerCoords.longitude
    );

    try {
      const backupResult = await pool.query(
        `SELECT ir.report_id, ir.incident_type, ir.severity_level, ir.barangay,
                ir.latitude, ir.longitude, ir.description, ir.status,
                ir.responder_status AS primary_responder_status,
                ir.accepted_at, ir.created_at, ir.accepted_by_user_id,
                brs.responder_status, brs.backup_request_id, brs.id AS backup_response_id,
                EXISTS (
                  SELECT 1 FROM backup_requests br
                   WHERE br.report_id = ir.report_id
                     AND COALESCE(br.status, 'pending') = 'pending'
                ) AS has_pending_backup,
                (
                  SELECT br.status FROM backup_requests br
                   WHERE br.report_id = ir.report_id
                   ORDER BY br.created_at DESC
                   LIMIT 1
                ) AS latest_backup_status
           FROM backup_responses brs
           JOIN incident_reports ir ON ir.report_id = brs.report_id
          WHERE brs.user_id = $1
            AND brs.status = 'joined'
            AND COALESCE(brs.responder_status, 'Assigned') != 'Resolved'`,
        [userId]
      );
      const existingIds = new Set(rows.map((row) => Number(row.report_id)));
      for (const row of backupResult.rows) {
        if (existingIds.has(Number(row.report_id))) continue;
        const mappedBackup = mapActiveIncidentRow(
          {
            ...row,
            responder_status: row.responder_status || 'Assigned',
          },
          volunteerCoords.latitude,
          volunteerCoords.longitude
        );
        rows.push({
          ...mappedBackup,
          is_backup_assignment: true,
          backup_request_id: row.backup_request_id,
          backup_response_id: row.backup_response_id,
        });
      }
    } catch (backupErr) {
      if (backupErr.code !== '42P01') {
        console.warn('getActiveAssigned backup merge warning:', backupErr.message);
      }
    }

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
    const isVolunteer = poolRow.rows.length > 0 || String(req.user.role || '').toLowerCase() === 'volunteer';
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
  joinBackup,
  declineBackup,
  withdrawBackup,
  updateBackupResponderStatus,
  acknowledgeBackupRequest,
  getActiveAssigned,
  getResponderHistory,
  getIncidentPreview,
  attachBackupVolunteers,
  ALERT_RADIUS_KM,
  incidentMatchesVolunteerSpecialization,
  isWithinVolunteerRadius,
  parseCoordinate,
  findEligibleNearbyVolunteerUserIds,
};
