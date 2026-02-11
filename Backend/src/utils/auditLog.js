const AuditLog = require('../models/auditLog');

/**
 * Log a dispatcher action when the request has an authenticated dispatcher (e.g. after auth middleware).
 * If req.user.role !== 'dispatcher', no log is written.
 * @param {object} req - Express request (must have req.user with user_id and role)
 * @param {string} action - e.g. 'dispatch_create', 'dispatch_update', 'password_change'
 * @param {string} resourceType - e.g. 'auth', 'dispatch', 'incident'
 * @param {number|null} resourceId - Optional resource id
 * @param {object|null} details - Optional payload for the log row
 */
async function logDispatcherAction(req, action, resourceType, resourceId = null, details = null) {
  if (!req.user || req.user.role !== 'dispatcher') return;
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

module.exports = { logDispatcherAction, logDispatcherActionByUser };
