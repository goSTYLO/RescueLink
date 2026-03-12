import { getDefaultRouteByRole, ROLES } from '@/core/constants';

describe('role default routes', () => {
  test('routes department head users to assigned incidents', () => {
    expect(getDefaultRouteByRole(ROLES.DEPARTMENT_HEAD)).toBe('/department/assigned-incidents');
  });

  test('routes department admin users to department dashboard', () => {
    expect(getDefaultRouteByRole(ROLES.DEPARTMENT_ADMIN)).toBe('/department/dashboard');
  });

  test('routes personnel users to department tasks', () => {
    expect(getDefaultRouteByRole(ROLES.PERSONNEL)).toBe('/department/tasks');
  });

  test('routes dispatcher users to operations dashboard', () => {
    expect(getDefaultRouteByRole(ROLES.DISPATCHER)).toBe('/dashboard');
  });

  test('normalizes legacy role values before choosing a route', () => {
    expect(getDefaultRouteByRole('department head')).toBe('/department/assigned-incidents');
    expect(getDefaultRouteByRole('admin')).toBe('/dashboard');
  });
});