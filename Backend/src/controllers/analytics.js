const fs = require('fs');
const path = require('path');
const Analytics = require('../models/analytics');
const User = require('../models/user');
const Department = require('../models/department');
const { ROLES } = require('../config/roles');
const { validateInteger, validateOptionalString, validatePagination, validateAllowedValue } = require('../utils/validation');
const { logAnalyticsAction } = require('../utils/auditLog');

const BARANGAY_GEOJSON_PATH = path.join(__dirname, '../goelogical_polygon/dagupan_barangays.geojson');
let barangayGeojsonCache = null;

function isDeptAdmin(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === ROLES.DEPARTMENT_ADMIN || normalized === 'department admin' || normalized === 'dept admin';
}

function parseBool(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(s)) return true;
  if (['0', 'false', 'no'].includes(s)) return false;
  return defaultValue;
}

async function resolveScope(req) {
  const range = Analytics.parseTimeRange(req.query.from, req.query.to);
  const filters = {
    ...range,
    incident_type: validateOptionalString(req.query.incident_type, 'incident_type', 40) || null,
    severity_level: validateOptionalString(req.query.severity_level, 'severity_level', 40) || null,
    status: validateOptionalString(req.query.status, 'status', 40) || null,
    barangay: validateOptionalString(req.query.barangay, 'barangay', 150) || null,
    exclude_duplicates: parseBool(req.query.exclude_duplicates, false),
    include_archived: parseBool(req.query.include_archived, true),
    department_id: null,
    department_code: null,
    department_name: null,
    volunteer_scope: false,
  };

  if (isDeptAdmin(req.user?.role)) {
    const fullUser = await User.findById(req.user.user_id);
    if (!fullUser?.department_id) {
      const err = new Error('Department admin is not assigned to a department.');
      err.status = 403;
      throw err;
    }
    if (req.query.department_id != null && String(req.query.department_id).trim() !== '') {
      const requestedRaw = String(req.query.department_id).trim();
      if (/^volunteers$/i.test(requestedRaw)) {
        const err = new Error('You can only view insights for your own department.');
        err.status = 403;
        throw err;
      }
      const requested = validateInteger(req.query.department_id, 'department_id');
      if (requested !== fullUser.department_id) {
        const err = new Error('You can only view insights for your own department.');
        err.status = 403;
        throw err;
      }
    }
    const dept = await Department.findById(fullUser.department_id);
    if (!dept) {
      const err = new Error('Department not found');
      err.status = 404;
      throw err;
    }
    filters.department_id = dept.department_id;
    filters.department_code = dept.code;
    filters.department_name = dept.name;
    return filters;
  }

  if (req.query.department_id != null && String(req.query.department_id).trim() !== '') {
    const requestedRaw = String(req.query.department_id).trim();
    if (/^volunteers$/i.test(requestedRaw)) {
      filters.volunteer_scope = true;
      filters.department_name = 'Volunteers';
      return filters;
    }
    const departmentId = validateInteger(req.query.department_id, 'department_id');
    const dept = await Department.findById(departmentId);
    if (!dept) {
      const err = new Error('Department not found');
      err.status = 404;
      throw err;
    }
    filters.department_id = dept.department_id;
    filters.department_code = dept.code;
    filters.department_name = dept.name;
  }
  return filters;
}

function handleError(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === 'EXPORT_TOO_LARGE') {
    return res.status(400).json({ error: error.message, total: error.total });
  }
  if (error.message && /must be|must not|from and to|date range/.test(error.message)) {
    return res.status(400).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: 'Internal server error' });
}

const analyticsController = {
  async overview(req, res) {
    try {
      const filters = await resolveScope(req);
      const overview = await Analytics.getOverview(filters);
      let units = null;
      if (filters.department_id && !filters.volunteer_scope) {
        try {
          const metrics = await Department.getMetrics(filters.department_id);
          if (metrics) {
            units = {
              total_units: metrics.total_units,
              available_units: metrics.available_units,
              personnel_count: metrics.personnel_count,
            };
          }
        } catch (_) { /* snapshot is optional */ }
      }
      await logAnalyticsAction(req, 'analytics_view', {
        from: filters.from,
        to: filters.to,
        department_id: filters.volunteer_scope ? 'volunteers' : filters.department_id,
      });
      res.json({
        ...overview,
        department: filters.volunteer_scope
          ? { id: 'volunteers', code: 'volunteers', name: 'Volunteers' }
          : filters.department_id
            ? { id: filters.department_id, code: filters.department_code, name: filters.department_name }
            : null,
        units,
      });
    } catch (error) {
      handleError(res, error, 'Error fetching analytics overview:');
    }
  },

  async incidents(req, res) {
    try {
      const filters = await resolveScope(req);
      const { limit, offset } = validatePagination(req.query.limit, req.query.offset);
      const search = validateOptionalString(req.query.search, 'search', 80) || '';
      const sort = validateAllowedValue(req.query.sort, Object.keys({
        created_at: 1, incident_type: 1, severity_level: 1, status: 1, barangay: 1,
      }), 'sort') || 'created_at';
      const direction = validateAllowedValue(req.query.direction, ['asc', 'desc'], 'direction') || 'desc';
      const result = await Analytics.listIncidents(filters, { limit, offset, search, sort, direction });
      res.set('x-total-count', String(result.total));
      res.set('x-limit', String(limit));
      res.set('x-offset', String(offset));
      res.json({ items: result.items, total: result.total, limit, offset });
    } catch (error) {
      handleError(res, error, 'Error fetching analytics incidents:');
    }
  },

  async exportCsv(req, res) {
    try {
      const filters = await resolveScope(req);
      const csv = await Analytics.exportCsv(filters);
      await logAnalyticsAction(req, 'analytics_export', {
        from: filters.from,
        to: filters.to,
        department_id: filters.department_id,
        format: 'csv',
      });
      const dept = filters.department_code || 'all';
      const fromDay = String(filters.from).slice(0, 10);
      const toDay = String(filters.to).slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="insights-${dept}-${fromDay}-to-${toDay}.csv"`);
      res.send(csv);
    } catch (error) {
      handleError(res, error, 'Error exporting analytics CSV:');
    }
  },

  async barangaysGeojson(req, res) {
    try {
      if (!barangayGeojsonCache) {
        barangayGeojsonCache = fs.readFileSync(BARANGAY_GEOJSON_PATH, 'utf8');
      }
      res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.send(barangayGeojsonCache);
    } catch (error) {
      handleError(res, error, 'Error serving barangay GeoJSON:');
    }
  },
};

module.exports = analyticsController;
