const isProduction = (typeof process !== 'undefined' ? process.env?.NODE_ENV : '') === 'production';
const recentLogMap = new Map();
const LOG_DEDUPE_WINDOW_MS = 15000;

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
