import { API_URL } from '@/core/config/app.config';
import { createRequestId, getAuthHeaders, getAuthToken, parseErrorMessage, parseJsonOrEmpty } from '@/data/api/http';

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
 * Partial profile update (name and/or address).
 * @param {{ firstName?: string, lastName?: string, address?: string }} fields
 */
export async function updateMe(fields = {}) {
  const requestId = createRequestId('web-auth-me-patch');
  const body = {};
  if (Object.prototype.hasOwnProperty.call(fields, 'firstName')) body.firstName = fields.firstName;
  if (Object.prototype.hasOwnProperty.call(fields, 'lastName')) body.lastName = fields.lastName;
  if (Object.prototype.hasOwnProperty.call(fields, 'address')) body.address = fields.address;

  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'PATCH',
    headers: getAuthHeaders({ requestId }),
    body: JSON.stringify(body),
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to update profile'));
  }
  return data.user;
}

let avatarInflight = null;
let avatarKnownMissing = false;

export function invalidateAvatarCache() {
  avatarKnownMissing = false;
}

/** @returns {Promise<Blob|null>} */
export async function fetchAvatarBlob() {
  if (avatarKnownMissing) return null;
  if (avatarInflight) return avatarInflight;

  avatarInflight = (async () => {
    const requestId = createRequestId('web-auth-avatar-get');
    const response = await fetch(`${API_URL}/api/auth/me/avatar`, {
      method: 'GET',
      headers: getAuthHeaders({ requestId, includeContentType: false }),
    });
    if (response.status === 404) {
      avatarKnownMissing = true;
      return null;
    }
    if (!response.ok) return null;
    avatarKnownMissing = false;
    return response.blob();
  })().finally(() => {
    avatarInflight = null;
  });

  return avatarInflight;
}

/**
 * @param {File} file
 * @returns {Promise<object>} updated user
 */
export async function uploadAvatar(file) {
  const requestId = createRequestId('web-auth-avatar-post');
  const token = getAuthToken();
  if (!token) throw new Error('No authentication token found');

  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`${API_URL}/api/auth/me/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-request-id': requestId,
    },
    body: formData,
  });

  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to upload profile photo'));
  }
  invalidateAvatarCache();
  return data.user;
}

/** @returns {Promise<object>} updated user */
export async function deleteAvatar() {
  const requestId = createRequestId('web-auth-avatar-delete');
  const response = await fetch(`${API_URL}/api/auth/me/avatar`, {
    method: 'DELETE',
    headers: getAuthHeaders({ requestId }),
  });
  const data = await parseJsonOrEmpty(response);
  if (!response.ok) {
    throw new Error(parseErrorMessage(data, 'Failed to remove profile photo'));
  }
  invalidateAvatarCache();
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
  if (!getAuthToken()) return;
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
