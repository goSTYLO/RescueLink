import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

/**
 * List users with pagination (admin)
 * @param {{ page?: number, limit?: number }} opts
 * @returns {Promise<{ users: Array, pagination: { page, limit, total, pages } }>}
 */
export async function listUsers({ page = 1, limit = 20 } = {}) {
  const requestId = createRequestId('web-admin-users-list');
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await fetch(`${API_URL}/api/admin/users?${params}`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId }),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to fetch users'));
  }
  return data;
}

/**
 * Create a new user (admin)
 * @param {{ email: string, password: string, first_name?: string, last_name?: string, role: string, department_id?: number }} payload
 */
export async function createUser(payload) {
  const requestId = createRequestId('web-admin-users-create');
  const response = await fetch(`${API_URL}/api/admin/users`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to create user'));
  }
  return data;
}

/**
 * Update user role (and optional department_id) (admin)
 * @param {number} userId
 * @param {{ role: string, department_id?: number | null }} payload
 */
export async function updateUserRole(userId, payload) {
  const requestId = createRequestId('web-admin-users-role');
  const response = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to update user role'));
  }
  return data;
}

/**
 * Deactivate a user (admin)
 * @param {number} userId
 */
export async function deactivateUser(userId) {
  const requestId = createRequestId('web-admin-users-deactivate');
  const response = await fetch(`${API_URL}/api/admin/users/${userId}/deactivate`, {
    method: 'PUT',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify({}),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to deactivate user'));
  }
  return data;
}
