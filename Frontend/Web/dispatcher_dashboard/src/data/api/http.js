const isProduction = (typeof process !== 'undefined' ? process.env?.NODE_ENV : '') === 'production';
const recentLogMap = new Map();
const LOG_DEDUPE_WINDOW_MS = 15000;
const LATENCY_EVENTS_STORAGE_KEY = 'rescuelink:web:latency-events';
const LATENCY_EVENTS_LIMIT = 200;

export function createRequestId(prefix = 'web') {
  const randomPart = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

export function getAuthToken() {
  return sessionStorage.getItem('token');
}

export function getAuthHeaders({ requestId, includeContentType = true } = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (requestId) {
    headers['x-request-id'] = requestId;
  }

  return headers;
}

export function parseErrorMessage(data, fallbackMessage) {
  return data?.message || data?.error || fallbackMessage;
}

export async function parseJsonOrEmpty(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function logInfo(message) {
  if (!isProduction) {
    console.info(message);
  }
}

function shouldLog(key) {
  const now = Date.now();
  const previous = recentLogMap.get(key) || 0;
  if (now - previous < LOG_DEDUPE_WINDOW_MS) {
    return false;
  }
  recentLogMap.set(key, now);
  return true;
}

export function logWarn(message, key = message) {
  if (!shouldLog(`warn:${key}`)) return;
  console.warn(message);
}

export function logError(message) {
  if (!shouldLog(`error:${message}`)) return;
  console.error(message);
}

function normalizeUrlForMetrics(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '/unknown';
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(rawUrl, base);
    return url.pathname
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/(\d+)(?=\/|$)/g, '/:id');
  } catch {
    return rawUrl.split('?')[0];
  }
}

function parseHeaderValue(headers, key) {
  if (!headers) return '';
  if (typeof headers.get === 'function') {
    return headers.get(key) || '';
  }
  const matchedKey = Object.keys(headers).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  return matchedKey ? String(headers[matchedKey]) : '';
}

function getStoredLatencyEvents() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(LATENCY_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setStoredLatencyEvents(events) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LATENCY_EVENTS_STORAGE_KEY, JSON.stringify(events.slice(-LATENCY_EVENTS_LIMIT)));
  } catch {
    // Ignore storage failures (private mode/quota issues)
  }
}

function recordLatencyEvent(event) {
  const events = getStoredLatencyEvents();
  events.push(event);
  setStoredLatencyEvents(events);
}

function installFetchTimingInstrumentation() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  if (window.__rescuelinkFetchInstrumented) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const startedAt = performance.now();
    const method = ((init && init.method) || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : input?.url || '';
    const requestId =
      parseHeaderValue(init.headers, 'x-request-id') ||
      (typeof input !== 'string' ? parseHeaderValue(input?.headers, 'x-request-id') : '');

    try {
      const response = await nativeFetch(input, init);
      const latencyMs = Math.round(performance.now() - startedAt);

      recordLatencyEvent({
        at: new Date().toISOString(),
        method,
        path: normalizeUrlForMetrics(url),
        status: response.status,
        latencyMs,
        requestId: requestId || response.headers.get('x-request-id') || null,
      });

      logInfo(
        `[web][timing] request_id=${requestId || 'none'} method=${method} path=${normalizeUrlForMetrics(url)} status=${response.status} latency_ms=${latencyMs}`
      );

      return response;
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);
      recordLatencyEvent({
        at: new Date().toISOString(),
        method,
        path: normalizeUrlForMetrics(url),
        status: 0,
        latencyMs,
        requestId: requestId || null,
        error: error?.message || 'fetch_failed',
      });
      throw error;
    }
  };

  window.__rescuelinkFetchInstrumented = true;
}

export function getLatencyEventsSnapshot() {
  return getStoredLatencyEvents();
}

export function clearLatencyEventsSnapshot() {
  setStoredLatencyEvents([]);
}

installFetchTimingInstrumentation();
