import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

const inflight = new Map();
let geojsonCache = null;

function withInflight(key, fn) {
  const existing = inflight.get(key);
  if (existing) return existing;
  const req = fn().finally(() => inflight.delete(key));
  inflight.set(key, req);
  return req;
}

function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'boolean') {
      search.set(key, value ? 'true' : 'false');
      return;
    }
    search.set(key, String(value));
  });
  return search.toString();
}

export async function getAnalyticsOverview(params = {}) {
  const query = buildQuery(params);
  return withInflight(`overview:${query}`, async () => {
    const requestId = createRequestId('web-analytics-overview');
    const response = await fetch(`${API_URL}/api/analytics/overview${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: getAuthHeaders({ requestId }),
    });
    const data = await parseJsonOrEmpty(response);
    if (!response.ok) {
      throw new Error(parseErrorMessage(data, 'Failed to load insights'));
    }
    return data;
  });
}

export async function getAnalyticsIncidents(params = {}) {
  const query = buildQuery(params);
  return withInflight(`incidents:${query}`, async () => {
    const requestId = createRequestId('web-analytics-incidents');
    const response = await fetch(`${API_URL}/api/analytics/incidents${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: getAuthHeaders({ requestId }),
    });
    const data = await parseJsonOrEmpty(response);
    if (!response.ok) {
      throw new Error(parseErrorMessage(data, 'Failed to load insight incidents'));
    }
    const total = Number(response.headers.get('x-total-count') || data.total || 0);
    return { items: data.items || [], total, limit: data.limit, offset: data.offset };
  });
}

function saveBlob(blob, filename) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}

export function analyticsExportUrl(params = {}) {
  const query = buildQuery(params);
  return `${API_URL}/api/analytics/export.csv${query ? `?${query}` : ''}`;
}

export function analyticsXlsxUrl(params = {}) {
  const query = buildQuery(params);
  return `${API_URL}/api/analytics/export.xlsx${query ? `?${query}` : ''}`;
}

async function downloadAnalyticsFile(url, fallbackName, failLabel) {
  const requestId = createRequestId('web-analytics-export');
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders({ requestId, includeContentType: false }),
  });
  if (!response.ok) {
    const data = await parseJsonOrEmpty(response);
    throw new Error(parseErrorMessage(data, failLabel));
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  saveBlob(blob, match?.[1] || fallbackName);
}

export async function downloadAnalyticsCsv(params = {}) {
  await downloadAnalyticsFile(analyticsExportUrl(params), 'insights-export.csv', 'Failed to export CSV');
}

export async function downloadAnalyticsXlsx(params = {}) {
  await downloadAnalyticsFile(analyticsXlsxUrl(params), 'insights-export.xlsx', 'Failed to export Excel');
}

export async function getBarangaysGeojson() {
  if (geojsonCache) return geojsonCache;
  return withInflight('geojson', async () => {
    const requestId = createRequestId('web-analytics-geojson');
    const response = await fetch(`${API_URL}/api/analytics/barangays.geojson`, {
      method: 'GET',
      headers: getAuthHeaders({ requestId, includeContentType: false }),
    });
    const data = await parseJsonOrEmpty(response);
    if (!response.ok) {
      throw new Error(parseErrorMessage(data, 'Failed to load barangay map'));
    }
    geojsonCache = data;
    return data;
  });
}
