const AuditLog = require('../models/auditLog');
const { validatePagination, validateOptionalString, validateOptionalDate } = require('../utils/validation');
const { ROLES } = require('../config/roles');

/**
 * GET /api/audit-logs
 * Query: action, resource_type, from, to, limit, offset
 * Auth required. Dispatchers see only their own logs. Admins see all logs.
 */
async function getAll(req, res) {
  try {
    if (!req.user || ![ROLES.DISPATCHER, ROLES.ADMIN].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Dispatcher or Admin role required.' });
    }

    const { action, resource_type, from, to, limit, offset } = req.query;
    const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
    const validatedAction = action ? validateOptionalString(action, 'action', 50) : null;
    const validatedResourceType = resource_type ? validateOptionalString(resource_type, 'resource_type', 50) : null;
    const validatedFrom = validateOptionalDate(from, 'from');
    const validatedTo = validateOptionalDate(to, 'to');

    // Dispatchers only see their own logs; admins see all
    const userId = req.user.role === ROLES.ADMIN ? null : req.user.user_id;

    const logs = await AuditLog.findAll({
      user_id: userId,
      action: validatedAction,
      resource_type: validatedResourceType,
      from: validatedFrom,
      to: validatedTo,
      limit: validatedLimit,
      offset: validatedOffset
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    if (error.message && (error.message.includes('must be') || error.message.includes('must not'))) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/audit-logs/admin
 * Admin-only endpoint. Returns audit logs for users with role = 'admin'.
 * Query: action, from, to, limit, offset
 */
async function getAdminLogs(req, res) {
  try {
    if (!req.user || req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { action, from, to, limit, offset } = req.query;
    const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
    const validatedAction = action ? validateOptionalString(action, 'action', 80) : null;
    const validatedFrom = validateOptionalDate(from, 'from');
    const validatedTo = validateOptionalDate(to, 'to');

    const logs = await AuditLog.findAdminLogs({
      action: validatedAction,
      from: validatedFrom,
      to: validatedTo,
      limit: validatedLimit,
      offset: validatedOffset
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching admin audit logs:', error);
    if (error.message && (error.message.includes('must be') || error.message.includes('must not'))) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAll, getAdminLogs };
