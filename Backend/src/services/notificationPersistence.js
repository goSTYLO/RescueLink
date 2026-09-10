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
       JOIN departments d ON LOWER(TRIM(d.code)) = LOWER(TRIM(dp.department_code))
       WHERE dp.report_id = $1
       UNION
       SELECT ie.to_department_id AS department_id
       FROM incident_escalations ie
       WHERE ie.report_id = $1 AND ie.status IN ('pending', 'accepted')
       UNION
       SELECT ie.from_department_id AS department_id
       FROM incident_escalations ie
       WHERE ie.report_id = $1 AND ie.status IN ('pending', 'accepted')`,
      [reportId]
    );
    return res.rows.map((r) => Number(r.department_id)).filter((id) => Number.isFinite(id) && id > 0);
  } catch {
    return [];
  }
}

function humanizeStatus(status) {
  if (!status) return 'updated';
  const s = String(status).replace(/_/g, ' ').trim();
  if (!s) return 'updated';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatNotificationMessage(event, data) {
  const reportId = data?.report_id ?? data?.reportId;
  const incidentType = data?.incident_type || 'Incident';
  const severity = data?.severity_level ? ` (${data.severity_level})` : '';
  const barangay = data?.barangay ? ` in ${data.barangay}` : '';
  const status = humanizeStatus(data?.status);
  const typeBit = `${incidentType}${severity}`;
  const toDeptName = data?.to_department_name || 'another department';
  const urgencyPrefix =
    data?.urgency && String(data.urgency).toLowerCase() === 'high' ? 'Urgent: ' : '';

  switch (event) {
    case 'incident:created':
      return `New ${typeBit} reported${barangay}.`;
    case 'incident:status_updated':
      return reportId != null
        ? `Report #${reportId} is now ${status}${barangay ? ` (${data.barangay})` : ''}.`
        : `Status is now ${status}${barangay ? ` (${data.barangay})` : ''}.`;
    case 'incident:verified':
      return `Report #${reportId} has been verified${barangay ? ` (${data.barangay})` : ''}.`;
    case 'incident:dispatched':
      return `Responders have been assigned to report #${reportId} (${typeBit})${barangay}.`;
    case 'incident:resolution_confirmed':
      return `Report #${reportId} has been resolved${barangay ? ` (${data.barangay})` : ''}.`;
    case 'incident:note_added':
      return `A new note was added to report #${reportId}${barangay ? ` (${data.barangay})` : ''}.`;
    case 'incident:reclassified':
      return `Report #${reportId} is now listed as ${incidentType}${barangay}.`;
    case 'incident:duplicate_changed':
      return `Report #${reportId} duplicate marking was updated${barangay ? ` (${data.barangay})` : ''}.`;
    case 'incident:archived':
      return `Report #${reportId} has been archived${barangay ? ` (${data.barangay})` : ''}.`;
    case 'incident:unarchived':
      return `Report #${reportId} has been restored${barangay ? ` (${data.barangay})` : ''}.`;
    case 'incident:escalated':
      return `${urgencyPrefix}Help requested from ${toDeptName} for report #${reportId}${barangay}.`;
    case 'incident:escalation_accepted':
      return `${toDeptName} accepted the help request for report #${reportId}.`;
    case 'incident:escalation_declined':
      return `${toDeptName} declined the help request for report #${reportId}.`;
    case 'incident:escalation_resolved':
      return `Help from ${toDeptName} for report #${reportId} is resolved.`;
    case 'incident:escalation_cancelled':
      return `The help request for report #${reportId} was cancelled.`;
    default:
      return reportId != null
        ? `Report #${reportId} was updated${barangay ? ` (${data.barangay})` : ''}.`
        : 'An update is available.';
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
  'incident:escalated': 'escalated',
  'incident:escalation_accepted': 'escalation_accepted',
  'incident:escalation_declined': 'escalation_declined',
  'incident:escalation_resolved': 'escalation_resolved',
  'incident:escalation_cancelled': 'escalation_cancelled',
};

/**
 * Get user_ids that should receive a notification for this event.
 * - Admin/dispatcher/supervisor: all events
 * - Dept users (admin, head, personnel, responder): events for their assigned department
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
  const numericDeptIds = assignedDeptIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);

  const recipientIds = new Set();

  if (event === 'incident:created') {
    // New incident reported -> Notify Dispatchers, Admins, and Supervisors on the Web Dashboard
    const globalRes = await pool.query(
      `SELECT user_id FROM users WHERE REPLACE(LOWER(role), '_', '-') IN ('admin','dispatcher','supervisor','super-admin')`
    );
    globalRes.rows.forEach((r) => recipientIds.add(r.user_id));

    // Also notify department admins if pre-assigned
    if (numericDeptIds.length > 0) {
      const deptRes = await pool.query(
        `SELECT user_id FROM users WHERE department_id = ANY($1::int[])
          AND REPLACE(LOWER(role), '_', '-') IN ('department-admin','department-head','personnel')`,
        [numericDeptIds]
      );
      deptRes.rows.forEach((r) => recipientIds.add(r.user_id));
    }
  } else if (event === 'backup_request') {
    // Backup request -> Notify all active mobile responders, volunteers, and dispatchers
    const responderRes = await pool.query(
      `SELECT user_id FROM users WHERE REPLACE(LOWER(role), '_', '-') IN ('responder', 'volunteer', 'dispatcher', 'admin', 'super-admin')`
    );
    responderRes.rows.forEach((r) => recipientIds.add(r.user_id));
  } else if (event === 'incident:escalated') {
    // New escalation -> notify target-department admins/heads/personnel + all dispatchers/super-admins
    const toDeptId = data?.to_department_id ? Number(data.to_department_id) : null;
    if (toDeptId) {
      const deptRes = await pool.query(
        `SELECT user_id FROM users WHERE department_id = $1
          AND REPLACE(LOWER(role), '_', '-') IN ('department-admin','department-head','personnel')`,
        [toDeptId]
      );
      deptRes.rows.forEach((r) => recipientIds.add(r.user_id));
    }
    // Also notify dispatchers & super-admins
    const globalRes = await pool.query(
      `SELECT user_id FROM users WHERE REPLACE(LOWER(role), '_', '-') IN ('admin','dispatcher','supervisor','super-admin')`
    );
    globalRes.rows.forEach((r) => recipientIds.add(r.user_id));
  } else if (event.startsWith('incident:escalation_')) {
    // Escalation status update -> notify BOTH from-dept and to-dept admins + dispatchers
    const toDeptId = data?.to_department_id ? Number(data.to_department_id) : null;
    const fromDeptId = data?.from_department_id ? Number(data.from_department_id) : null;
    const deptIds = [toDeptId, fromDeptId].filter((id) => Number.isFinite(id) && id > 0);
    if (deptIds.length > 0) {
      const deptRes = await pool.query(
        `SELECT user_id FROM users WHERE department_id = ANY($1::int[])
          AND REPLACE(LOWER(role), '_', '-') IN ('department-admin','department-head','personnel')`,
        [deptIds]
      );
      deptRes.rows.forEach((r) => recipientIds.add(r.user_id));
    }
    const globalRes = await pool.query(
      `SELECT user_id FROM users WHERE REPLACE(LOWER(role), '_', '-') IN ('admin','dispatcher','supervisor','super-admin')`
    );
    globalRes.rows.forEach((r) => recipientIds.add(r.user_id));
  } else {
    // Incident Updates (verified, dispatched, status_updated, resolution_confirmed, reclassified, note_added, archived, unarchived)

    // 1. Reporter (Mobile citizen who reported the emergency)
    let actualReporterId = reporterId;
    if (!actualReporterId && reportId) {
      try {
        const incRes = await pool.query('SELECT user_id FROM incident_reports WHERE report_id = $1', [reportId]);
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

    // 4. Assigned department staff (Admins, Heads, Personnel, and Responders)
    if (numericDeptIds.length > 0) {
      const deptRes = await pool.query(
        `SELECT user_id FROM users WHERE department_id = ANY($1::int[])
          AND REPLACE(LOWER(role), '_', '-') IN ('department-admin','department-head','personnel','responder')`,
        [numericDeptIds]
      );
      deptRes.rows.forEach((r) => recipientIds.add(r.user_id));
    }

    // 5. Global roles (Dispatchers / Admins / Supervisors) for important status updates & notes
    if (['incident:dispatched', 'incident:note_added', 'incident:verified', 'incident:resolution_confirmed', 'incident:reclassified'].includes(event)) {
      const globalRes = await pool.query(
        `SELECT user_id FROM users WHERE REPLACE(LOWER(role), '_', '-') IN ('admin','dispatcher','supervisor','super-admin')`
      );
      globalRes.rows.forEach((r) => recipientIds.add(r.user_id));
    }
  }

  return Array.from(recipientIds);
}

/**
 * Amber-alert recipients for incident:dispatched.
 * - Team assigned → account-backed team members + department-admin/head for the dept
 * - Dept-only notify → department-admin + department-head + responder (field personnel)
 * @returns {Promise<{ kind: 'team'|'dept'|null, userIds: number[] }>}
 */
async function getCriticalDispatchRecipients(data) {
  const reportId = data?.report_id ?? data?.reportId;
  if (!reportId) return { kind: null, userIds: [] };

  try {
    const teamRes = await pool.query(
      `SELECT DISTINCT r.user_id
         FROM dispatches d
         JOIN responders r ON r.responder_id = d.responder_id
        WHERE d.report_id = $1
          AND r.user_id IS NOT NULL
          AND NULLIF(TRIM(COALESCE(d.team_name, '')), '') IS NOT NULL
          AND LOWER(COALESCE(d.responder_source, 'account')) <> 'escalation'`,
      [reportId]
    );
    const teamIds = teamRes.rows
      .map((r) => Number(r.user_id))
      .filter((id) => Number.isFinite(id) && id > 0);

    let assignedDeptIds = data?.assigned_department_ids ?? data?.assignedDepartmentIds ?? null;
    if (assignedDeptIds == null) {
      assignedDeptIds = await getIncidentAssignedDepartmentIds(reportId);
    }
    if (!Array.isArray(assignedDeptIds)) {
      assignedDeptIds = assignedDeptIds != null ? [assignedDeptIds] : [];
    }
    const numericDeptIds = assignedDeptIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);

    // Only team-amber when we have account-backed members. assigned_team_name alone
    // must not short-circuit to empty critical (auto applyTeam stamps the name).
    if (teamIds.length > 0) {
      const critical = new Set(teamIds);
      // Dept admin/head still get amber when a team is already assigned.
      if (numericDeptIds.length > 0) {
        const opsRes = await pool.query(
          `SELECT user_id FROM users
            WHERE department_id = ANY($1::int[])
              AND REPLACE(LOWER(role), '_', '-') IN ('department-admin', 'department-head')`,
          [numericDeptIds]
        );
        opsRes.rows.forEach((r) => {
          const id = Number(r.user_id);
          if (Number.isFinite(id) && id > 0) critical.add(id);
        });
      }
      return { kind: 'team', userIds: [...critical] };
    }

    if (numericDeptIds.length === 0) return { kind: null, userIds: [] };

    const deptRes = await pool.query(
      `SELECT user_id FROM users
        WHERE department_id = ANY($1::int[])
          AND REPLACE(LOWER(role), '_', '-') IN ('department-admin', 'department-head', 'responder')`,
      [numericDeptIds]
    );
    const deptIds = deptRes.rows
      .map((r) => Number(r.user_id))
      .filter((id) => Number.isFinite(id) && id > 0);
    return { kind: 'dept', userIds: [...new Set(deptIds)] };
  } catch (err) {
    console.error('[getCriticalDispatchRecipients]', err.message);
    return { kind: null, userIds: [] };
  }
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

module.exports = {
  persistIncidentNotifications,
  getRecipientUserIds,
  getCriticalDispatchRecipients,
};
