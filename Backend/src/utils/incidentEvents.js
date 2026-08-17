const { persistIncidentNotifications } = require('../services/notificationPersistence');
const { incidentTypesFromRow } = require('./incidentTypeNormalize');

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
    created_at: incident.created_at ?? null,
    updated_at: incident.updated_at ?? incident.created_at ?? new Date().toISOString(),
  };
}

function emitIncidentEvent(req, event, incident) {
  const wss = req.app?.locals?.wss;
  if (!incident) return;
  const data = buildIncidentEventPayload(incident);
  if (wss?.broadcast) {
    wss.broadcast(event, data).catch(() => {});
  }
  persistIncidentNotifications(event, data).catch((err) =>
    console.error('[emitIncidentEvent] Notification persistence failed:', err.message)
  );
}

module.exports = {
  buildIncidentEventPayload,
  emitIncidentEvent,
};
