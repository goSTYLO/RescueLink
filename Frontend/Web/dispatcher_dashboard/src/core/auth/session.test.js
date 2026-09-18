import { ROLES } from '@/core/constants';
import {
  clearAuthSession,
  getAuthToken,
  getStoredRole,
  getStoredUser,
  hasRoleAccess,
  persistAuthToken,
  persistAuthUser,
} from '@/core/auth/session';

describe('auth session utilities', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  test('getStoredUser returns parsed user object', () => {
    persistAuthUser({ role: 'super-admin', email: 'admin@example.com' });
    expect(getStoredUser()).toEqual({ role: 'super-admin', email: 'admin@example.com' });
  });

  test('getStoredUser reads localStorage when this tab has no session', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'dispatcher' }));
    expect(getStoredUser()).toEqual({ role: 'dispatcher' });
    expect(getStoredRole()).toBe(ROLES.DISPATCHER);
  });

  test('getStoredRole normalizes unknown values safely', () => {
    persistAuthUser({ role: 'Supervisor' });
    expect(getStoredRole()).toBe(ROLES.SUPER_ADMIN);
  });

  test('getStoredRole recognizes dispatcher role', () => {
    persistAuthUser({ role: 'dispatcher' });
    expect(getStoredRole()).toBe(ROLES.DISPATCHER);
  });

  test('hasRoleAccess enforces allowed role list', () => {
    expect(hasRoleAccess('super-admin', [ROLES.SUPER_ADMIN])).toBe(true);
    expect(hasRoleAccess('personnel', [ROLES.SUPER_ADMIN])).toBe(false);
    expect(hasRoleAccess('department-admin', [ROLES.DEPARTMENT_ADMIN, ROLES.SUPER_ADMIN])).toBe(true);
    expect(hasRoleAccess('dispatcher', [ROLES.SUPER_ADMIN, ROLES.DISPATCHER])).toBe(true);
  });

  test('hydrateAuthStores copies session token into localStorage for other tabs', () => {
    sessionStorage.setItem('token', 'legacy');
    sessionStorage.setItem('user', JSON.stringify({ role: 'dispatcher' }));
    expect(getAuthToken()).toBe('legacy');
    expect(localStorage.getItem('token')).toBe('legacy');
    expect(JSON.parse(localStorage.getItem('user')).role).toBe('dispatcher');
  });

  test('persistAuthToken writes both stores', () => {
    persistAuthToken('abc');
    expect(sessionStorage.getItem('token')).toBe('abc');
    expect(localStorage.getItem('token')).toBe('abc');
    expect(getAuthToken()).toBe('abc');
  });

  test('clearAuthSession removes local and session storage auth state', () => {
    persistAuthToken('abc');
    persistAuthUser({ role: 'personnel' });
    sessionStorage.setItem('temp', '1');

    clearAuthSession();

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(sessionStorage.getItem('temp')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
