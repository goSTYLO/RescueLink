import { API_URL } from '@/core/config/app.config';
import { getAuthHeaders, getAuthToken, parseErrorMessage, createRequestId, parseJsonOrEmpty } from './http';

export async function listApplications({ status = null, limit = 20, offset = 0 } = {}) {
  const requestId = createRequestId('list-responder-apps');
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (limit) params.append('limit', limit);
  if (offset) params.append('offset', offset);

  const response = await fetch(`${API_URL}/api/responder-applications?${params.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId }),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to fetch responder applications'));
  }

  return {
    applications: data.applications || [],
    total: data.total || 0,
  };
}

export async function getApplicationById(id) {
  const requestId = createRequestId('get-responder-app');
  const response = await fetch(`${API_URL}/api/responder-applications/${id}`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId }),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to fetch application detail'));
  }

  return data;
}

export async function updateApplicationStatus(id, { status, notes }) {
  const requestId = createRequestId('update-responder-app');
  const response = await fetch(`${API_URL}/api/responder-applications/${id}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify({ status, notes }),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to update application status'));
  }

  return data;
}

export async function revokeResponderRole(id, { reason, reason_other, admin_password }) {
  const requestId = createRequestId('revoke-responder-role');
  const response = await fetch(`${API_URL}/api/responder-applications/${id}/revoke`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify({ reason, reason_other, admin_password }),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    const baseMessage = parseErrorMessage(data, 'Failed to revoke responder role');
    if (response.status === 409 && Array.isArray(data.active_incidents)) {
      const ids = data.active_incidents.map((i) => `#${i.report_id}`).join(', ');
      throw new Error(`${baseMessage} Active incidents: ${ids}. Resolve them before revoking.`);
    }
    throw new Error(baseMessage);
  }

  return data;
}

export function getDocumentUrl(id, filepath) {
  if (!filepath) return '#';
  const filename = filepath.split('/').pop();
  const token = getAuthToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${API_URL}/api/responder-applications/${id}/documents/${encodeURIComponent(filename)}${query}`;
}
