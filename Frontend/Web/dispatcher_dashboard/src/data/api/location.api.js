import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

async function parseJsonResponse(response, fallbackMessage) {
  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, fallbackMessage));
  }
  return data;
}

export async function getClosestUnits(payload) {
  const requestId = createRequestId('web-location-units');
  const response = await fetch(`${API_URL}/api/location/closest-units`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response, 'Failed to fetch closest units');
}

export async function getGeofenceAlerts(payload) {
  const requestId = createRequestId('web-location-geofence');
  const response = await fetch(`${API_URL}/api/location/geofence-alerts`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response, 'Failed to fetch geofence alerts');
}

export async function getHeatmapHotspots(limit = 100) {
  const requestId = createRequestId('web-location-heatmap');
  const response = await fetch(`${API_URL}/api/location/heatmap?limit=${encodeURIComponent(String(limit))}`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId }),
  });
  return parseJsonResponse(response, 'Failed to fetch heatmap hotspots');
}
