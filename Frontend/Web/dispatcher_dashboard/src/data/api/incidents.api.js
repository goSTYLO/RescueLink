import { API_URL } from '@/core/config/app.config';
import {
  createRequestId,
  getAuthHeaders,
  logError,
  logInfo,
  logWarn,
  parseErrorMessage,
  parseJsonOrEmpty,
} from '@/data/api/http';

const CANONICAL_INCIDENT_STATUSES = new Set(['pending', 'verified', 'in_progress', 'resolved', 'closed']);
const INCIDENT_LIST_CACHE_MS = 8000;
const incidentsCache = new Map();
const inflightRequests = new Map();

/**
 * Invalidate all incident cache entries
 * Called when realtime events indicate data has changed
 */
export function invalidateIncidentCache() {
  const cacheSize = incidentsCache.size;
  incidentsCache.clear();
  inflightRequests.clear();
  if (cacheSize > 0) {
    console.log(`[incidents] Cache invalidated (${cacheSize} entries cleared)`);
  }
}

/**
 * Invalidate cache for a specific incident by ID
 * @param {string|number} reportId - The incident report ID
 */
export function invalidateIncidentById(reportId) {
  // Clear any cache entries that might include this incident
  // Since we can't easily know which cache entries contain it, we clear all for now
  invalidateIncidentCache();
}

export function normalizeIncidentStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (CANONICAL_INCIDENT_STATUSES.has(normalized)) {
    return normalized;
  }
  return 'pending';
}

/**
 * Fetch all incidents with optional filters and pagination
 * @param {Object} params - Query parameters
 * @param {number} [params.limit=100] - Number of records to return
 * @param {number} [params.offset=0] - Number of records to skip
 * @param {string} [params.severity_level] - Filter by severity (high, medium, low)
 * @param {string} [params.status] - Filter by status (pending, verified, in_progress, resolved, closed)
 * @param {string} [params.incident_type] - Filter by incident type (fire, medical, police, disaster)
 * @param {string} [params.barangay] - Filter by barangay
 * @param {boolean} [params.withMeta=false] - Include backend pagination metadata
 * @returns {Promise<Array>} Array of incident objects
 */
export async function getIncidents({
  limit = 100,
  offset = 0,
  severity_level,
  status,
  incident_type,
  barangay,
  withMeta = false,
} = {}) {
  const requestId = createRequestId('web-incidents');
  const start = performance.now();
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (severity_level) params.set('severity_level', severity_level);
  if (status) params.set('status', normalizeIncidentStatus(status));
  if (incident_type) params.set('incident_type', String(incident_type).toLowerCase());
  if (barangay) params.set('barangay', barangay);
  params.set('meta', withMeta ? '1' : '0');
  const queryKey = params.toString();
  const cached = incidentsCache.get(queryKey);
  if (cached && (Date.now() - cached.timestamp) < INCIDENT_LIST_CACHE_MS) {
    if (withMeta) {
      return {
        items: cached.data,
        totalCount: Number(cached.totalCount || cached.data.length || 0),
        limit,
        offset,
      };
    }
    return cached.data;
  }
  const inFlight = inflightRequests.get(queryKey);
  if (inFlight) {
    return inFlight;
  }
  const requestPromise = (async () => {
    const response = await fetch(`${API_URL}/api/incidents?${params}`, {
      method: 'GET',
      headers: getAuthHeaders({ requestId }),
    });

    const data = await parseJsonOrEmpty(response);

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterHeader = Number(response.headers.get('retry-after') || 30);
        logWarn(`[web][incidents][getIncidents] rate_limited request_id=${requestId} retry_after_s=${retryAfterHeader}`, 'incidents-rate-limit');
        throw new Error(`Rate limited by server. Retry in ~${retryAfterHeader}s.`);
      }
      logError(`[web][incidents][getIncidents] request_id=${requestId} status=${response.status}`);
      throw new Error(parseErrorMessage(data, 'Failed to fetch incidents'));
    }

    const normalizedItems = Array.isArray(data) ? data : [];
    const totalHeaderValue = response.headers?.get?.('x-total-count');
    const totalCountFromHeader = totalHeaderValue == null ? Number.NaN : Number(totalHeaderValue);
    const totalCount = Number.isFinite(totalCountFromHeader) ? totalCountFromHeader : normalizedItems.length;

    logInfo(`[web][incidents][getIncidents] request_id=${requestId} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);
    incidentsCache.set(queryKey, { data: normalizedItems, timestamp: Date.now(), totalCount });
    if (withMeta) {
      return {
        items: normalizedItems,
        totalCount,
        limit,
        offset,
      };
    }
    return normalizedItems;
  })();
  inflightRequests.set(queryKey, requestPromise);
  try {
    const result = await requestPromise;
    return result;
  } finally {
    inflightRequests.delete(queryKey);
  }
}

/**
 * Fetch a single incident by ID
 * @param {number|string} id - Incident report ID
 * @returns {Promise<Object>} Incident object
 */
export async function getIncidentById(id) {
  const requestId = createRequestId('web-incident');
  const start = performance.now();
  const response = await fetch(`${API_URL}/api/incidents/${id}`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    logError(`[web][incidents][getIncidentById] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(parseErrorMessage(data, 'Failed to fetch incident'));
  }

  logInfo(`[web][incidents][getIncidentById] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);

  return data;
}

/**
 * Fetch incident plus latest AI classification metadata
 * @param {number|string} id - Incident report ID
 * @returns {Promise<Object>} { incident, ai_classification }
 */
export async function getIncidentWithAi(id) {
  const requestId = createRequestId('web-incident-ai');
  const start = performance.now();
  const response = await fetch(`${API_URL}/api/incidents/${id}/with-ai`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    logError(`[web][incidents][getIncidentWithAi] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(parseErrorMessage(data, 'Failed to fetch incident AI metadata'));
  }

  logInfo(`[web][incidents][getIncidentWithAi] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);
  return data;
}

/**
 * Verify incident and record on blockchain
 * @param {number|string} id - Incident report ID
 * @returns {Promise<Object>} { success, verified, blockchain }
 */
export async function verifyIncident(id) {
  const requestId = createRequestId('web-verify');
  const start = performance.now();
  const response = await fetch(`${API_URL}/api/incidents/${id}/verify`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    logError(`[web][incidents][verifyIncident] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(parseErrorMessage(data, 'Failed to verify incident'));
  }

  logInfo(`[web][incidents][verifyIncident] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);

  return data;
}

/**
 * Update incident lifecycle status
 * @param {number|string} id - Incident report ID
 * @param {string} status - verified|in_progress|resolved
 * @returns {Promise<Object>} { success, incident }
 */
export async function updateIncidentStatus(id, status) {
  const requestId = createRequestId('web-incident-status');
  const start = performance.now();
  const response = await fetch(`${API_URL}/api/incidents/${id}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify({ status: normalizeIncidentStatus(status) }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    logError(`[web][incidents][updateIncidentStatus] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(parseErrorMessage(data, 'Failed to update incident status'));
  }

  logInfo(`[web][incidents][updateIncidentStatus] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);
  return data;
}

/**
 * Manual reclassification of incident type/severity (human override)
 * @param {number|string} id - Incident report ID
 * @param {Object} payload
 * @param {string} payload.incident_type - fire|medical|police|disaster
 * @param {string} payload.severity_level - low|medium|high
 * @param {string} [payload.reason] - Optional human review reason
 * @returns {Promise<Object>} Updated incident and override classification
 */
export async function reclassifyIncident(id, payload) {
  const requestId = createRequestId('web-reclassify');
  const start = performance.now();
  const response = await fetch(`${API_URL}/api/incidents/${id}/reclassify`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    logError(`[web][incidents][reclassifyIncident] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(parseErrorMessage(data, 'Failed to reclassify incident'));
  }

  logInfo(`[web][incidents][reclassifyIncident] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);
  return data;
}

/**
 * Fetch incident audio and return a blob URL for playback (requires auth)
 * @param {number|string} id - Incident report ID
 * @returns {Promise<string>} Blob URL for the audio (caller should revoke when done)
 */
export async function getIncidentAudioUrl(id) {
  const requestId = createRequestId('web-audio');
  const start = performance.now();
  const response = await fetch(`${API_URL}/api/incidents/${id}/audio`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId, includeContentType: false }),
  });

  if (!response.ok) {
    logError(`[web][incidents][getIncidentAudioUrl] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error('Failed to fetch audio');
  }

  const blob = await response.blob();
  logInfo(`[web][incidents][getIncidentAudioUrl] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);
  return URL.createObjectURL(blob);
}

/**
 * Fetch coordination notes for an incident
 * @param {number|string} id - Incident report ID
 * @returns {Promise<Array>} Array of coordination note objects
 */
export async function getCoordinationNotes(id) {
  const requestId = createRequestId('web-coordination-notes');
  const start = performance.now();

  const response = await fetch(`${API_URL}/api/incidents/${id}/coordination-notes`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    logError(`[web][incidents][getCoordinationNotes] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(parseErrorMessage(data, 'Failed to fetch coordination notes'));
  }

  logInfo(`[web][incidents][getCoordinationNotes] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Add a coordination note to an incident
 * @param {number|string} id - Incident report ID
 * @param {Object} payload - Note data
 * @param {string} payload.note - The note content
 * @returns {Promise<Object>} Created note object
 */
export async function addCoordinationNote(id, { note }) {
  const requestId = createRequestId('web-add-coordination-note');
  const start = performance.now();

  const response = await fetch(`${API_URL}/api/incidents/${id}/coordination-notes`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify({ note }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    logError(`[web][incidents][addCoordinationNote] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(parseErrorMessage(data, 'Failed to add coordination note'));
  }

  logInfo(`[web][incidents][addCoordinationNote] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);
  return data;
}
