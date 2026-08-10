/**
 * WebSocket Manager for real-time incident notifications.
 * Attaches to HTTP server, authenticates via JWT, and broadcasts incident events
 * with role-based filtering (dispatchers see all, department heads see their dept, reporters see own).
 */
const WebSocket = require('ws');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const TokenBlacklist = require('../models/tokenBlacklist');
const User = require('../models/user');
const { ROLES } = require('../config/roles');
const pool = require('../config/db');

const HEARTBEAT_INTERVAL_MS = parseInt(process.env.WS_HEARTBEAT_INTERVAL, 10) || 30000;

// Roles that receive all incident events (super-admin maps to admin in backend)
const GLOBAL_EVENT_ROLES = new Set([
  ROLES.ADMIN,
  ROLES.DISPATCHER,
  ROLES.SUPERVISOR,
]);

// Roles that receive events only for their department's incidents
const DEPARTMENT_SCOPED_ROLES = new Set([
  ROLES.DEPARTMENT_ADMIN,
  ROLES.DEPARTMENT_HEAD,
  ROLES.RESPONDER,
]);

// Normalize role from various API formats
function normalizeRole(role) {
  if (!role || typeof role !== 'string') return null;
  const r = role.trim().toLowerCase();
  const map = {
    'super_admin': ROLES.ADMIN,
    'super-admin': ROLES.ADMIN,
    'admin': ROLES.ADMIN,
    'dispatcher': ROLES.DISPATCHER,
    'supervisor': ROLES.SUPERVISOR,
    'department_admin': ROLES.DEPARTMENT_ADMIN,
    'department-admin': ROLES.DEPARTMENT_ADMIN,
    'department_head': ROLES.DEPARTMENT_HEAD,
    'department-head': ROLES.DEPARTMENT_HEAD,
    'responder': ROLES.RESPONDER,
    'user': ROLES.USER,
  };
  return map[r] || r;
}

/**
 * Get department_ids for departments assigned to this incident (via dispatches).
 * @param {number} reportId - Incident report ID
 * @returns {Promise<number[]>} - Array of department_ids
 */
async function getIncidentAssignedDepartmentIds(reportId) {
  if (!reportId) return [];
  try {
    const res = await pool.query(
      `SELECT DISTINCT d.department_id 
       FROM dispatches dp 
       JOIN departments d ON d.code = dp.department_code 
       WHERE dp.report_id = $1`,
      [reportId]
    );
    return res.rows.map((r) => r.department_id).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Initialize WebSocket server on the given HTTP server.
 * @param {http.Server} server - HTTP server instance
 * @returns {Object} - Manager with broadcast method
 */
function init(server) {
  const wss = new WebSocket.Server({
    server,
    path: '/ws',
  });

  const clients = new Map(); // ws -> { userId, role, departmentId }

  let heartbeatTimer = null;

  function startHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      clients.forEach((meta, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clients.delete(ws);
        }
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  wss.on('connection', async (ws, req) => {
    const requestUrl = req.url || '';
    let token = null;
    try {
      const url = new URL(requestUrl, `http://${req.headers.host || 'localhost'}`);
      token = url.searchParams.get('token');
    } catch {
      // URL parse failed
    }

    if (!token || typeof token !== 'string') {
      ws.close(4001, 'Missing token');
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
      if (isBlacklisted) {
        ws.close(4001, 'Invalid or expired token');
        return;
      }
    } catch {
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    const userId = payload.user_id ?? payload.userId;
    const role = normalizeRole(payload.role) || ROLES.USER;

    let departmentId = payload.department_id ?? payload.departmentId ?? null;
    if (departmentId == null && (DEPARTMENT_SCOPED_ROLES.has(role) || role === 'department-head' || role === 'department-admin')) {
      const user = await User.findById(userId);
      departmentId = user?.department_id ?? null;
    }

    let supportedIncidentTypes = null;
    if (role === ROLES.RESPONDER) {
      try {
        const rRes = await pool.query('SELECT supported_incident_types FROM responders WHERE user_id = $1', [userId]);
        if (rRes.rows[0] && Array.isArray(rRes.rows[0].supported_incident_types)) {
          supportedIncidentTypes = rRes.rows[0].supported_incident_types;
        }
      } catch (_) {}
    }

    clients.set(ws, { userId, role, departmentId, supportedIncidentTypes });

    ws.on('pong', () => {
      // Keep-alive response
    });

    ws.on('close', () => {
      clients.delete(ws);
      if (clients.size === 0) stopHeartbeat();
    });

    ws.on('error', () => {
      clients.delete(ws);
    });

    if (clients.size === 1) startHeartbeat();
  });

  /**
   * Broadcast incident event to eligible clients.
   * @param {string} event - Event name (e.g. 'incident:created', 'incident:status_updated')
   * @param {Object} data - Event payload (report_id, status, reporter_id, assigned_department_id, etc.)
   */
  async function broadcast(event, data) {
    if (!data || typeof data !== 'object') return;

    const reportId = data.report_id ?? data.reportId;
    const reporterId = data.reporter_id ?? data.reporterId;
    let assignedDeptIds = data.assigned_department_ids ?? data.assignedDepartmentIds ?? null;

    if (assignedDeptIds == null && reportId) {
      assignedDeptIds = await getIncidentAssignedDepartmentIds(reportId);
    }
    if (!Array.isArray(assignedDeptIds)) {
      assignedDeptIds = assignedDeptIds != null ? [assignedDeptIds] : [];
    }

    const assignedSet = new Set(assignedDeptIds);
    const message = JSON.stringify({ event, data });
    const toSend = [];

    const rawType = String(data.incident_type || '').trim().toLowerCase();
    let normalizedType = rawType;
    if (['medical', 'accident', 'injury'].some((k) => rawType.includes(k))) normalizedType = 'medical';
    else if (['fire', 'blaze'].some((k) => rawType.includes(k))) normalizedType = 'fire';
    else if (['crime', 'police', 'robbery', 'assault'].some((k) => rawType.includes(k))) normalizedType = 'police';
    else if (['disaster', 'flood', 'typhoon', 'earthquake'].some((k) => rawType.includes(k))) normalizedType = 'disaster';

    for (const [ws, meta] of clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;

      const { userId, role, departmentId, supportedIncidentTypes } = meta;

      // Global roles: receive everything
      if (GLOBAL_EVENT_ROLES.has(role)) {
        toSend.push(ws);
        continue;
      }

      // Reporter (user): only own incidents
      if (role === ROLES.USER) {
        if (reporterId != null && reporterId === userId) {
          toSend.push(ws);
        }
        continue;
      }

      // Responder: filter by supported incident types if event is responder alert
      if (role === ROLES.RESPONDER) {
        if (event === 'responder:incident_alert') {
          if (supportedIncidentTypes && supportedIncidentTypes.length > 0) {
            if (!supportedIncidentTypes.includes(normalizedType)) {
              continue; // Filter out: responder specialization doesn't match
            }
          }
          toSend.push(ws);
          continue;
        }
        if (departmentId != null && assignedSet.has(departmentId)) {
          toSend.push(ws);
          continue;
        }
      }

      // Department-scoped: only if incident assigned to their department
      if (DEPARTMENT_SCOPED_ROLES.has(role) && departmentId != null) {
        if (assignedSet.has(departmentId)) {
          toSend.push(ws);
        }
        continue;
      }
    }

    toSend.forEach((ws) => {
      try {
        ws.send(message);
      } catch (err) {
        console.error('[websocket] send error:', err.message);
      }
    });
  }

  /**
   * Broadcast responder:incident_alert to online responders matching specialization.
   */
  async function broadcastToResponders(event, data) {
    return broadcast(event, data);
  }

  return {
    broadcast,
    broadcastToResponders,
    getClientCount: () => clients.size,
  };
}

module.exports = { init };
