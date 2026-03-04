import { API_URL } from '@/core/config/app.config';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function createDispatch(payload) {
  const response = await fetch(`${API_URL}/api/dispatches`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Failed to create dispatch record');
  }
  return data;
}
