import { API_URL } from '@/core/config/app.config';

/**
 * Login as dispatcher (email + password).
 * When MFA is enabled, returns { sessionToken, message } instead of { user, token }.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user?: object, token?: string, sessionToken?: string, message?: string}>}
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

/**
 * Verify dispatcher MFA OTP and obtain JWT.
 * @param {string} sessionToken - From login response when MFA is enabled
 * @param {string} otp - 6-digit code from email
 * @returns {Promise<{user: object, token: string}>}
 */
export async function verifyDispatcherOtp(sessionToken, otp) {
  const response = await fetch(`${API_URL}/api/auth/dispatcher/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, otp }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Verification failed');
  }

  return data;
}

/**
 * Get current authenticated user profile
 * @returns {Promise<{user_id, phone, email, firstName, lastName, role, created_at, ...}>}
 */
export async function getMe() {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch profile');
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
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to change password');
  }

  return data;
}

/**
 * Notify backend of logout (records audit log for dispatchers). Does not throw so
 * client can always clear local state and redirect.
 * @returns {Promise<void>}
 */
export async function logout() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      console.warn('Logout API returned', response.status);
    }
  } catch (err) {
    console.warn('Logout API request failed:', err);
  }
}
