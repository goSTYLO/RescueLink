import { API_URL } from '@/core/config/app.config';

const isProduction = import.meta.env.PROD;

function createRequestId(prefix = 'web') {
  const randomPart = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

function logInfo(message) {
  if (!isProduction) {
    console.info(message);
  }
}

function logError(message) {
  console.error(message);
}

function getAuthHeaders(requestId) {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-request-id': requestId,
  };
}

/**
 * Fetch all incidents with optional filters and pagination
 * @param {Object} params - Query parameters
 * @param {number} [params.limit=100] - Number of records to return
 * @param {number} [params.offset=0] - Number of records to skip
 * @param {string} [params.severity_level] - Filter by severity (high, medium, low)
 * @param {string} [params.status] - Filter by status (pending, resolved)
 * @returns {Promise<Array>} Array of incident objects
 */
export async function getIncidents({ limit = 100, offset = 0, severity_level, status } = {}) {
  const requestId = createRequestId('web-incidents');
  const start = performance.now();
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (severity_level) params.set('severity_level', severity_level);
  if (status) params.set('status', status);

  const response = await fetch(`${API_URL}/api/incidents?${params}`, {
    method: 'GET',
    headers: getAuthHeaders(requestId),
  });

  const data = await response.json();

  if (!response.ok) {
    logError(`[web][incidents][getIncidents] request_id=${requestId} status=${response.status}`);
    throw new Error(data.message || data.error || 'Failed to fetch incidents');
  }

  logInfo(`[web][incidents][getIncidents] request_id=${requestId} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);

  return data;
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
    headers: getAuthHeaders(requestId),
  });

  const data = await response.json();

  if (!response.ok) {
    logError(`[web][incidents][getIncidentById] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(data.message || data.error || 'Failed to fetch incident');
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
    headers: getAuthHeaders(requestId),
  });

  const data = await response.json();

  if (!response.ok) {
    logError(`[web][incidents][getIncidentWithAi] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(data.message || data.error || 'Failed to fetch incident AI metadata');
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
    headers: getAuthHeaders(requestId),
  });

  const data = await response.json();

  if (!response.ok) {
    logError(`[web][incidents][verifyIncident] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(data.error || 'Failed to verify incident');
  }

  logInfo(`[web][incidents][verifyIncident] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);

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
    headers: getAuthHeaders(requestId),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    logError(`[web][incidents][reclassifyIncident] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error(data.message || data.error || 'Failed to reclassify incident');
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
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      'x-request-id': requestId,
    },
  });

  if (!response.ok) {
    logError(`[web][incidents][getIncidentAudioUrl] request_id=${requestId} report_id=${id} status=${response.status}`);
    throw new Error('Failed to fetch audio');
  }

  const blob = await response.blob();
  logInfo(`[web][incidents][getIncidentAudioUrl] request_id=${requestId} report_id=${id} status=${response.status} latency_ms=${Math.round(performance.now() - start)}`);
  return URL.createObjectURL(blob);
}
