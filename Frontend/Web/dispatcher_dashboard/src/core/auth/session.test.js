import { ROLES } from '@/core/constants';
import { clearAuthSession, getStoredRole, getStoredUser, hasRoleAccess } from '@/core/auth/session';

describe('auth session utilities', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.clear();
  });

  test('getStoredUser returns parsed user object', () => {
    sessionStorage.setItem('user', JSON.stringify({ role: 'super-admin', email: 'admin@example.com' }));
    expect(getStoredUser()).toEqual({ role: 'super-admin', email: 'admin@example.com' });
  });

  test('getStoredRole normalizes unknown values safely', () => {
    sessionStorage.setItem('user', JSON.stringify({ role: 'Supervisor' }));
    expect(getStoredRole()).toBe(ROLES.SUPER_ADMIN);
  });

  test('getStoredRole recognizes dispatcher role', () => {
    sessionStorage.setItem('user', JSON.stringify({ role: 'dispatcher' }));
    expect(getStoredRole()).toBe(ROLES.DISPATCHER);
  });

  test('hasRoleAccess enforces allowed role list', () => {
    expect(hasRoleAccess('super-admin', [ROLES.SUPER_ADMIN])).toBe(true);
    expect(hasRoleAccess('personnel', [ROLES.SUPER_ADMIN])).toBe(false);
    expect(hasRoleAccess('department-admin', [ROLES.DEPARTMENT_ADMIN, ROLES.SUPER_ADMIN])).toBe(true);
    expect(hasRoleAccess('dispatcher', [ROLES.SUPER_ADMIN, ROLES.DISPATCHER])).toBe(true);
  });

  test('clearAuthSession removes local and session storage auth state', () => {
    sessionStorage.setItem('token', 'abc');
    sessionStorage.setItem('user', JSON.stringify({ role: 'personnel' }));
    sessionStorage.setItem('temp', '1');

    clearAuthSession();

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(sessionStorage.getItem('temp')).toBeNull();
  });
});
