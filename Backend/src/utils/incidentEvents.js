const { persistIncidentNotifications } = require('../services/notificationPersistence');
const { getRecipientUserIds, getCriticalDispatchRecipients } = require('../services/notificationPersistence');
const {
  sendPushToUsers,
  formatPushTitle,
  formatPushBody,
  formatCriticalPushTitle,
} = require('../services/oneSignalService');
const { incidentTypesFromRow } = require('./incidentTypeNormalize');
const pool = require('../config/db');

// Events that should trigger a push notification
const PUSH_EVENTS = new Set([
  'incident:created',
  'incident:verified',
  'incident:dispatched',
  'incident:status_updated',
  'incident:resolution_confirmed',
  'incident:reclassified',
  'incident:note_added',
  'incident:archived',
  'incident:unarchived',
  'backup_request',
  'incident:escalated',
  'incident:escalation_accepted',
  'incident:escalation_declined',
  'incident:escalation_resolved',
  'incident:escalation_cancelled',
]);

function buildIncidentEventPayload(incident) {
  const incidentTypes = incidentTypesFromRow(incident);
  return {
    report_id: incident.report_id ?? incident.reportId,
    reporter_id: incident.user_id ?? incident.userId ?? incident.reporter_id,
    status: incident.status,
    incident_type: incident.incident_type,
    incident_types: incidentTypes,
    severity_level: incident.severity_level,
    barangay: incident.barangay,
    description: incident.description ?? null,
    latitude: incident.latitude ?? null,
    longitude: incident.longitude ?? null,
    accepted_by_user_id: incident.accepted_by_user_id ?? null,
    responder_status: incident.responder_status ?? null,
    assigned_team_name: incident.assigned_team_name || null,
    created_at: incident.created_at ?? null,
    updated_at: incident.updated_at ?? incident.created_at ?? new Date().toISOString(),
  };
}

function emitIncidentEvent(req, event, incident) {
  const wss = req?.app?.locals?.wss;
  if (!incident) return;
  const data = buildIncidentEventPayload(incident);
  if (wss?.broadcast) {
    wss.broadcast(event, data).catch(() => {});
  }
  persistIncidentNotifications(event, data).catch((err) =>
    console.error('[emitIncidentEvent] Notification persistence failed:', err.message)
  );

  // Push notification — fire-and-forget, never blocks the API response
  if (PUSH_EVENTS.has(event) && process.env.NODE_ENV !== 'test' && Boolean((process.env.ONESIGNAL_APP_ID || '').trim())) {
    const webUrl = `${process.env.WEB_DASHBOARD_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/incidents/${data.report_id}`;
    const pushData = { screen: 'incident_detail', report_id: data.report_id, critical: false };
    const eventType = event.replace('incident:', '');

    const sendQuiet = (userIds) => sendPushToUsers(userIds, {
      title: formatPushTitle(event),
      body: formatPushBody(event, data),
      url: webUrl,
      data: pushData,
      eventType,
    }, pool);

    if (event === 'incident:dispatched') {
      getCriticalDispatchRecipients(data).then(async ({ kind, userIds: criticalIds }) => {
        const criticalSet = new Set(criticalIds.map(Number));
        console.log(
          `[emitIncidentEvent] Push critical kind=${kind || 'none'} userIds=[${criticalIds.join(',')}] report=${data.report_id}`
        );
        if (kind && criticalIds.length > 0) {
          await sendPushToUsers(criticalIds, {
            title: formatCriticalPushTitle(kind),
            body: formatPushBody(event, data),
            url: webUrl,
            data: { ...pushData, critical: true, alert_kind: kind },
            eventType,
            critical: true,
          }, pool);
        }
        const allIds = await getRecipientUserIds(event, data);
        const quietIds = allIds.filter((id) => !criticalSet.has(Number(id)));
        console.log(
          `[emitIncidentEvent] Push quiet userIds=[${quietIds.join(',')}] report=${data.report_id}`
        );
        if (quietIds.length > 0) await sendQuiet(quietIds);
      }).catch((err) =>
        console.error('[emitIncidentEvent] Push notification failed:', err.message)
      );
      return;
    }

    getRecipientUserIds(event, data).then((userIds) => {
      console.log(
        `[emitIncidentEvent] Push quiet userIds=[${userIds.join(',')}] event=${event} report=${data.report_id}`
      );
      return sendQuiet(userIds);
    }).catch((err) =>
      console.error('[emitIncidentEvent] Push notification failed:', err.message)
    );
  }
}

module.exports = {
  buildIncidentEventPayload,
  emitIncidentEvent,
};
