import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

/**
 * Login as dispatcher (email + password).
 * When MFA is enabled, returns { sessionToken, message } instead of { user, token }.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user?: object, token?: string, sessionToken?: string, message?: string}>}
 */
export async function loginDispatcher(email, password) {
  const requestId = createRequestId('web-auth-login');
  const response = await fetch(`${API_URL}/api/auth/dispatcher/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Login failed'));
  }

  return data;
}

/**
 * Verify dispatcher MFA OTP and obtain JWT.
 * @param {string} sessionToken - From login response when MFA is enabled
 * @param {string} otp - 6-digit code from email
 * @returns {Promise<{user: object, token: string}>}
 */
export async function verifyDispatcherOtp(sessionToken, otp) {
  const requestId = createRequestId('web-auth-otp');
  const response = await fetch(`${API_URL}/api/auth/dispatcher/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
    body: JSON.stringify({ sessionToken, otp }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Verification failed'));
  }

  return data;
}

/**
 * Get current authenticated user profile
 * @returns {Promise<{user_id, phone, email, firstName, lastName, role, created_at, ...}>}
 */
export async function getMe() {
  const requestId = createRequestId('web-auth-me');

  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    headers: getAuthHeaders({ requestId, includeContentType: false }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to fetch profile'));
  }

  return data.user;
}

/**
 * Change password for authenticated user
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<{message: string}>}
 */
export async function changePassword(currentPassword, newPassword) {
  const requestId = createRequestId('web-auth-password');

  const response = await fetch(`${API_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const data = await parseJsonOrEmpty(response);

  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to change password'));
  }

  return data;
}

/**
 * Notify backend of logout (records audit log for dispatchers). Does not throw so
 * client can always clear local state and redirect.
 * @returns {Promise<void>}
 */
export async function logout() {
  if (!sessionStorage.getItem('token')) return;
  try {
    const requestId = createRequestId('web-auth-logout');
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders({ requestId }),
    });
    if (!response.ok) {
      console.warn('Logout API returned', response.status);
    }
  } catch (err) {
    console.warn('Logout API request failed:', err);
  }
}
