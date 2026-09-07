/**
 * Incident Escalation Controller
 * Handles inter-department assistance requests for incidents.
 *
 * Allowed requestors: super-admin, admin, dispatcher, department-admin, department-head
 * Status transitions enforced in updateStatus.
 */
const pool = require('../config/db');
const IncidentEscalation = require('../models/incidentEscalation');
const IncidentCoordinationNote = require('../models/incidentCoordinationNote');
const { validateInteger, validateString, validateAllowedValue } = require('../utils/validation');
const { logDispatcherAction } = require('../utils/auditLog');
const { emitIncidentEvent } = require('../utils/incidentEvents');
const User = require('../models/user');
const Department = require('../models/department');
const Dispatch = require('../models/dispatch');

const ALLOWED_REQUESTOR_ROLES = new Set([
  'admin', 'super-admin', 'superadmin', 'super admin',
  'dispatcher', 'department-admin', 'department-head',
]);

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function canRequest(role) {
  return ALLOWED_REQUESTOR_ROLES.has(normalizeRole(role));
}

/** Build a lean incident row for event emission (only fields emitIncidentEvent needs). */
async function fetchIncidentForEvent(reportId) {
  try {
    const res = await pool.query(
      `SELECT report_id, user_id, status, incident_type, severity_level, barangay,
              latitude, longitude, created_at, updated_at
       FROM incident_reports WHERE report_id = $1 LIMIT 1`,
      [reportId]
    );
    return res.rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/incidents/:id/escalations
 * Create an inter-department assistance request.
 */
async function createEscalation(req, res) {
  try {
    const role = req.user?.role;
    if (!canRequest(role)) {
      return res.status(403).json({ error: 'Forbidden. Only dispatchers and department admins may request inter-department assistance.' });
    }

    const reportId = validateInteger(req.params.id, 'report_id', 1);

    // Validate required body fields
    const toDeptId = validateInteger(req.body?.to_department_id, 'to_department_id');
    const justification = validateString(req.body?.justification_notes, 'justification_notes', 5, 1000);
    const urgency = req.body?.urgency
      ? validateAllowedValue(req.body.urgency, ['low', 'medium', 'high', 'critical'], 'urgency')
      : 'medium';

    // Incident must exist
    const incRes = await pool.query(
      'SELECT report_id, status FROM incident_reports WHERE report_id = $1',
      [reportId]
    );
    if (!incRes.rows[0]) {
      return res.status(404).json({ error: 'Incident not found.' });
    }

    // Target department must exist and be active
    const toDept = await Department.findById(toDeptId);
    if (!toDept) {
      return res.status(404).json({ error: 'Target department not found.' });
    }

    // Resolve requesting user's department
    const fullUser = await User.findById(req.user.user_id);
    const fromDeptId = fullUser?.department_id || null;

    // Guard: cannot escalate to own department (unless super-admin / dispatcher has no dept)
    if (fromDeptId && fromDeptId === toDeptId) {
      return res.status(422).json({ error: 'Cannot request assistance from your own department.' });
    }

    const escalation = await IncidentEscalation.create({
      report_id: reportId,
      from_department_id: fromDeptId,
      to_department_id: toDeptId,
      requested_by_user_id: req.user.user_id,
      urgency,
      justification_notes: justification,
    });

    // Auto-log a coordination note
    const requesterName = [fullUser?.first_name, fullUser?.last_name].filter(Boolean).join(' ') || `User #${req.user.user_id}`;
    const fromDeptName = fromDeptId ? (await Department.findById(fromDeptId))?.name || `Dept #${fromDeptId}` : 'Operations Center';
    await IncidentCoordinationNote.create({
      report_id: reportId,
      user_id: req.user.user_id,
      author_name: requesterName,
      author_role: role,
      department: fromDeptName,
      note: `🆘 Inter-department assistance requested from ${toDept.name} — Urgency: ${urgency.toUpperCase()}. Notes: ${justification}`,
      source: 'Escalation',
    });

    // Emit event for WebSocket broadcast + OneSignal push
    const incident = await fetchIncidentForEvent(reportId);
    if (incident) {
      emitIncidentEvent(req, 'incident:escalated', {
        ...incident,
        escalation_id: escalation.id,
        to_department_id: toDeptId,
        to_department_name: toDept.name,
        urgency,
      });
    }

    await logDispatcherAction(req, 'escalation_request', 'incident_escalation', escalation.id, {
      report_id: reportId,
      to_department_id: toDeptId,
      urgency,
    });

    return res.status(201).json({ escalation });
  } catch (err) {
    if (err.message?.includes('required') || err.message?.includes('must be')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[incidentEscalation] createEscalation error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /api/incidents/:id/escalations
 * List all escalations for an incident.
 */
async function listEscalations(req, res) {
  try {
    const role = req.user?.role;
    if (!canRequest(role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const reportId = validateInteger(req.params.id, 'report_id', 1);

    const normalizedRole = normalizeRole(role);
    const isSuperOrDispatcher = ['admin', 'super-admin', 'superadmin', 'dispatcher'].includes(normalizedRole);
    if (!isSuperOrDispatcher && req.user?.user_id) {
      const fullUser = await User.findById(req.user.user_id);
      const userDeptId = fullUser?.department_id ?? req.user?.department_id;
      if (userDeptId) {
        const dept = await Department.findById(userDeptId);
        let hasAccess = false;
        if (dept?.code) {
          const dispatches = await Dispatch.findAll({ report_id: reportId, department_code: dept.code, limit: 1 });
          if (dispatches && dispatches.length > 0) hasAccess = true;
        }
        if (!hasAccess) {
          const escalations = await IncidentEscalation.findByReportId(reportId);
          const hasEsc = escalations.some(
            (e) => (e.to_department_id === userDeptId || e.from_department_id === userDeptId)
              && (e.status === 'pending' || e.status === 'accepted')
          );
          if (hasEsc) hasAccess = true;
        }
        if (!hasAccess) {
          return res.status(403).json({ error: 'Forbidden. You do not have access to this incident.' });
        }
      }
    }

    const escalations = await IncidentEscalation.findByReportId(reportId);
    return res.json({ escalations });
  } catch (err) {
    if (err.message?.includes('required')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[incidentEscalation] listEscalations error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * PATCH /api/incidents/:id/escalations/:escalationId/status
 * Accept, decline, resolve, or cancel an escalation.
 *
 * accept  — by target dept admin or super-admin/dispatcher
 * decline — by target dept admin or super-admin/dispatcher
 * resolve — by target dept admin or super-admin/dispatcher
 * cancel  — by the requesting dept or super-admin/dispatcher
 */
async function updateEscalationStatus(req, res) {
  try {
    const role = req.user?.role;
    if (!canRequest(role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const userId = req.user?.user_id ?? req.user?.userId ?? req.user?.id ?? null;
    const reportId     = validateInteger(req.params.id, 'report_id');
    const escalationId = validateInteger(req.params.escalationId, 'escalation_id');
    const rawStatus = String(req.body?.status || '').trim().toLowerCase();
    const normalizedStatus = rawStatus === 'rejected' ? 'declined' : rawStatus;
    const status = validateAllowedValue(
      normalizedStatus, ['accepted', 'declined', 'resolved', 'cancelled'], 'status'
    );
    const responseNotes = req.body?.response_notes
      ? validateString(req.body.response_notes, 'response_notes', 1, 1000)
      : null;

    const existing = await IncidentEscalation.findById(escalationId);
    if (!existing || existing.report_id !== reportId) {
      return res.status(404).json({ error: 'Escalation not found.' });
    }
    if (existing.status !== 'pending' && existing.status !== 'accepted') {
      return res.status(409).json({ error: `Cannot update a ${existing.status} escalation.` });
    }

    // Department authorization:
    // - target dept admin can accept/decline/resolve
    // - requesting dept admin can cancel
    // - super-admin/dispatcher can do all
    const normalizedRole = normalizeRole(role);
    const isSuperOrDispatcher = ['admin', 'super-admin', 'superadmin', 'dispatcher'].includes(normalizedRole);

    if (!isSuperOrDispatcher) {
      const fullUser = userId != null ? await User.findById(userId) : null;
      const userDeptId = fullUser?.department_id ?? req.user?.department_id;

      if (status === 'cancelled') {
        if (userDeptId == null || String(userDeptId) !== String(existing.from_department_id)) {
          return res.status(403).json({ error: 'Only the requesting department can cancel this escalation.' });
        }
      } else {
        if (userDeptId == null || String(userDeptId) !== String(existing.to_department_id)) {
          return res.status(403).json({ error: 'Only the target department can accept, decline, or resolve this escalation.' });
        }
      }
    }

    const updated = await IncidentEscalation.updateStatus(escalationId, status, {
      response_notes: responseNotes || null,
      responded_by_user_id: userId || null,
    });

    // If accepted, ensure target department has an active dispatch record on the incident
    if (status === 'accepted' && existing.to_department_id) {
      try {
        const toDept = await Department.findById(existing.to_department_id);
        if (toDept && toDept.code) {
          const existingDispatches = await Dispatch.findAll({ report_id: reportId, department_code: toDept.code, limit: 1 });
          if (!existingDispatches || existingDispatches.length === 0) {
            await Dispatch.create({
              report_id: reportId,
              responder_id: null,
              response_status: 'Assigned',
              department_code: toDept.code,
              department_name: toDept.name,
              responder_source: 'escalation',
              assigned_by_user_id: userId || null,
            });
          }
        }
      } catch (dispErr) {
        console.warn('[incidentEscalation] Auto-dispatch creation note:', dispErr.message);
      }
    }

    // If cancelled or declined (rejected), clean up all dispatch records created for target department so incident disappears
    if ((status === 'cancelled' || status === 'declined') && existing.to_department_id) {
      try {
        const toDept = await Department.findById(existing.to_department_id);
        if (toDept && toDept.code) {
          await Dispatch.deleteEscalationDispatches(reportId, toDept.code);
        }
      } catch (dispErr) {
        console.warn('[incidentEscalation] Auto-dispatch cleanup note:', dispErr.message);
      }
    }

    // Auto-log a coordination note
    const fullUser = userId != null ? await User.findById(userId) : null;
    const actorName = [fullUser?.first_name, fullUser?.last_name].filter(Boolean).join(' ') || (userId ? `User #${userId}` : 'Operations');
    const actorDeptId = fullUser?.department_id ?? req.user?.department_id;
    const actorDeptName = actorDeptId ? (await Department.findById(actorDeptId))?.name || `Dept #${actorDeptId}` : 'Operations';

    const noteText = {
      accepted: `✅ Assistance request accepted by ${existing.to_department_name || `Dept #${existing.to_department_id}`}${responseNotes ? ` — Notes: ${responseNotes}` : ''}`,
      declined: `❌ Assistance request declined by ${existing.to_department_name || `Dept #${existing.to_department_id}`}${responseNotes ? ` — Reason: ${responseNotes}` : ''}`,
      resolved: `🏁 Assistance from ${existing.to_department_name || `Dept #${existing.to_department_id}`} marked as resolved${responseNotes ? ` — Notes: ${responseNotes}` : ''}`,
      cancelled: `🚫 Assistance request cancelled${responseNotes ? ` — Reason: ${responseNotes}` : ''}`,
    }[status] || `Escalation ${status}`;

    try {
      await IncidentCoordinationNote.create({
        report_id: reportId,
        user_id: userId || null,
        author_name: actorName || 'System',
        author_role: role || 'Staff',
        department: actorDeptName || 'Operations',
        note: noteText,
        source: 'Escalation',
      });
    } catch (noteErr) {
      console.warn('[incidentEscalation] Coordination note write error:', noteErr.message);
    }

    // Emit event for live updates + push notification
    const incident = await fetchIncidentForEvent(reportId);
    const eventName = `incident:escalation_${status}`;
    if (incident) {
      emitIncidentEvent(req, eventName, {
        ...incident,
        escalation_id: escalationId,
        to_department_id: existing.to_department_id,
        to_department_name: existing.to_department_name,
        from_department_id: existing.from_department_id,
        urgency: existing.urgency,
        status,
      });
    }

    await logDispatcherAction(req, `escalation_${status}`, 'incident_escalation', escalationId, {
      report_id: reportId,
      status,
    });

    return res.json({ escalation: updated });
  } catch (err) {
    if (err.message?.includes('required') || err.message?.includes('must be') || err.message?.includes('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[incidentEscalation] updateEscalationStatus error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}

module.exports = { createEscalation, listEscalations, updateEscalationStatus };
