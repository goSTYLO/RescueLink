const AuditLog = require('../models/auditLog');
const { validatePagination, validateOptionalString, validateOptionalDate } = require('../utils/validation');

/**
 * GET /api/audit-logs
 * Query: user_id (ignored for now; dispatchers only see own), action, resource_type, from, to, limit, offset
 * Auth required. Dispatchers see only their own logs.
 */
async function getAll(req, res) {
  try {
    if (!req.user || req.user.role !== 'dispatcher') {
      return res.status(403).json({ error: 'Access denied. Dispatcher role required.' });
    }

    const { action, resource_type, from, to, limit, offset } = req.query;
    const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
    const validatedAction = action ? validateOptionalString(action, 'action', 50) : null;
    const validatedResourceType = resource_type ? validateOptionalString(resource_type, 'resource_type', 50) : null;
    const validatedFrom = validateOptionalDate(from, 'from');
    const validatedTo = validateOptionalDate(to, 'to');

    const logs = await AuditLog.findAll({
      user_id: req.user.user_id,
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

module.exports = { getAll };
