import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

/**
 * Fetch dispatches with optional filters (for department view and dashboard)
 * @param {Object} params
 * @param {number} [params.limit=100]
 * @param {number} [params.offset=0]
 * @param {string} [params.department_code]
 * @param {number} [params.report_id]
 * @param {string} [params.response_status]
 * @returns {Promise<Array>}
 */
export async function getDispatches({
  limit = 100,
  offset = 0,
  department_code,
  report_id,
  response_status,
} = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (department_code) params.set('department_code', String(department_code).trim());
  if (report_id != null) params.set('report_id', String(report_id));
  if (response_status) params.set('response_status', String(response_status).trim());

  const requestId = createRequestId('web-dispatch-list');
  const response = await fetch(`${API_URL}/api/dispatches?${params}`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId, includeContentType: false }),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to fetch dispatches'));
  }
  return Array.isArray(data) ? data : [];
}

export async function createDispatch(payload) {
  const requestId = createRequestId('web-dispatch-create');
  const response = await fetch(`${API_URL}/api/dispatches`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to create dispatch record'));
  }
  return data;
}
