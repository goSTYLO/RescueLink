import { normalizeRole, ROLES } from '@/core/constants';

export function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem('user') || '{}');
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
  sessionStorage.removeItem('dispatcherMfaSessionToken');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.clear();
}
