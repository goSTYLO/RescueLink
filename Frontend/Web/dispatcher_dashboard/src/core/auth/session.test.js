import { ROLES } from '@/core/constants';
import { clearAuthSession, getStoredRole, getStoredUser, hasRoleAccess } from '@/core/auth/session';

describe('auth session utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('getStoredUser returns parsed user object', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'super-admin', email: 'admin@example.com' }));
    expect(getStoredUser()).toEqual({ role: 'super-admin', email: 'admin@example.com' });
  });

  test('getStoredRole normalizes unknown values safely', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'Supervisor' }));
    expect(getStoredRole()).toBe(ROLES.SUPER_ADMIN);
  });

  test('hasRoleAccess enforces allowed role list', () => {
    expect(hasRoleAccess('super-admin', [ROLES.SUPER_ADMIN])).toBe(true);
    expect(hasRoleAccess('personnel', [ROLES.SUPER_ADMIN])).toBe(false);
    expect(hasRoleAccess('department-admin', [ROLES.DEPARTMENT_ADMIN, ROLES.SUPER_ADMIN])).toBe(true);
  });

  test('clearAuthSession removes local and session storage auth state', () => {
    localStorage.setItem('token', 'abc');
    localStorage.setItem('user', JSON.stringify({ role: 'personnel' }));
    sessionStorage.setItem('temp', '1');

    clearAuthSession();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(sessionStorage.getItem('temp')).toBeNull();
  });
});
