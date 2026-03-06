import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

async function apiRequest(path, { method = 'GET', body = null, requestPrefix = 'web-responders' } = {}) {
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
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Request failed'));
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
  return apiRequest(`/api/responders${query ? `?${query}` : ''}`, { requestPrefix: 'web-responders-list' });
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
  return apiRequest(`/api/responders/teams${query ? `?${query}` : ''}`, { requestPrefix: 'web-teams-list' });
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
  return apiRequest(`/api/responders/teams/${teamId}/members`, { requestPrefix: 'web-team-members-list' });
}

export async function addTeamMember(teamId, responder_id) {
  return apiRequest(`/api/responders/teams/${teamId}/members`, {
    method: 'POST',
    body: { responder_id },
    requestPrefix: 'web-team-members-add',
  });
}
