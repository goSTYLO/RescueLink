import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

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
