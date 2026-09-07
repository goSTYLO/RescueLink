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

export async function undoDepartmentNotification(payload) {
  const requestId = createRequestId('web-dispatch-undo-department');
  const response = await fetch(`${API_URL}/api/dispatches/undo-department`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to undo department notification'));
  }
  return data;
}

export async function confirmSuggestion(payload) {
  const requestId = createRequestId('web-dispatch-confirm-suggestion');
  const response = await fetch(`${API_URL}/api/dispatches/confirm-suggestion`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to confirm team suggestion'));
  }
  return data;
}

export async function reassignTeam(payload) {
  const requestId = createRequestId('web-dispatch-reassign-team');
  const response = await fetch(`${API_URL}/api/dispatches/reassign-team`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to reassign team'));
  }
  return data;
}
