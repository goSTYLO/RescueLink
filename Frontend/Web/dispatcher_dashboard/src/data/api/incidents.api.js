import { API_URL } from '@/core/config/app.config';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Fetch all incidents with optional filters and pagination
 * @param {Object} params - Query parameters
 * @param {number} [params.limit=100] - Number of records to return
 * @param {number} [params.offset=0] - Number of records to skip
 * @param {string} [params.severity_level] - Filter by severity (high, medium, low)
 * @param {string} [params.status] - Filter by status (pending, verified, resolved)
 * @returns {Promise<Array>} Array of incident objects
 */
export async function getIncidents({ limit = 100, offset = 0, severity_level, status } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (severity_level) params.set('severity_level', severity_level);
  if (status) params.set('status', status);

  const response = await fetch(`${API_URL}/api/incidents?${params}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Failed to fetch incidents');
  }

  return data;
}

/**
 * Fetch a single incident by ID
 * @param {number|string} id - Incident report ID
 * @returns {Promise<Object>} Incident object
 */
export async function getIncidentById(id) {
  const response = await fetch(`${API_URL}/api/incidents/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Failed to fetch incident');
  }

  return data;
}

/**
 * Verify incident and record on blockchain
 * @param {number|string} id - Incident report ID
 * @returns {Promise<Object>} { success, verified, blockchain }
 */
export async function verifyIncident(id) {
  const response = await fetch(`${API_URL}/api/incidents/${id}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to verify incident');
  }

  return data;
}

/**
 * Fetch incident audio and return a blob URL for playback (requires auth)
 * @param {number|string} id - Incident report ID
 * @returns {Promise<string>} Blob URL for the audio (caller should revoke when done)
 */
export async function getIncidentAudioUrl(id) {
  const response = await fetch(`${API_URL}/api/incidents/${id}/audio`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch audio');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
