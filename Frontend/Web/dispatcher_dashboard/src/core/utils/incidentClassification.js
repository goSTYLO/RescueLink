export function mapIncidentTypeFilterToApi(value) {
  if (value === 'Fire') return 'fire';
  if (value === 'Medical') return 'medical';
  if (value === 'Police') return 'police';
  if (value === 'Disaster') return 'disaster';
  if (value === 'Other') return 'other';
  return undefined;
}

export function normalizeIncidentTaskType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';

  const collapsed = normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';

  if (['other', 'others'].includes(collapsed)) return 'other';
  if (['natural disaster', 'typhoon', 'flood', 'earthquake', 'landslide', 'storm surge', 'volcanic eruption', 'disaster', 'calamity'].includes(collapsed)) return 'disaster';
  if (['crime', 'robbery', 'theft', 'assault', 'violence', 'homicide', 'shooting', 'stabbing', 'police', 'law enforcement'].includes(collapsed)) return 'police';
  if (['accident', 'vehicular accident', 'road accident', 'traffic accident', 'collision', 'injury', 'trauma', 'medical emergency', 'emergency medical', 'medical', 'first aid'].includes(collapsed)) return 'medical';
  if (['fire', 'blaze', 'structural fire', 'wildfire'].includes(collapsed)) return 'fire';
  if (normalized === 'natural disaster' || normalized === 'natural-disaster') return 'disaster';
  if (normalized === 'crime') return 'police';
  return normalized;
}

export function doesTeamSupportIncidentType(teamSupportedIncidentTypes, incidentType) {
  const normalizedIncidentType = normalizeIncidentTaskType(incidentType);
  if (!normalizedIncidentType || normalizedIncidentType === 'other') return true;

  const supported = Array.isArray(teamSupportedIncidentTypes)
    ? teamSupportedIncidentTypes.map((entry) => normalizeIncidentTaskType(entry))
    : [];
  if (supported.length === 0) return true;

  return supported.includes(normalizedIncidentType);
}
