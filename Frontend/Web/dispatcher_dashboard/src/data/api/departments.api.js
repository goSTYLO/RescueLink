import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

const READ_CACHE_TTL_MS = 20000;
const readCache = new Map();
const inflightMap = new Map();
let rateLimitUntilMs = 0;

function getRetryAfterMs(response) {
  const retryAfter = response.headers?.get?.('retry-after');
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return 30000;
}

function assertNotRateLimited() {
  if (Date.now() < rateLimitUntilMs) {
    const seconds = Math.max(1, Math.ceil((rateLimitUntilMs - Date.now()) / 1000));
    throw new Error(`Rate limited by server. Retry in ~${seconds}s.`);
  }
}

async function readWithCache(key, fetcher) {
  assertNotRateLimited();
  const cached = readCache.get(key);
  if (cached && Date.now() - cached.timestamp < READ_CACHE_TTL_MS) {
    return cached.data;
  }
  if (inflightMap.has(key)) {
    return inflightMap.get(key);
  }

  const req = (async () => {
    try {
      const data = await fetcher();
      readCache.set(key, { data, timestamp: Date.now() });
      return data;
    } finally {
      inflightMap.delete(key);
    }
  })();

  inflightMap.set(key, req);
  return req;
}

export async function getDepartments() {
  return readWithCache('departments:list', async () => {
    const requestId = createRequestId('web-departments-list');
    const response = await fetch(`${API_URL}/api/departments`, {
      method: 'GET',
      headers: getAuthHeaders({ requestId }),
    });

    const data = await parseJsonOrEmpty(response);
    if (response.status === 429) {
      rateLimitUntilMs = Date.now() + getRetryAfterMs(response);
      throw new Error(parseErrorMessage(data, 'Rate limited by server. Retry in ~30s.'));
    }
    if (!response.ok) {
      throw new Error(parseErrorMessage(data, 'Failed to fetch departments'));
    }
    return data;
  });
}

export async function createDepartment(payload) {
  const requestId = createRequestId('web-departments-create');
  const response = await fetch(`${API_URL}/api/departments`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to create department'));
  }
  return data;
}

export async function getDepartmentById(id) {
  return readWithCache(`departments:detail:${id}`, async () => {
    const requestId = createRequestId('web-departments-detail');
    const response = await fetch(`${API_URL}/api/departments/${id}`, {
      method: 'GET',
      headers: getAuthHeaders({ requestId }),
    });

    const data = await parseJsonOrEmpty(response);
    if (response.status === 429) {
      rateLimitUntilMs = Date.now() + getRetryAfterMs(response);
      throw new Error(parseErrorMessage(data, 'Rate limited by server. Retry in ~30s.'));
    }
    if (!response.ok) {
      throw new Error(parseErrorMessage(data, 'Failed to fetch department'));
    }
    return data;
  });
}

export async function updateDepartment(id, payload) {
  const requestId = createRequestId('web-departments-update');
  const response = await fetch(`${API_URL}/api/departments/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to update department'));
  }
  return data;
}

export async function deleteDepartment(id) {
  const requestId = createRequestId('web-departments-delete');
  const response = await fetch(`${API_URL}/api/departments/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders({ requestId }),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to delete department'));
  }
  return data;
}
