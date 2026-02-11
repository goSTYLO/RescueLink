import { API_URL } from '@/core/config/app.config';

/**
 * Login as dispatcher (email + password)
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object, token: string}>}
 */
export async function loginDispatcher(email, password) {
  const response = await fetch(`${API_URL}/api/auth/dispatcher/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }

  return data;
}
