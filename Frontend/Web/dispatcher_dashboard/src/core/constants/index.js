// User roles - used for nav and access control
export const ROLES = {
  SUPER_ADMIN: 'super-admin',
  DISPATCHER: 'dispatcher',
  DEPARTMENT_ADMIN: 'department-admin',
  DEPARTMENT_HEAD: 'department-head',
  PERSONNEL: 'personnel',
};

// Map API/legacy role names to internal role
export function normalizeRole(role) {
  if (!role) return ROLES.PERSONNEL;
  const r = String(role).toLowerCase();
  if (r === 'admin' || r === 'super-admin' || r === 'superadmin') return ROLES.SUPER_ADMIN;
  if (r === 'dispatcher') return ROLES.DISPATCHER;
  if (r === 'department-admin' || r === 'dept admin' || r === 'department admin') return ROLES.DEPARTMENT_ADMIN;
  if (r === 'department-head' || r === 'department head') return ROLES.DEPARTMENT_HEAD;
  if (r === 'personnel' || r === 'operator' || r === 'supervisor') return r === 'personnel' ? ROLES.PERSONNEL : ROLES.SUPER_ADMIN;
  return ROLES.PERSONNEL;
}

export function isSuperAdmin(role) {
  return normalizeRole(role) === ROLES.SUPER_ADMIN;
}

export function isDepartmentAdmin(role) {
  return normalizeRole(role) === ROLES.DEPARTMENT_ADMIN;
}

export function isPersonnel(role) {
  return normalizeRole(role) === ROLES.PERSONNEL;
}
