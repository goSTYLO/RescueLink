import { normalizeRole, ROLES } from '@/core/constants';

function readStore(key) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch {
    return sessionStorage.getItem(key);
  }
}

function writeStore(key, value) {
  sessionStorage.setItem(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode / quota
  }
}

function removeStore(key) {
  sessionStorage.removeItem(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function hydrateAuthStores() {
  try {
    for (const key of ['token', 'user']) {
      const ls = localStorage.getItem(key);
      const ss = sessionStorage.getItem(key);
      if (ss && !ls) localStorage.setItem(key, ss);
      if (ls && !ss) sessionStorage.setItem(key, ls);
    }
  } catch {
    // private mode / quota
  }
}

export function getAuthToken() {
  hydrateAuthStores();
  return readStore('token');
}

export function persistAuthToken(token) {
  if (!token) return;
  writeStore('token', token);
}

export function getStoredUser() {
  try {
    hydrateAuthStores();
    const raw = readStore('user');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function persistAuthUser(user) {
  if (user == null) return;
  writeStore('user', JSON.stringify(user));
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
  removeStore('user');
  removeStore('token');
  sessionStorage.clear();
}
