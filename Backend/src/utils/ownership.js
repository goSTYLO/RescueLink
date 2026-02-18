/**
 * Ownership Checking Utilities
 * Helper functions for verifying resource ownership in controllers
 */

const { ROLES } = require('../config/roles');

/**
 * Check if a user is the owner of a resource or has elevated access
 * Admins and Dispatchers are considered "owners" of all resources for their resource types
 * Regular users can only own resources they created
 * 
 * @param {object} user - Authenticated user object (from req.user)
 * @param {string|number} resourceOwnerId - The user_id or created_by field of the resource
 * @returns {boolean} True if user owns resource or has sufficient role
 */
function isOwner(user, resourceOwnerId) {
  if (!user) return false;
  
  // Admins and dispatchers have access to all resources
  if (user.role === ROLES.ADMIN || user.role === ROLES.DISPATCHER) {
    return true;
  }
  
  // Regular users can only access their own
  return user.user_id === resourceOwnerId;
}

/**
 * Check ownership and return error if user doesn't own resource
 * Returns null if ownership check passes, error object otherwise
 * 
 * @param {object} user - Authenticated user object
 * @param {string|number} resourceOwnerId - Owner ID of resource
 * @param {string} resourceType - Name of resource (e.g., 'incident', 'dispatch')
 * @returns {object|null} Error object if check fails, null if passes
 * 
 * Usage in controller:
 *   const error = validateOwnership(req.user, incident.user_id, 'incident');
 *   if (error) return res.status(error.status).json(error);
 */
function validateOwnership(user, resourceOwnerId, resourceType = 'resource') {
  if (!isOwner(user, resourceOwnerId)) {
    console.warn(
      `[Ownership] User ${user.user_id} (${user.role}) attempted unauthorized access to ${resourceType}`
    );
    return {
      status: 403,
      error: `Forbidden. You can only access your own ${resourceType}.`
    };
  }
  return null;
}

/**
 * Generate query filter based on user role for list operations
 * Users get filtered to see only their own resources
 * Dispatchers and admins see all resources
 * 
 * @param {object} user - Authenticated user object
 * @param {string} ownershipField - Database field name (default: 'user_id')
 * @returns {object} Sequelize where clause (empty object = no filter)
 * 
 * Usage in controller:
 *   const where = getOwnershipFilter(req.user, 'created_by');
 *   const incidents = await Incident.findAll({ where });
 */
function getOwnershipFilter(user, ownershipField = 'user_id') {
  if (!user) return {};
  
  // Admins and dispatchers see all
  if (user.role === ROLES.ADMIN || user.role === ROLES.DISPATCHER) {
    return {};
  }
  
  // Users see only their own
  return { [ownershipField]: user.user_id };
}

/**
 * Check if a user can modify (update/delete) a resource
 * Elevates ownership check to account for role permissions
 * 
 * @param {object} user - Authenticated user object
 * @param {string|number} resourceOwnerId - Owner of resource
 * @param {string} action - Action being performed ('update' or 'delete')
 * @returns {boolean} True if modification is allowed
 */
function canModifyResource(user, resourceOwnerId, action = 'update') {
  if (!user) return false;
  
  // Admins can modify anything
  if (user.role === ROLES.ADMIN) return true;
  
  // Dispatchers can modify most things (except user accounts)
  if (user.role === ROLES.DISPATCHER) return true;
  
  // Users can only modify their own
  return user.user_id === resourceOwnerId;
}

/**
 * Enhanced error response for ownership violations
 * Includes appropriate status code and user-friendly message
 * 
 * @param {string} resourceType - Type of resource (e.g., 'incident')
 * @param {string} action - Action that was attempted (e.g., 'update')
 * @returns {object} Error object for res.status().json()
 */
function ownershipErrorResponse(resourceType = 'resource', action = 'access') {
  return {
    error: `Forbidden. You do not have permission to ${action} this ${resourceType}.`,
    code: 'OWNERSHIP_VIOLATION'
  };
}

module.exports = {
  isOwner,
  isResourceOwner: isOwner,  // Alias for test compatibility
  validateOwnership,
  getOwnershipFilter,
  canModifyResource,
  ownershipErrorResponse
};
