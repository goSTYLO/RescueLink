/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines all roles and their permissions in the RescueLink system
 */

const ROLES = {
  USER: 'user',           // Mobile app users who report incidents
  DISPATCHER: 'dispatcher', // Web app administrators who manage dispatches
  ADMIN: 'admin'          // Super-users with full system access
};

/**
 * Permissions matrix: Maps roles to allowed actions per resource
 * Structure: PERMISSIONS[role][resource] = [actions]
 * 
 * Actions:
 * - 'create' – Create new resource
 * - 'read' – Read all resources (global visibility)
 * - 'readOwn' – Read only own resources (ownership-based)
 * - 'update' – Update all resources
 * - 'updateOwn' – Update only own resources
 * - 'delete' – Delete all resources
 * - 'deleteOwn' – Delete only own resources
 * - 'list' – List resources (may be filtered by role)
 * - 'listAll' – List all resources regardless of ownership
 * - 'manage' – Full management (create, read, update, delete all)
 */
const PERMISSIONS = {
  [ROLES.USER]: {
    incidents: ['create', 'readOwn', 'updateOwn', 'deleteOwn'],
    dispatches: [],
    responders: [],
    notifications: ['readOwn'],
    auditLogs: [],
    users: [],
    settings: []
  },
  [ROLES.DISPATCHER]: {
    incidents: ['create', 'read', 'update', 'delete', 'list', 'listAll', 'manage'],
    dispatches: ['create', 'read', 'update', 'delete', 'list', 'listAll', 'manage'],
    responders: ['create', 'read', 'update', 'delete', 'list', 'listAll', 'manage'],
    notifications: ['create', 'read', 'update', 'delete', 'list', 'manage'],
    auditLogs: ['readOwn'],  // Read only own dispatcher actions
    users: [],
    settings: []
  },
  [ROLES.ADMIN]: {
    incidents: ['manage'],      // Full access (create, read, update, delete)
    dispatches: ['manage'],
    responders: ['manage'],
    notifications: ['manage'],
    auditLogs: ['read', 'list', 'listAll'],  // Read all audit logs
    users: ['create', 'read', 'list', 'update', 'delete'],  // User management
    settings: ['manage']
  }
};

/**
 * Resource types used in audit logging and permissions checks
 */
const RESOURCES = {
  INCIDENT: 'incident',
  DISPATCH: 'dispatch',
  RESPONDER: 'responder',
  NOTIFICATION: 'notification',
  AUDIT_LOG: 'auditLog',
  USER: 'user',
  SETTINGS: 'settings'
};

/**
 * Check if a role has permission to perform an action on a resource
 * @param {string} role - User role (USER, DISPATCHER, ADMIN)
 * @param {string} resource - Resource type (incident, dispatch, etc.)
 * @param {string} action - Action to perform (create, read, update, delete)
 * @returns {boolean} True if permission exists
 */
function hasPermission(role, resource, action) {
  if (!PERMISSIONS[role]) return false;
  if (!PERMISSIONS[role][resource]) return false;
  return PERMISSIONS[role][resource].includes(action) || 
         PERMISSIONS[role][resource].includes('manage');
}

/**
 * Check if a role requires ownership checks for an action
 * E.g., 'user' role with 'readOwn' action = ownership required
 * @param {string} role - User role
 * @param {string} resource - Resource type
 * @param {string} action - Action to perform
 * @returns {boolean} True if role must own the resource for this action
 */
function requiresOwnership(role, resource, action) {
  const ownershipActions = ['readOwn', 'updateOwn', 'deleteOwn'];
  if (PERMISSIONS[role] && PERMISSIONS[role][resource]) {
    return PERMISSIONS[role][resource].includes(action) && ownershipActions.includes(action);
  }
  return false;
}

module.exports = {
  ROLES,
  PERMISSIONS,
  RESOURCES,
  hasPermission,
  requiresOwnership
};
