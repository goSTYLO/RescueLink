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

/**
 * Fetch dispatcher audit logs with optional filters.
 * @param {Object} params - Query parameters
 * @param {number} [params.limit=50] - Max records
 * @param {number} [params.offset=0] - Pagination offset
 * @param {string} [params.action] - Filter by action
 * @param {string} [params.resource_type] - Filter by resource_type
 * @param {string} [params.from] - ISO date/time from
 * @param {string} [params.to] - ISO date/time to
 * @returns {Promise<Array>} Audit log entries
 */
export async function getAuditLogs({ limit = 50, offset = 0, action, resource_type, from, to } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (action) params.set('action', action);
  if (resource_type) params.set('resource_type', resource_type);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const response = await fetch(`${API_URL}/api/audit-logs?${params}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to fetch audit logs');
  }
  return data;
}
