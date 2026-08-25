/**
 * Persists incident/dispatch notifications to the database when WebSocket events are emitted.
 * Recipients mirror WebSocket broadcast logic: admins/dispatchers/supervisors get all;
 * department-scoped roles get events for their department; reporters get own incidents.
 */
const pool = require('../config/db');
const Notification = require('../models/notification');

async function getIncidentAssignedDepartmentIds(reportId) {
  if (!reportId) return [];
  try {
    const res = await pool.query(
      `SELECT DISTINCT d.department_id FROM dispatches dp
       JOIN departments d ON d.code = dp.department_code
       WHERE dp.report_id = $1`,
      [reportId]
    );
    return res.rows.map((r) => r.department_id).filter(Boolean);
  } catch {
    return [];
  }
}

function formatNotificationMessage(event, data) {
  const reportId = data?.report_id ?? data?.reportId;
  const incidentType = data?.incident_type || 'Incident';
  const severity = data?.severity_level ? ` (${data.severity_level})` : '';
  const barangay = data?.barangay ? ` in ${data.barangay}` : '';
  const status = data?.status ?? '';

  switch (event) {
    case 'incident:created':
      return `New ${incidentType} incident${severity} reported${barangay}`;
    case 'incident:status_updated':
      return reportId != null
        ? `Incident #${reportId} status changed to ${status || 'updated'}${barangay ? ` (${data.barangay})` : ''}`
        : `Status changed to ${status || 'updated'}${barangay ? ` (${data.barangay})` : ''}`;
    case 'incident:verified':
      return `Incident #${reportId} verified${barangay ? ` (${data.barangay})` : ''}`;
    case 'incident:dispatched':
      return `Incident #${reportId} (${incidentType}${severity}) assigned to department${barangay ? ` in ${data.barangay}` : ''}`;
    case 'incident:resolution_confirmed':
      return `Incident #${reportId} resolved${barangay ? ` (${data.barangay})` : ''}`;
    case 'incident:note_added':
      return `Incident #${reportId}: New coordination note added${barangay ? ` (${data.barangay})` : ''}`;
    case 'incident:reclassified':
      return `Incident #${reportId} reclassified${barangay ? ` (${data.barangay})` : ''}`;
    case 'incident:duplicate_changed':
      return `Incident #${reportId} duplicate status updated${barangay ? ` (${data.barangay})` : ''}`;
    case 'incident:archived':
      return `Incident #${reportId} archived${barangay ? ` (${data.barangay})` : ''}`;
    case 'incident:unarchived':
      return `Incident #${reportId} restored from archive${barangay ? ` (${data.barangay})` : ''}`;
    default:
      return reportId != null ? `Incident #${reportId} updated${barangay ? ` (${data.barangay})` : ''}` : 'Incident update';
  }
}

const EVENT_TYPE_MAP = {
  'incident:created': 'created',
  'incident:status_updated': 'status_updated',
  'incident:verified': 'verified',
  'incident:dispatched': 'dispatched',
  'incident:resolution_confirmed': 'resolution_confirmed',
  'incident:note_added': 'note_added',
  'incident:reclassified': 'reclassified',
  'incident:duplicate_changed': 'duplicate_changed',
  'incident:archived': 'archived',
  'incident:unarchived': 'unarchived',
};

/**
 * Get user_ids that should receive a notification for this event.
 * - Admin/dispatcher/supervisor: all events
 * - Dept users: only incident:dispatched when their dept is assigned
 * - Reporter: events for their own incidents
 */
async function getRecipientUserIds(event, data) {
  const reportId = data?.report_id ?? data?.reportId;
  const reporterId = data?.reporter_id ?? data?.reporterId;

  let assignedDeptIds = data?.assigned_department_ids ?? data?.assignedDepartmentIds ?? null;
  if (assignedDeptIds == null && reportId) {
    assignedDeptIds = await getIncidentAssignedDepartmentIds(reportId);
  }
  if (!Array.isArray(assignedDeptIds)) {
    assignedDeptIds = assignedDeptIds != null ? [assignedDeptIds] : [];
  }

  const recipientIds = new Set();

  if (event === 'incident:created') {
    // New incident reported -> Notify Dispatchers, Admins, and Supervisors on the Web Dashboard
    const globalRes = await pool.query(
      `SELECT user_id FROM users WHERE LOWER(role) IN ('admin','dispatcher','supervisor','super_admin')`
    );
    globalRes.rows.forEach((r) => recipientIds.add(r.user_id));

    // Also notify department admins if pre-assigned
    if (assignedDeptIds.length > 0) {
      const deptRes = await pool.query(
        `SELECT user_id FROM users WHERE department_id = ANY($1::int[])
          AND LOWER(role) IN ('department-admin','department-head')`,
        [assignedDeptIds]
      );
      deptRes.rows.forEach((r) => recipientIds.add(r.user_id));
    }
  } else if (event === 'backup_request') {
    // Backup request -> Notify all active mobile responders, volunteers, and dispatchers
    const responderRes = await pool.query(
      `SELECT user_id FROM users WHERE LOWER(role) IN ('responder', 'volunteer', 'dispatcher', 'admin')`
    );
    responderRes.rows.forEach((r) => recipientIds.add(r.user_id));
  } else {
    // Incident Updates (verified, dispatched, status_updated, resolution_confirmed, reclassified, note_added)
    // -> Send to the Mobile Citizen (Reporter) and Assigned Responders!

    // 1. Reporter (Mobile citizen who reported the emergency)
    let actualReporterId = reporterId;
    if (!actualReporterId && reportId) {
      try {
        const incRes = await pool.query('SELECT user_id FROM incidents WHERE report_id = $1', [reportId]);
        if (incRes.rows.length > 0) {
          actualReporterId = incRes.rows[0].user_id;
        }
      } catch (_) {}
    }
    if (actualReporterId != null) {
      recipientIds.add(actualReporterId);
    }

    // 2. Assigned responder on the incident
    const acceptedUserId = data?.accepted_by_user_id ?? data?.acceptedByUserId;
    if (acceptedUserId != null) {
      recipientIds.add(acceptedUserId);
    }

    // 3. Responders assigned via dispatches table
    if (reportId) {
      try {
        const dispRes = await pool.query(
          `SELECT r.user_id FROM dispatches d
           JOIN responders r ON r.responder_id = d.responder_id
           WHERE d.report_id = $1`,
          [reportId]
        );
        dispRes.rows.forEach((r) => {
          if (r.user_id) recipientIds.add(r.user_id);
        });
      } catch (_) {}
    }

    // 4. For dispatch events, also notify department-level responders
    if (event === 'incident:dispatched' && assignedDeptIds.length > 0) {
      const deptRes = await pool.query(
        `SELECT user_id FROM users WHERE department_id = ANY($1::int[])
          AND LOWER(role) IN ('responder')`,
        [assignedDeptIds]
      );
      deptRes.rows.forEach((r) => recipientIds.add(r.user_id));
    }
  }

  return Array.from(recipientIds);
}

/**
 * Persist notifications to the database for all recipients of an incident event.
 * Call this alongside (or from within) emitIncidentEvent/emitDispatchEvent.
 */
async function persistIncidentNotifications(event, data) {
  if (!data || typeof data !== 'object') return;

  try {
    const message = formatNotificationMessage(event, data);
    const reportId = data.report_id ?? data.reportId ?? null;
    const eventType = EVENT_TYPE_MAP[event] || event?.replace('incident:', '') || null;
    const recipientIds = await getRecipientUserIds(event, data);

    for (const userId of recipientIds) {
      try {
        await Notification.create({
          user_id: userId,
          report_id: reportId,
          message,
          sent_via: 'websocket',
          event_type: eventType,
        });
      } catch (err) {
        console.error('[notificationPersistence] Failed to create notification for user', userId, err.message);
      }
    }
  } catch (err) {
    console.error('[notificationPersistence] Error persisting notifications:', err.message);
  }
}

module.exports = { persistIncidentNotifications, getRecipientUserIds };
