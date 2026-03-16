const TYPE_MAP = {
  fire: 'Fire',
  medical: 'Medical',
  police: 'Police',
  disaster: 'Disaster',
  other: 'Other',
  sos: 'SOS',
};

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

export function mapApiIncidentToDisplay(api) {
  const firstName = String(api?.reporter_first_name || '').trim();
  const lastName = String(api?.reporter_last_name || '').trim();
  const reporterName = (firstName || lastName)
    ? [firstName, lastName].filter(Boolean).join(' ').trim()
    : `User #${api?.user_id}`;

  const normalizedType = String(api?.incident_type || '').trim().toLowerCase();
  const normalizedSeverity = String(api?.severity_level || '').trim().toLowerCase();

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

  return {
    id: api?.report_id,
    reporterName,
    reporterPhone: api?.reporter_phone || null,
    barangay: api?.barangay || '—',
    emergencyType: TYPE_MAP[normalizedType] || (api?.incident_type ? `${String(api.incident_type).charAt(0).toUpperCase()}${String(api.incident_type).slice(1)}` : '—'),
    severity: SEVERITY_MAP[normalizedSeverity] || (api?.severity_level || '—'),
    status: normalizeIncidentStatusLabel(api?.status),
    timeReported,
    timeReportedTs,
    verified: api?.verified ?? false,
    reporterConfirmedAt: api?.reporter_confirmed_at || null,
    isDuplicate: Boolean(api?.is_duplicate),
    flaggedForReview: Boolean(api?.flagged_for_review),
  };
}
