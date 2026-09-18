import { normalizeRole, ROLES } from '@/core/constants';

const TYPE_MAP = {
  fire: 'Fire',
  medical: 'Medical',
  police: 'Police',
  disaster: 'Disaster',
  accident: 'Accident',
  other: 'Other',
  sos: 'SOS',
};

export function formatIncidentTypeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '—';
  return TYPE_MAP[normalized]
    || `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

export function incidentTypesFromApi(api) {
  if (Array.isArray(api?.incident_types) && api.incident_types.length > 0) {
    return api.incident_types.filter(Boolean);
  }
  return [api?.incident_type, api?.secondary_classification].filter(Boolean);
}

export function formatIncidentTypesLabel(api, separator = ' · ') {
  const types = incidentTypesFromApi(api);
  if (types.length === 0) return '—';
  return types.map((type) => formatIncidentTypeLabel(type)).join(separator);
}

export function getTypeBadgeClass(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (!normalized) {
    return 'bg-slate-500/15 text-slate-600 border-slate-500/40 dark:text-slate-400';
  }
  if (normalized.includes('fire')) {
    return 'bg-orange-500/15 text-orange-700 border-orange-500/40 dark:text-orange-400';
  }
  if (normalized.includes('medical') || normalized.includes('health') || normalized.includes('accident')) {
    return 'bg-pink-500/15 text-pink-700 border-pink-500/40 dark:text-pink-400';
  }
  if (normalized.includes('police') || normalized.includes('crime')) {
    return 'bg-blue-500/15 text-blue-700 border-blue-500/40 dark:text-blue-400';
  }
  if (normalized.includes('disaster') || normalized.includes('flood')) {
    return 'bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-400';
  }
  return 'bg-slate-500/15 text-slate-600 border-slate-500/40 dark:text-slate-400';
}

const SEVERITY_MAP = {
  high: 'Critical',
  critical: 'Critical',
  medium: 'Warning',
  low: 'Low',
};

const STATUS_MAP = {
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
  verified: 'Verified',
  in_progress: 'In Progress',
};

export function normalizeIncidentStatusLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'Pending';

  if (normalized === 'in-progress' || normalized === 'in progress') {
    return STATUS_MAP.in_progress;
  }

  return STATUS_MAP[normalized] || value || 'Pending';
}

export function volunteerResponderStatusLabel(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return normalized;
}

export function getVolunteerStatusBadgeClass(status) {
  const normalized = String(status || '').trim().toLowerCase();
  switch (normalized) {
    case 'assigned':
      return 'bg-blue-500/20 text-blue-400 border border-blue-500/40';
    case 'en route':
      return 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
    case 'on scene':
      return 'bg-orange-500/20 text-orange-400 border border-orange-500/40';
    case 'resolved':
      return 'bg-severity-resolved/20 text-severity-resolved border border-emerald-500/40';
    default:
      return 'bg-slate-500/20 text-slate-400 border border-slate-500/40';
  }
}

export function isVolunteerResolved(responderStatus) {
  return String(responderStatus || '').trim().toLowerCase() === 'resolved';
}

/** Whether an incident is closed (lifecycle complete). */
export function isIncidentClosed(incident) {
  if (!incident) return false;
  const status = String(incident?.status || '').trim().toLowerCase();
  if (status === 'closed') return true;
  return Boolean(incident?.closedAt);
}

/** Lifecycle resolved or volunteer marked Resolved (and not yet closed). */
export function isIncidentEffectivelyResolved(incident) {
  const status = String(incident?.status || '').trim().toLowerCase();
  if (status === 'closed') return false;
  if (status === 'resolved') return true;
  return isVolunteerResolved(incident?.responderStatus);
}

/** Whether a backup request is still open (pending or acknowledged). */
export function hasOpenBackupRequestActive(incident) {
  if (!incident) return false;
  if (Boolean(incident.hasOpenBackupRequest)) return true;
  if (Boolean(incident.hasPendingBackup)) return true;
  const status = String(
    incident.openBackupStatus || incident.latestBackupStatus || ''
  ).toLowerCase();
  return status === 'pending' || status === 'acknowledged';
}

/** Staff backup badge / Send Backup remain while a backup request is open (not when closed). */
export function hasOpenBackupUi(incident) {
  if (isIncidentClosed(incident)) return false;
  return hasOpenBackupRequestActive(incident);
}

export function getBackupDialogCapabilities(incident, role) {
  if (isIncidentClosed(incident)) {
    return {
      canAcknowledge: false,
      canNotifyDepartment: false,
      canAssignTeam: false,
    };
  }
  const normalized = normalizeRole(role);
  const isGlobalStaff = (
    normalized === ROLES.SUPER_ADMIN
    || normalized === ROLES.DISPATCHER
    || normalized === ROLES.SUPERVISOR
  );
  const isDeptStaff = (
    normalized === ROLES.DEPARTMENT_ADMIN
    || normalized === ROLES.DEPARTMENT_HEAD
    || normalized === ROLES.PERSONNEL
  );
  const open = hasOpenBackupRequestActive(incident);
  const status = String(incident?.openBackupStatus || '').toLowerCase();
  return {
    canAcknowledge: isGlobalStaff && open && status === 'pending',
    canNotifyDepartment: isGlobalStaff && open,
    canAssignTeam: isDeptStaff && open && !String(incident?.assignedTeamName || '').trim(),
  };
}

export function isIncidentActiveForDashboard(incident) {
  const status = String(incident?.status || '').toLowerCase();
  if (status === 'resolved' || status === 'closed') return false;
  if (isVolunteerResolved(incident?.responderStatus)) return false;
  return true;
}

export function mapApiIncidentToDisplay(api) {
  const firstName = String(api?.reporter_first_name || '').trim();
  const lastName = String(api?.reporter_last_name || '').trim();
  const reporterName = (firstName || lastName)
    ? [firstName, lastName].filter(Boolean).join(' ').trim()
    : `User #${api?.user_id}`;

  const normalizedType = String(api?.incident_type || '').trim().toLowerCase();
  const normalizedSeverity = String(api?.severity_level || '').trim().toLowerCase();
  const incidentTypes = incidentTypesFromApi(api);
  const emergencyTypesLabel = formatIncidentTypesLabel(api);

  let timeReported = '—';
  let timeReportedTs = 0;
  if (api?.created_at) {
    const date = new Date(api.created_at);
    timeReportedTs = date.getTime();
    timeReported = date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  const acceptedFirst = String(api?.accepted_by_first_name || '').trim();
  const acceptedLast = String(api?.accepted_by_last_name || '').trim();
  const acceptedByName = String(api?.accepted_by_name || '').trim()
    || [acceptedFirst, acceptedLast].filter(Boolean).join(' ').trim()
    || null;

  return {
    id: api?.report_id,
    reporterName,
    reporterPhone: api?.reporter_phone || null,
    barangay: api?.barangay || '—',
    emergencyType: TYPE_MAP[normalizedType] || (api?.incident_type ? `${String(api.incident_type).charAt(0).toUpperCase()}${String(api.incident_type).slice(1)}` : '—'),
    emergencyTypesLabel,
    incidentTypes,
    severity: SEVERITY_MAP[normalizedSeverity] || (api?.severity_level || '—'),
    status: normalizeIncidentStatusLabel(api?.status),
    responderStatus: api?.responder_status || null,
    acceptedByUserId: api?.accepted_by_user_id ?? null,
    acceptedByName,
    acceptedByPhone: api?.accepted_by_phone || null,
    acceptedAt: api?.accepted_at || null,
    latitude: api?.latitude ?? null,
    longitude: api?.longitude ?? null,
    hasPendingBackup: Boolean(api?.has_pending_backup),
    pendingBackupRequestId: api?.pending_backup_request_id ?? null,
    hasOpenBackupRequest: Boolean(api?.has_open_backup_request),
    activeBackupRequestId: api?.active_backup_request_id ?? null,
    openBackupStatus: api?.open_backup_status || null,
    latestBackupStatus: api?.latest_backup_status || null,
    backupVolunteers: Array.isArray(api?.backup_volunteers) ? api.backup_volunteers : [],
    backupVolunteerCount: api?.backup_volunteer_count ?? (Array.isArray(api?.backup_volunteers) ? api.backup_volunteers.length : 0),
    pendingBackupTarget: api?.pending_backup_target || null,
    pendingBackupBroadcastCount: api?.pending_backup_broadcast_count ?? null,
    timeReported,
    timeReportedTs,
    verified: api?.verified ?? false,
    reporterConfirmedAt: api?.reporter_confirmed_at || null,
    isDuplicate: Boolean(api?.is_duplicate),
    flaggedForReview: Boolean(api?.flagged_for_review),
    hasPendingEscalation: Boolean(api?.has_pending_escalation),
    autoAssignmentStatus: String(api?.auto_assignment_status || 'none').toLowerCase(),
    suggestedDepartmentCode: api?.suggested_department_code || null,
    suggestedTeamName: api?.suggested_team_name || null,
    autoAssignmentReason: api?.auto_assignment_reason || null,
    autoAssignmentMismatch: Boolean(api?.auto_assignment_mismatch),
    assignedTeamName: api?.assigned_team_name || null,
  };
}

export function getSuggestedTeamName(incident) {
  return String(incident?.suggestedTeamName || incident?.suggested_team_name || '').trim();
}

export function getAutoAssignmentBadge(incident) {
  const status = String(incident?.autoAssignmentStatus || incident?.auto_assignment_status || '').toLowerCase();
  if (status === 'suggested') {
    const team = getSuggestedTeamName(incident);
    return {
      label: team ? `Needs confirm: ${team}` : 'Needs confirm',
      className: 'bg-amber-500/20 text-amber-700 border-amber-500/40 dark:text-amber-300',
    };
  }
  if (status === 'auto_applied') {
    return { label: 'Auto-assigned', className: 'bg-sky-500/20 text-sky-700 border-sky-500/40 dark:text-sky-300' };
  }
  if (status === 'dept_notified') {
    return { label: 'Dept notified (no team)', className: 'bg-violet-500/20 text-violet-700 border-violet-500/40 dark:text-violet-300' };
  }
  if (status === 'overridden') {
    return { label: 'Reassigned', className: 'bg-slate-500/20 text-slate-700 border-slate-500/40 dark:text-slate-300' };
  }
  if (status === 'confirmed') {
    return { label: 'Suggestion confirmed', className: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40 dark:text-emerald-300' };
  }
  return null;
}
