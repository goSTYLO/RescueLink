const AuditLog = require('../models/auditLog');

const DASHBOARD_AUDIT_ROLES = ['dispatcher', 'admin', 'department-admin', 'department-head'];

/**
 * Log a dashboard action (dispatcher, admin, department-admin, department-head).
 * @param {object} req - Express request (must have req.user with user_id and role)
 * @param {string} action - e.g. 'dispatch_create', 'department_create', 'password_change'
 * @param {string} resourceType - e.g. 'auth', 'dispatch', 'department'
 * @param {number|null} resourceId - Optional resource id
 * @param {object|null} details - Optional payload for the log row
 */
async function logDispatcherAction(req, action, resourceType, resourceId = null, details = null) {
  if (!req.user || !DASHBOARD_AUDIT_ROLES.includes(req.user.role)) return;
  const ip = req.ip || req.get?.('X-Forwarded-For') || null;
  const userAgent = req.get?.('User-Agent') || null;
  try {
    await AuditLog.create({
      user_id: req.user.user_id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ip,
      user_agent: userAgent
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

/**
 * Log a dispatcher action when the user is known (e.g. after login/signup before req.user is set).
 * Use for auth flows: dispatcher_login, dispatcher_signup, password_reset.
 * @param {object} user - User object with user_id (and role should be 'dispatcher')
 * @param {object} req - Express request (for IP and User-Agent)
 * @param {string} action - e.g. 'dispatcher_login', 'dispatcher_signup', 'password_reset'
 * @param {string} resourceType - e.g. 'auth'
 * @param {number|null} resourceId - Optional
 * @param {object|null} details - Optional
 */
async function logDispatcherActionByUser(user, req, action, resourceType, resourceId = null, details = null) {
  if (!user || user.role !== 'dispatcher') return;
  const ip = req?.ip || req?.get?.('X-Forwarded-For') || null;
  const userAgent = req?.get?.('User-Agent') || null;
  try {
    await AuditLog.create({
      user_id: user.user_id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ip,
      user_agent: userAgent
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

/**
 * Log an admin action
 * Only logs if user role is 'admin'
 * @param {object} req - Express request (must have req.user with user_id and role)
 * @param {string} action - e.g. 'user_create', 'user_role_update', 'user_delete'
 * @param {string} resourceType - e.g. 'user', 'system', 'settings'
 * @param {number|null} resourceId - Optional resource id
 * @param {object|null} details - Optional payload for the log row
 */
async function logAdminAction(req, action, resourceType, resourceId = null, details = null) {
  if (!req.user || req.user.role !== 'admin') return;
  const ip = req.ip || req.get?.('X-Forwarded-For') || null;
  const userAgent = req.get?.('User-Agent') || null;
  try {
    await AuditLog.create({
      user_id: req.user.user_id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ip,
      user_agent: userAgent
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

/**
 * Log a user action (for regular 'user' role users)
 * Only logs if user role is 'user'
 * @param {object} req - Express request (must have req.user with user_id and role)
 * @param {string} action - e.g. 'incident_create', 'user_login', 'password_change'
 * @param {string} resourceType - e.g. 'incident', 'auth'
 * @param {number|null} resourceId - Optional resource id
 * @param {object|null} details - Optional payload for the log row
 */
async function logUserAction(req, action, resourceType, resourceId = null, details = null) {
  if (!req.user || req.user.role !== 'user') return;
  const ip = req.ip || req.get?.('X-Forwarded-For') || null;
  const userAgent = req.get?.('User-Agent') || null;
  try {
    await AuditLog.create({
      user_id: req.user.user_id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ip,
      user_agent: userAgent
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

/**
 * Log a citizen action when the user is known before req.user is set (login, register, password reset).
 * @param {object} user - User object with user_id and role === 'user'
 * @param {object} req - Express request (for IP and User-Agent)
 * @param {string} action - e.g. 'user_login', 'user_register', 'password_reset'
 * @param {string} resourceType - e.g. 'auth'
 * @param {number|null} resourceId - Optional
 * @param {object|null} details - Optional
 */
async function logUserActionByUser(user, req, action, resourceType, resourceId = null, details = null) {
  if (!user || user.role !== 'user') return;
  const ip = req?.ip || req?.get?.('X-Forwarded-For') || null;
  const userAgent = req?.get?.('User-Agent') || null;
  try {
    await AuditLog.create({
      user_id: user.user_id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ip,
      user_agent: userAgent
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

/**
 * Log any system action regardless of role
 * Logs for any authenticated user (user, dispatcher, or admin)
 * @param {object} req - Express request (must have req.user)
 * @param {string} action - Action performed
 * @param {string} resourceType - Type of resource
 * @param {number|null} resourceId - Optional resource id
 * @param {object|null} details - Optional details
 * @param {string} actionType - 'SUCCESS', 'FAILED', or 'UNAUTHORIZED'
 */
async function logSystemAction(req, action, resourceType, resourceId = null, details = null, actionType = 'SUCCESS') {
  if (!req.user) return;
  const ip = req.ip || req.get?.('X-Forwarded-For') || null;
  const userAgent = req.get?.('User-Agent') || null;
  try {
    await AuditLog.create({
      user_id: req.user.user_id,
      user_role: req.user.role,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ip,
      user_agent: userAgent,
      action_type: actionType
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

async function logAnalyticsAction(req, action, details = null) {
  if (!req.user || !['admin', 'department-admin'].includes(String(req.user.role || '').toLowerCase())) return;
  const ip = req.ip || req.get?.('X-Forwarded-For') || null;
  const userAgent = req.get?.('User-Agent') || null;
  try {
    await AuditLog.create({
      user_id: req.user.user_id,
      action,
      resource_type: 'analytics',
      resource_id: null,
      details,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = {
  logDispatcherAction,
  logDispatcherActionByUser,
  logAdminAction,
  logUserAction,
  logUserActionByUser,
  logSystemAction,
  logAnalyticsAction,
  DASHBOARD_AUDIT_ROLES,
};
