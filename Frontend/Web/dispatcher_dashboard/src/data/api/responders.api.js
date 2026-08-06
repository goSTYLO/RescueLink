import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

const READ_CACHE_TTL_MS = 20000;
const readCache = new Map();
const inflightMap = new Map();
let rateLimitUntilMs = 0;

function getRetryAfterMs(response) {
  const retryAfter = response.headers?.get?.('retry-after');
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return 30000;
}

function assertNotRateLimited() {
  if (Date.now() < rateLimitUntilMs) {
    const seconds = Math.max(1, Math.ceil((rateLimitUntilMs - Date.now()) / 1000));
    throw new Error(`Rate limited by server. Retry in ~${seconds}s.`);
  }
}

function invalidateReadCache() {
  readCache.clear();
}

async function readWithCache(key, fetcher) {
  assertNotRateLimited();
  const cached = readCache.get(key);
  if (cached && Date.now() - cached.timestamp < READ_CACHE_TTL_MS) {
    return cached.data;
  }
  if (inflightMap.has(key)) {
    return inflightMap.get(key);
  }

  const req = (async () => {
    try {
      const data = await fetcher();
      readCache.set(key, { data, timestamp: Date.now() });
      return data;
    } finally {
      inflightMap.delete(key);
    }
  })();

  inflightMap.set(key, req);
  return req;
}

async function apiRequest(path, { method = 'GET', body = null, requestPrefix = 'web-responders' } = {}) {
  assertNotRateLimited();
  const requestId = createRequestId(requestPrefix);
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...getAuthHeaders({ requestId }),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await parseJsonOrEmpty(response);
  if (response.status === 429) {
    rateLimitUntilMs = Date.now() + getRetryAfterMs(response);
    throw new Error(parseErrorMessage(data, 'Rate limited by server. Retry in ~30s.'));
  }
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Request failed'));
  }
  if (method !== 'GET') {
    invalidateReadCache();
  }
  return data;
}

export async function getResponders(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const path = `/api/responders${query ? `?${query}` : ''}`;
  return readWithCache(`responders:list:${query}`, () => apiRequest(path, { requestPrefix: 'web-responders-list' }));
}

export async function createResponder(payload) {
  return apiRequest('/api/responders', { method: 'POST', body: payload, requestPrefix: 'web-responders-create' });
}

export async function updateResponder(responderId, payload) {
  return apiRequest(`/api/responders/${responderId}`, { method: 'PUT', body: payload, requestPrefix: 'web-responders-update' });
}

export async function updateResponderStatus(responderId, availability_status) {
  return apiRequest(`/api/responders/${responderId}/status`, {
    method: 'PATCH',
    body: { availability_status },
    requestPrefix: 'web-responders-status',
  });
}

export async function getResponderTeams(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  const path = `/api/responders/teams${query ? `?${query}` : ''}`;
  return readWithCache(`responders:teams:${query}`, () => apiRequest(path, { requestPrefix: 'web-teams-list' }));
}

export async function createResponderTeam(payload) {
  return apiRequest('/api/responders/teams', { method: 'POST', body: payload, requestPrefix: 'web-teams-create' });
}

export async function updateResponderTeam(teamId, payload) {
  return apiRequest(`/api/responders/teams/${teamId}`, { method: 'PUT', body: payload, requestPrefix: 'web-teams-update' });
}

export async function updateResponderTeamStatus(teamId, team_status) {
  return apiRequest(`/api/responders/teams/${teamId}/status`, {
    method: 'PATCH',
    body: { team_status },
    requestPrefix: 'web-teams-status',
  });
}

export async function getTeamMembers(teamId) {
  return readWithCache(
    `responders:team-members:${teamId}`,
    () => apiRequest(`/api/responders/teams/${teamId}/members`, { requestPrefix: 'web-team-members-list' })
  );
}

export async function addTeamMember(teamId, responder_id) {
  return apiRequest(`/api/responders/teams/${teamId}/members`, {
    method: 'POST',
    body: { responder_id },
    requestPrefix: 'web-team-members-add',
  });
}

export async function removeTeamMember(teamId, responderId) {
  return apiRequest(`/api/responders/teams/${teamId}/members/${responderId}`, {
    method: 'DELETE',
    requestPrefix: 'web-team-members-remove',
  });
}
