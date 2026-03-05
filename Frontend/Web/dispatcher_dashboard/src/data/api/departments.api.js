import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

export async function getDepartments() {
  const requestId = createRequestId('web-departments-list');
  const response = await fetch(`${API_URL}/api/departments`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId }),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to fetch departments'));
  }
  return data;
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
