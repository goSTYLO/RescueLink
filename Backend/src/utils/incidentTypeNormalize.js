/**
 * Normalize AI / user incident type labels to backend storage values.
 */

function normalizeAiIncidentType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  const collapsed = normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;

  if (['natural disaster', 'typhoon', 'flood', 'earthquake', 'landslide', 'storm surge', 'volcanic eruption'].includes(collapsed)) {
    return 'disaster';
  }
  if (['disaster', 'calamity'].includes(collapsed)) return 'disaster';
  if (['crime', 'robbery', 'theft', 'assault', 'violence', 'homicide', 'shooting', 'stabbing', 'police', 'law enforcement'].includes(collapsed)) {
    return 'police';
  }
  if (['accident', 'vehicular accident', 'road accident', 'traffic accident', 'collision'].includes(collapsed)) {
    return 'accident';
  }
  if (['medical', 'first aid', 'injury', 'trauma', 'medical emergency', 'emergency medical'].includes(collapsed)) {
    return 'medical';
  }
  if (['fire', 'blaze', 'structural fire', 'wildfire'].includes(collapsed)) return 'fire';
  if (normalized === 'other') return 'other';
  if (normalized === 'sos') return 'sos';
  if (['fire', 'medical', 'police', 'disaster', 'accident', 'other', 'sos'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function normalizeAiIncidentTypes(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = normalizeAiIncidentType(value);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function incidentTypesFromRow(row) {
  if (!row || typeof row !== 'object') return [];
  if (Array.isArray(row.incident_types) && row.incident_types.length > 0) {
    return row.incident_types.filter(Boolean);
  }
  const legacy = [row.incident_type, row.secondary_classification].filter(Boolean);
  if (legacy.length > 0) return legacy;
  return row.incident_type ? [row.incident_type] : [];
}

module.exports = {
  normalizeAiIncidentType,
  normalizeAiIncidentTypes,
  incidentTypesFromRow,
};
