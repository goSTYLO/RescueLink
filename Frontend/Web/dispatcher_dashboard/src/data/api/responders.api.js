import { API_URL } from '@/core/config/app.config';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getResponders(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  const response = await fetch(`${API_URL}/api/responders${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Failed to fetch responders');
  }
  return data;
}
