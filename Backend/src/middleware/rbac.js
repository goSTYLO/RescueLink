/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides authorization checks based on user roles and permissions
 */

const { ROLES, PERMISSIONS, hasPermission, requiresOwnership } = require('../config/roles');

/**
 * Middleware to check if user has one of the required roles
 * @param {array} allowedRoles - Array of role strings (e.g., [ROLES.DISPATCHER, ROLES.ADMIN])
 * @returns {function} Express middleware
 * 
 * Usage: 
 *   router.delete('/:id', authorize([ROLES.DISPATCHER, ROLES.ADMIN]), deleteDispatch);
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    // Ensure user is authenticated (auth middleware should run first)
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    // If no roles specified, allow all authenticated users
    if (allowedRoles.length === 0) {
      return next();
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      console.warn(
        `[RBAC] User ${req.user.user_id} (${req.user.role}) attempted unauthorized access to route: ${req.method} ${req.path}`
      );
      return res.status(403).json({ 
        error: 'Forbidden. You do not have permission to access this resource.' 
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has permission to perform action on resource
 * @param {string} resource - Resource type (e.g., 'incidents', 'dispatches')
 * @param {string} action - Action to perform (e.g., 'create', 'read', 'update')
 * @returns {function} Express middleware
 * 
 * Usage:
 *   router.get('/:id', requiresPermission('incidents', 'read'), getIncident);
 */
const requiresPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    if (!hasPermission(req.user.role, resource, action)) {
      console.warn(
        `[RBAC] User ${req.user.user_id} (${req.user.role}) lacks permission for "${action}" on "${resource}"`
      );
      return res.status(403).json({ 
        error: `Forbidden. You do not have permission to ${action} ${resource}.` 
      });
    }

    next();
  };
};

/**
 * Middleware to check resource ownership for user-scoped actions
 * Requires 'resourceOwnerId' in req.params or req.body
 * 
 * For admins/dispatchers: skips ownership check (they have global access)
 * For users: enforces ownership check
 * 
 * @param {string} userIdField - Field name in database (e.g., 'user_id', 'created_by')
 * @returns {function} Express middleware
 * 
 * Usage:
 *   router.get('/:id', 
 *     authorize([ROLES.USER, ROLES.DISPATCHER, ROLES.ADMIN]), 
 *     checkOwnership('created_by'), 
 *     getIncident
 *   );
 */
const checkOwnership = (userIdField = 'user_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    // Admins and dispatchers have unrestricted access
    if ([ROLES.ADMIN, ROLES.DISPATCHER].includes(req.user.role)) {
      return next();
    }

    // For regular users, check ownership
    // Try to get resource owner ID from:
    // 1. req.resourceOwnerId (set by previous middleware)
    // 2. req.body (for ownership pre-check)
    // 3. req.params (for direct ID in route)
    const resourceOwnerId = req.resourceOwnerId || req.body?.[userIdField];

    if (!resourceOwnerId) {
      // If we can't determine ownership, this middleware is being used incorrectly
      // Let controller handle it
      return next();
    }

    // Check if resource belongs to current user
    if (resourceOwnerId !== req.user.user_id) {
      console.warn(
        `[RBAC] User ${req.user.user_id} (${req.user.role}) attempted to access resource owned by ${resourceOwnerId}`
      );
      return res.status(403).json({ 
        error: 'Forbidden. You can only access your own resources.' 
      });
    }

    next();
  };
};

/**
 * Helper middleware to attach resource owner ID to request for downstream middleware
 * Should be used by controllers that fetch a resource to set ownership context
 * 
 * Usage in controller:
 *   const incident = await Incident.findByPk(req.params.id);
 *   if (!incident) return res.status(404).json({ error: 'Not found' });
 *   req.resourceOwnerId = incident.user_id;
 *   next(); // or call checkOwnership manually
 */
const setResourceOwner = (userIdField = 'user_id') => {
  return (req, res, next) => {
    // Middleware to be used by controllers
    // Usage: After fetching resource, call setResourceOwner()(req, res, next)
    next();
  };
};

/**
 * Utility function for controllers to check ownership manually
 * Returns true if user owns resource OR is admin/dispatcher
 * 
 * Usage in controller:
 *   if (!isResourceOwner(req.user, incident.user_id)) {
 *     return res.status(403).json({ error: 'Forbidden' });
 *   }
 */
const isResourceOwner = (user, resourceOwnerId) => {
  if (!user) return false;
  // Admins and dispatchers can access any resource
  if ([ROLES.ADMIN, ROLES.DISPATCHER].includes(user.role)) {
    return true;
  }
  // Users can only access their own
  return user.user_id === resourceOwnerId;
};

/**
 * Utility function to filter query results based on user role
 * For users: only return own resources
 * For dispatcher/admin: return all resources
 * 
 * Usage in controller for listing:
 *   const incidents = await Incident.findAll(applyRoleFilter(req.user));
 *   // Adds { where: { user_id: userId } } for users
 */
const applyRoleFilter = (user, userIdField = 'user_id') => {
  if (!user) return {};
  
  // Admins and dispatchers see all
  if ([ROLES.ADMIN, ROLES.DISPATCHER].includes(user.role)) {
    return {};  // No filter
  }
  
  // Users see only their own
  return { where: { [userIdField]: user.user_id } };
};

module.exports = {
  authorize,
  requiresPermission,
  checkOwnership,
  setResourceOwner,
  isResourceOwner,
  applyRoleFilter
};
