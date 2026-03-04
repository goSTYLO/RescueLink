import { API_URL } from '@/core/config/app.config';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonResponse(response, fallbackMessage) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || fallbackMessage);
  }
  return data;
}

export async function getClosestUnits(payload) {
  const response = await fetch(`${API_URL}/api/location/closest-units`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response, 'Failed to fetch closest units');
}

export async function getGeofenceAlerts(payload) {
  const response = await fetch(`${API_URL}/api/location/geofence-alerts`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response, 'Failed to fetch geofence alerts');
}

export async function getHeatmapHotspots(limit = 100) {
  const response = await fetch(`${API_URL}/api/location/heatmap?limit=${encodeURIComponent(String(limit))}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return parseJsonResponse(response, 'Failed to fetch heatmap hotspots');
}
