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

export async function getResponders({ limit = 100, offset = 0, organization, availability_status } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (organization) params.set('organization', organization);
  if (availability_status) params.set('availability_status', availability_status);

  const response = await fetch(`${API_URL}/api/responders?${params}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to fetch responders');
  }
  return data;
}

export async function createResponder(payload) {
  const response = await fetch(`${API_URL}/api/responders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to create responder');
  }
  return data;
}

export async function updateResponder(id, payload) {
  const response = await fetch(`${API_URL}/api/responders/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to update responder');
  }
  return data;
}

export async function deleteResponder(id) {
  const response = await fetch(`${API_URL}/api/responders/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to delete responder');
  }
  return data;
}
