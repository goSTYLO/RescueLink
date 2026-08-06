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

const RESPONDER_STATUSES = ['Assigned', 'En Route', 'On Scene', 'Resolved'];
const STATUS_TRANSITIONS = {
  Assigned:   ['En Route'],
  'En Route': ['On Scene'],
  'On Scene': ['Resolved'],
  Resolved:   [],
};

const ALERT_RADIUS_KM = parseFloat(process.env.RESPONDER_ALERT_RADIUS_KM || '10');

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

// ─── Helper: emit WebSocket event via app-level broadcaster ──────────────────
function emitWs(req, event, data) {
  const broadcaster = req.app?.locals?.broadcast;
  if (typeof broadcaster === 'function') {
    broadcaster(event, data);
  }
}

// ─── Helper: emit WS event to a specific user_id only ────────────────────────
function emitWsToUser(req, userId, event, data) {
  const broadcastToUser = req.app?.locals?.broadcastToUser;
  if (typeof broadcastToUser === 'function') {
    broadcastToUser(userId, event, data);
  }
}

// ─── POST /api/incidents/:id/accept ──────────────────────────────────────────
async function acceptIncident(req, res) {
  try {
    const reportId = validateInteger(req.params.id, 'report ID');
    const userId = req.user.user_id;

    // Verify responder is registered and online
    const responderRow = await pool.query(
      'SELECT responder_online, latitude, longitude FROM users WHERE user_id = $1',
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
    const { latitude: rLat, longitude: rLon } = responderRow.rows[0];
    if (rLat != null && rLon != null && incident.latitude != null && incident.longitude != null) {
      const dist = haversineKm(rLat, rLon, incident.latitude, incident.longitude);
      if (dist > ALERT_RADIUS_KM) {
        return res.status(403).json({ error: `Incident is ${dist.toFixed(1)} km away — outside your alert radius (${ALERT_RADIUS_KM} km).` });
      }
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
    emitWs(req, 'incident:accepted', { report_id: reportId, accepted_by_name: acceptedByName, accepted_at: now });

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

    await pool.query(
      'UPDATE incident_reports SET responder_status = $1 WHERE report_id = $2',
      [newStatus, reportId]
    );

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

    emitWs(req, 'responder:status_changed', { report_id: reportId, old_status: currentStatus, new_status: newStatus });

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
async function getActiveAssigned(req, res) {
  try {
    const userId = req.user.user_id;
    const result = await pool.query(
      `SELECT report_id, incident_type, severity_level, barangay, latitude, longitude,
              description, status, responder_status, accepted_at, created_at
         FROM incident_reports
        WHERE accepted_by_user_id = $1
          AND (responder_status IS NULL OR responder_status != 'Resolved')
        ORDER BY accepted_at DESC`,
      [userId]
    );
    res.json(result.rows);
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

module.exports = {
  acceptIncident,
  declineIncident,
  updateResponderStatus,
  requestBackup,
  getBackupRequests,
  getActiveAssigned,
  getResponderHistory,
};
