const AuditLog = require('../models/auditLog');
const { buildAuditLogWorkbook } = require('../models/auditLogWorkbook');
const { validatePagination, validateOptionalString, validateOptionalDate } = require('../utils/validation');
const { ROLES } = require('../config/roles');

function manilaExportStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}${get('second')}`;
}

function exportFilename() {
  return `audit-log-${manilaExportStamp()}.xlsx`;
}

function filterSummary({ action, resource_type, from, to }) {
  const parts = [];
  if (action) parts.push(`action=${action}`);
  if (resource_type) parts.push(`resource=${resource_type}`);
  if (from) parts.push(`from=${from}`);
  if (to) parts.push(`to=${to}`);
  return parts.length ? `Filters: ${parts.join(', ')}` : 'Filters: (none)';
}

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

/**
 * GET /api/audit-logs/export.xlsx
 * Same filters as list; up to EXPORT_ROW_CAP rows.
 */
async function exportXlsx(req, res) {
  try {
    if (!req.user || ![ROLES.DISPATCHER, ROLES.ADMIN].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Dispatcher or Admin role required.' });
    }

    const { action, resource_type, from, to } = req.query;
    const validatedAction = action ? validateOptionalString(action, 'action', 50) : null;
    const validatedResourceType = resource_type ? validateOptionalString(resource_type, 'resource_type', 50) : null;
    const validatedFrom = validateOptionalDate(from, 'from');
    const validatedTo = validateOptionalDate(to, 'to');
    const userId = req.user.role === ROLES.ADMIN ? null : req.user.user_id;

    const total = await AuditLog.countMatching({
      user_id: userId,
      action: validatedAction,
      resource_type: validatedResourceType,
      from: validatedFrom,
      to: validatedTo,
    });
    if (total > AuditLog.EXPORT_ROW_CAP) {
      return res.status(400).json({
        error: `Export exceeds ${AuditLog.EXPORT_ROW_CAP} rows (${total}). Narrow the date range or filters.`,
        total,
      });
    }

    const logs = await AuditLog.findForExport({
      user_id: userId,
      action: validatedAction,
      resource_type: validatedResourceType,
      from: validatedFrom,
      to: validatedTo,
    });

    const generatedBy = req.user?.name || req.user?.username || req.user?.email || 'unknown';
    const buffer = await buildAuditLogWorkbook(logs, {
      filterLine: filterSummary({
        action: validatedAction,
        resource_type: validatedResourceType,
        from: validatedFrom,
        to: validatedTo,
      }),
      generatedAt: new Date().toISOString(),
      generatedBy,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename()}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    if (error.message && (error.message.includes('must be') || error.message.includes('must not'))) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAll, getAdminLogs, exportXlsx };
