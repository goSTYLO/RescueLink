import { normalizeRole, ROLES } from '@/core/constants';

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

export function getStoredRole() {
  return normalizeRole(getStoredUser()?.role);
}

export function hasRoleAccess(currentRole, allowedRoles = []) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }
  return allowedRoles.includes(normalizeRole(currentRole || ROLES.PERSONNEL));
}

export function clearAuthSession() {
  localStorage.removeItem('dispatcherMfaSessionToken');
  localStorage.removeItem('dashboard:filters:v1');
  localStorage.removeItem('map:filters:v1');
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  sessionStorage.clear();
}
