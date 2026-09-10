const Dispatch = require('../models/dispatch');
const Responder = require('../models/responder');
const Incident = require('../models/incident');
const User = require('../models/user');
const Department = require('../models/department');
const pool = require('../config/db');
const { validateInteger, validateOptionalString, validatePagination } = require('../utils/validation');
const { logDispatcherAction } = require('../utils/auditLog');
const { ROLES } = require('../config/roles');
const { persistIncidentNotifications } = require('../services/notificationPersistence');
const { buildIncidentEventPayload, emitIncidentEvent } = require('../utils/incidentEvents');
const IncidentCoordinationNote = require('../models/incidentCoordinationNote');
const { AUTO_STATUS, applyTeam } = require('../services/autoDispatchService');

function emitDispatchEvent(req, event, reportId, incident = null) {
  if (!reportId) return;
  if (incident) {
    emitIncidentEvent(req, event, incident);
  } else {
    Incident.findById(reportId).then((found) => {
      emitIncidentEvent(req, event, found || { report_id: reportId });
    }).catch(() => {
      emitIncidentEvent(req, event, { report_id: reportId });
    });
  }
}

const OPS_ASSIGN_ROLES = [ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD];

function isDeptScopedRole(role) {
  return role === ROLES.DEPARTMENT_ADMIN || role === ROLES.DEPARTMENT_HEAD;
}

function isOpsAssignRole(role) {
  return OPS_ASSIGN_ROLES.includes(role);
}

async function assertDepartmentScope(req, departmentCode) {
  if (!isDeptScopedRole(req.user?.role)) return { ok: true };
  if (!req.user?.user_id) return { ok: false, status: 403, body: { error: 'Forbidden.' } };
  const fullUser = await User.findById(req.user.user_id);
  if (!fullUser?.department_id) {
    return { ok: false, status: 403, body: { error: 'You are not assigned to a department.' } };
  }
  const dept = await Department.findById(fullUser.department_id);
  if (!dept?.code || String(dept.code).toLowerCase() !== String(departmentCode || '').toLowerCase()) {
    return { ok: false, status: 403, body: { error: 'You can only assign teams within your own department.' } };
  }
  return { ok: true, department: dept };
}

async function assertPrimaryTeamLock({ reportId, departmentCode, creatingTeam, creatingDeptOnly }) {
  if (creatingDeptOnly && departmentCode) {
    const exists = await Dispatch.departmentHasDispatch(reportId, departmentCode);
    if (exists) {
      return {
        ok: false,
        status: 409,
        body: { error: 'Department already notified for this incident', code: 'DEPARTMENT_ALREADY_NOTIFIED' },
      };
    }
  }
  if (creatingTeam && departmentCode) {
    if (await Dispatch.departmentHasTeam(reportId, departmentCode)) {
      return {
        ok: false,
        status: 409,
        body: { error: 'A team is already assigned for this department. Use reassign-team.', code: 'PRIMARY_TEAM_ALREADY_ASSIGNED' },
      };
    }
    const hasPrimary = await Dispatch.hasPrimaryTeamAssignment(reportId);
    if (hasPrimary && !(await Dispatch.isAssistingDepartment(reportId, departmentCode))) {
      return {
        ok: false,
        status: 409,
        body: { error: 'A primary team is already assigned. Use reassign-team.', code: 'PRIMARY_TEAM_ALREADY_ASSIGNED' },
      };
    }
  }
  return { ok: true };
}

async function stampManualTeamAssignment(reportId, departmentCode, teamName) {
  try {
    await Incident.updateAutoAssignment(reportId, {
      auto_assignment_status: AUTO_STATUS.CONFIRMED,
      suggested_department_code: departmentCode || null,
      suggested_team_name: teamName || null,
      auto_assignment_reason: 'manual_team_assign',
      auto_assignment_mismatch: false,
    });
  } catch (err) {
    console.warn('[dispatch] auto-assignment stamp failed:', err.message);
  }
}

const dispatchController = {
  // Create new dispatch
  async create(req, res) {
    try {
      const {
        report_id,
        responder_id,
        response_status,
        department_code,
        department_name,
        team_name,
        default_department_code,
        was_default_department,
        responders,
      } = req.body || {};

      const validatedReportId = validateInteger(report_id, 'report_id');
      const validatedResponseStatus = validateOptionalString(response_status, 'response_status', 50);
      const validatedDepartmentCode = validateOptionalString(department_code, 'department_code', 40);
      const validatedDepartmentName = validateOptionalString(department_name, 'department_name', 150);
      const validatedTeamName = validateOptionalString(team_name, 'team_name', 150);
      const validatedDefaultDepartmentCode = validateOptionalString(default_department_code, 'default_department_code', 40);
      const validatedWasDefaultDepartment = typeof was_default_department === 'boolean' ? was_default_department : null;
      const assignedByUserId = req.user?.user_id ? validateInteger(req.user.user_id, 'assigned_by_user_id') : null;

      const ensureTeamAssignable = async (departmentCode, teamName) => {
        if (!departmentCode || !teamName) return { ok: true };
        const team = await Responder.findTeamByDepartmentAndName(departmentCode, teamName);
        if (!team) {
          return {
            ok: false,
            status: 404,
            body: { error: 'Selected team not found in department' },
          };
        }
        const normalizedStatus = String(team.team_status || 'available').toLowerCase();
        const isAssignable = normalizedStatus.includes('available') || normalizedStatus.includes('standby');
        if (!isAssignable) {
          return {
            ok: false,
            status: 409,
            body: {
              error: 'Selected team is currently unavailable',
              team_status: team.team_status,
            },
          };
        }
        return { ok: true, team };
      };

      // Department admin may only create dispatches for their own department
      if (isDeptScopedRole(req.user.role) && req.user.user_id && validatedDepartmentCode) {
        const fullUser = await User.findById(req.user.user_id);
        if (!fullUser || fullUser.department_id == null) {
          return res.status(403).json({ error: 'You can only create dispatches for your own department.' });
        }
        const dept = await Department.findById(fullUser.department_id);
        if (!dept || !dept.code || String(dept.code).toLowerCase() !== String(validatedDepartmentCode).toLowerCase()) {
          return res.status(403).json({ error: 'You can only create dispatches for your own department.' });
        }
      }

      // Check if report exists
      const reportExists = await Dispatch.reportExists(validatedReportId);
      if (!reportExists) {
        return res.status(404).json({ error: 'Incident report not found' });
      }
      const incident = await Incident.findById(validatedReportId);
      if (String(incident?.status || '').toLowerCase() === 'closed') {
        return res.status(409).json({ error: 'Cannot assign responders to a closed incident' });
      }
      const existingDispatchCount = await Dispatch.countByReportId(validatedReportId);
      const incidentType = await Dispatch.getIncidentType(validatedReportId);

      if (validatedDepartmentCode && validatedTeamName) {
        const teamAvailability = await ensureTeamAssignable(validatedDepartmentCode, validatedTeamName);
        if (!teamAvailability.ok) {
          return res.status(teamAvailability.status).json(teamAvailability.body);
        }
      }

      const hasResponderArray = Array.isArray(responders) && responders.length > 0;
      const creatingTeam = Boolean(validatedTeamName) || hasResponderArray;
      const creatingDeptOnly = !responder_id && Boolean(validatedDepartmentCode) && !validatedTeamName && !hasResponderArray;
      const lock = await assertPrimaryTeamLock({
        reportId: validatedReportId,
        departmentCode: validatedDepartmentCode,
        creatingTeam,
        creatingDeptOnly,
      });
      if (!lock.ok) {
        return res.status(lock.status).json(lock.body);
      }

      if (hasResponderArray) {
        const normalizedResponders = [];
        for (const entry of responders) {
          const source = String(entry?.source || 'account').toLowerCase() === 'directory' ? 'directory' : 'account';
          if (source === 'account') {
            const validatedResponderId = validateInteger(entry?.responder_id, 'responder_id');
            const exists = await Dispatch.responderExists(validatedResponderId);
            if (!exists) {
              return res.status(404).json({ error: `Responder not found: ${validatedResponderId}` });
            }
            normalizedResponders.push({
              source,
              responder_id: validatedResponderId,
              responder_name: validateOptionalString(entry?.responder_name, 'responder_name', 150),
              team_name: validateOptionalString(entry?.team_name, 'team_name', 150),
            });
          } else {
            const responderName = validateOptionalString(entry?.responder_name || entry?.name, 'responder_name', 150);
            if (!responderName) {
              return res.status(400).json({ error: 'directory responder_name is required' });
            }
            normalizedResponders.push({
              source,
              responder_name: responderName,
              contact_number: validateOptionalString(entry?.contact_number, 'contact_number', 20),
              organization: validateOptionalString(entry?.organization, 'organization', 150),
              team_name: validateOptionalString(entry?.team_name, 'team_name', 150),
            });
          }
        }

        const assignmentGroupId = `asg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
        const dispatches = await Dispatch.createAssignmentGroup({
          report_id: validatedReportId,
          department_code: validatedDepartmentCode,
          department_name: validatedDepartmentName,
          team_name: validatedTeamName,
          default_department_code: validatedDefaultDepartmentCode,
          was_default_department: validatedWasDefaultDepartment,
          responders: normalizedResponders,
          response_status: validatedResponseStatus || 'assigned',
          assignment_group_id: assignmentGroupId,
          assigned_by_user_id: assignedByUserId,
        });

        await logDispatcherAction(req, 'dispatch_create_v2', 'dispatch', dispatches[0]?.dispatch_id || null, {
          report_id: validatedReportId,
          assignment_group_id: assignmentGroupId,
          responder_count: dispatches.length,
          department_code: validatedDepartmentCode,
          team_name: validatedTeamName,
        });

        // Transition to in_progress when team/responders assigned (including dept admin adding team to department-only)
        if (dispatches.length > 0) {
          try {
            await Incident.transitionStatus(validatedReportId, {
              next_status: 'in_progress',
              actor_user_id: assignedByUserId,
              actor_role: req.user?.role || null,
            });
          } catch (_) {
            // Best-effort lifecycle hook; keep dispatch creation successful.
          }
          await stampManualTeamAssignment(validatedReportId, validatedDepartmentCode, validatedTeamName);
        }

        const updatedIncident = await Incident.findById(validatedReportId);
        emitDispatchEvent(req, 'incident:dispatched', validatedReportId, updatedIncident);
        emitDispatchEvent(req, 'incident:status_updated', validatedReportId, updatedIncident);

        return res.status(201).json({
          assignment_group_id: assignmentGroupId,
          report_id: validatedReportId,
          dispatches,
          assignment_summary: {
            requested_department_code: validatedDepartmentCode,
            requested_team_name: validatedTeamName,
            attempted_count: normalizedResponders.length,
            assigned_count: dispatches.length,
            unassigned_reason: null,
          },
        });
      }

      // Department-only path: frontend submits sector only (no team; department admin selects team later)
      if (!responder_id && validatedDepartmentCode && !validatedTeamName && !hasResponderArray) {
        const assignmentGroupId = `asg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
        const dispatch = await Dispatch.createDepartmentOnly({
          report_id: validatedReportId,
          department_code: validatedDepartmentCode,
          department_name: validatedDepartmentName,
          default_department_code: validatedDefaultDepartmentCode,
          was_default_department: validatedWasDefaultDepartment,
          response_status: validatedResponseStatus || 'assigned',
          assignment_group_id: assignmentGroupId,
          assigned_by_user_id: assignedByUserId,
        });

        await logDispatcherAction(req, 'dispatch_create_department_only', 'dispatch', dispatch?.dispatch_id || null, {
          report_id: validatedReportId,
          assignment_group_id: assignmentGroupId,
          department_code: validatedDepartmentCode,
        });

        // Department assignment should move lifecycle out of pending even before team assignment.
        if (String(incident?.status || '').toLowerCase() === 'pending') {
          try {
            await Incident.transitionStatus(validatedReportId, {
              next_status: 'verified',
              actor_user_id: assignedByUserId,
              actor_role: req.user?.role || null,
            });
          } catch (_) {
            // Best-effort lifecycle hook; keep dispatch creation successful.
          }
        }

        // Do NOT transition to in_progress here - only when dept admin assigns a team

        const updatedIncident = await Incident.findById(validatedReportId);
        emitDispatchEvent(req, 'incident:dispatched', validatedReportId, updatedIncident);
        emitDispatchEvent(req, 'incident:status_updated', validatedReportId, updatedIncident);

        return res.status(201).json({
          assignment_group_id: assignmentGroupId,
          report_id: validatedReportId,
          dispatches: [dispatch],
          assignment_summary: {
            department_only: true,
            requested_department_code: validatedDepartmentCode,
            requested_team_name: null,
            attempted_count: 0,
            assigned_count: 0,
          },
        });
      }

      // Auto-assignment path: frontend submits sector + team only
      if (!responder_id && validatedDepartmentCode && validatedTeamName) {
        const assignmentGroupId = `asg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
        const autoAssignment = await Dispatch.createAutoAssignmentGroup({
          report_id: validatedReportId,
          department_code: validatedDepartmentCode,
          department_name: validatedDepartmentName,
          team_name: validatedTeamName,
          incident_type: incidentType,
          default_department_code: validatedDefaultDepartmentCode,
          was_default_department: validatedWasDefaultDepartment,
          response_status: validatedResponseStatus || 'assigned',
          assignment_group_id: assignmentGroupId,
          assigned_by_user_id: assignedByUserId,
        });

        await logDispatcherAction(req, 'dispatch_create_auto_team', 'dispatch', autoAssignment.dispatches[0]?.dispatch_id || null, {
          report_id: validatedReportId,
          assignment_group_id: assignmentGroupId,
          responder_count: autoAssignment.dispatches.length,
          department_code: validatedDepartmentCode,
          team_name: validatedTeamName,
          unassigned_reason: autoAssignment.assignment_summary?.unassigned_reason || null,
        });

        if (autoAssignment.dispatches.length === 0) {
          return res.status(409).json({
            assignment_group_id: assignmentGroupId,
            report_id: validatedReportId,
            dispatches: [],
            assignment_summary: autoAssignment.assignment_summary,
            error: 'No available or standby responders found for selected team',
          });
        }

        // Transition to in_progress when team assigned (including dept admin adding team to department-only)
        if (autoAssignment.dispatches.length > 0) {
          try {
            await Incident.transitionStatus(validatedReportId, {
              next_status: 'in_progress',
              actor_user_id: assignedByUserId,
              actor_role: req.user?.role || null,
            });
          } catch (_) {
            // Best-effort lifecycle hook; keep dispatch creation successful.
          }
          await stampManualTeamAssignment(validatedReportId, validatedDepartmentCode, validatedTeamName);
        }

        const updatedIncident = await Incident.findById(validatedReportId);
        emitDispatchEvent(req, 'incident:dispatched', validatedReportId, updatedIncident);
        emitDispatchEvent(req, 'incident:status_updated', validatedReportId, updatedIncident);

        return res.status(201).json({
          assignment_group_id: assignmentGroupId,
          report_id: validatedReportId,
          dispatches: autoAssignment.dispatches,
          assignment_summary: autoAssignment.assignment_summary,
        });
      }

      // Legacy single-responder path (backward compatible)
      if (!responder_id) {
        return res.status(400).json({ error: 'responder_id is required' });
      }
      const validatedResponderId = validateInteger(responder_id, 'responder_id');
      const responderExists = await Dispatch.responderExists(validatedResponderId);
      if (!responderExists) {
        return res.status(404).json({ error: 'Responder not found' });
      }
      const responder = await Responder.findById(validatedResponderId);

      const dispatch = await Dispatch.create({
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus,
        department_code: validatedDepartmentCode,
        department_name: validatedDepartmentName,
        team_name: validatedTeamName,
        default_department_code: validatedDefaultDepartmentCode,
        was_default_department: validatedWasDefaultDepartment,
        responder_source: responder?.source_type || 'account',
        responder_name: responder?.name || null,
        assigned_by_user_id: assignedByUserId,
      });

      try {
        await Responder.updateStatus(validatedResponderId, 'busy');
      } catch (err) {
        console.error('Failed to update responder status to busy:', err.message);
      }
      if (validatedDepartmentCode && validatedTeamName) {
        try {
          const team = await Responder.findTeamByDepartmentAndName(validatedDepartmentCode, validatedTeamName);
          if (team && team.team_id) {
            await Responder.updateTeamStatus(team.team_id, 'busy');
          }
        } catch (err) {
          console.error('Failed to update team status to busy:', err.message);
        }
      }

      await logDispatcherAction(req, 'dispatch_create', 'dispatch', dispatch.dispatch_id, {
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus,
        department_code: validatedDepartmentCode,
        team_name: validatedTeamName,
      });

      // Transition to in_progress when responder assigned (legacy path)
      try {
        await Incident.transitionStatus(validatedReportId, {
          next_status: 'in_progress',
          actor_user_id: assignedByUserId,
          actor_role: req.user?.role || null,
        });
      } catch (_) {
        // Best-effort lifecycle hook; keep dispatch creation successful.
      }
      const updatedIncident = await Incident.findById(validatedReportId);
      emitDispatchEvent(req, 'incident:dispatched', validatedReportId, updatedIncident);
      emitDispatchEvent(req, 'incident:status_updated', validatedReportId, updatedIncident);
      res.status(201).json(dispatch);
    } catch (error) {
      console.error('Error creating dispatch:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get dispatch by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'dispatch ID');
      
      const dispatch = await Dispatch.findById(validatedId);

      if (!dispatch) {
        return res.status(404).json({ error: 'Dispatch not found' });
      }

      res.json(dispatch);
    } catch (error) {
      console.error('Error fetching dispatch:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get all dispatches with pagination and filters
  async getAll(req, res) {
    try {
      const {
        limit,
        offset,
        report_id,
        responder_id,
        response_status,
        assignment_group_id,
        department_code,
      } = req.query;

      // Validate pagination
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
      
      // Validate optional filters
      const validatedReportId = report_id ? validateInteger(report_id, 'report_id') : null;
      const validatedResponderId = responder_id ? validateInteger(responder_id, 'responder_id') : null;
      const validatedResponseStatus = response_status ? validateOptionalString(response_status, 'response_status', 50) : null;
      const validatedAssignmentGroupId = assignment_group_id ? validateOptionalString(assignment_group_id, 'assignment_group_id', 64) : null;
      const validatedDepartmentCode = department_code ? validateOptionalString(department_code, 'department_code', 40) : null;

      const dispatches = await Dispatch.findAll({
        limit: validatedLimit,
        offset: validatedOffset,
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus,
        assignment_group_id: validatedAssignmentGroupId,
        department_code: validatedDepartmentCode,
      });

      res.json(dispatches);
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update dispatch (full update required)
  async update(req, res) {
    try {
      const { id } = req.params;
      const { report_id, responder_id, response_status } = req.body;

      // Validate ID
      const validatedId = validateInteger(id, 'dispatch ID');

      // Validate required fields for full update
      if (!report_id || !responder_id || response_status === undefined) {
        return res.status(400).json({ 
          error: 'Full update required: report_id, responder_id, and response_status must be provided' 
        });
      }

      // Validate and sanitize inputs
      const validatedReportId = validateInteger(report_id, 'report_id');
      const validatedResponderId = validateInteger(responder_id, 'responder_id');
      const validatedResponseStatus = validateOptionalString(response_status, 'response_status', 50);

      // Check if dispatch exists
      const existing = await Dispatch.findById(validatedId);
      if (!existing) {
        return res.status(404).json({ error: 'Dispatch not found' });
      }

      // Check if report exists
      const reportExists = await Dispatch.reportExists(validatedReportId);
      if (!reportExists) {
        return res.status(404).json({ error: 'Incident report not found' });
      }

      // Check if responder exists
      const responderExists = await Dispatch.responderExists(validatedResponderId);
      if (!responderExists) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      const updated = await Dispatch.update(validatedId, {
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus
      });

      await logDispatcherAction(req, 'dispatch_update', 'dispatch', validatedId, {
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus
      });
      const incident = await Incident.findById(validatedReportId);
      emitDispatchEvent(req, 'incident:status_updated', validatedReportId, incident);
      res.json(updated);
    } catch (error) {
      console.error('Error updating dispatch:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete dispatch
  async delete(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'dispatch ID');

      const deleted = await Dispatch.delete(validatedId);

      if (!deleted) {
        return res.status(404).json({ error: 'Dispatch not found' });
      }

      await logDispatcherAction(req, 'dispatch_delete', 'dispatch', validatedId, {
        report_id: deleted.report_id,
        responder_id: deleted.responder_id
      });
      const incident = await Incident.findById(deleted.report_id);
      emitDispatchEvent(req, 'incident:status_updated', deleted.report_id, incident);
      res.json({ message: 'Dispatch deleted successfully', dispatch: deleted });
    } catch (error) {
      console.error('Error deleting dispatch:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Undo a previously notified department when no team has been assigned yet.
  async undoDepartmentNotification(req, res) {
    try {
      const validatedReportId = validateInteger(req.body?.report_id, 'report_id');
      const validatedDepartmentCode = validateOptionalString(req.body?.department_code, 'department_code', 40);

      if (!validatedDepartmentCode) {
        return res.status(400).json({ error: 'department_code is required' });
      }

      const reportExists = await Dispatch.reportExists(validatedReportId);
      if (!reportExists) {
        return res.status(404).json({ error: 'Incident report not found' });
      }

      const relatedDispatches = await Dispatch.findAll({
        report_id: validatedReportId,
        department_code: validatedDepartmentCode,
        limit: 200,
        offset: 0,
      });

      if (!Array.isArray(relatedDispatches) || relatedDispatches.length === 0) {
        return res.status(404).json({ error: 'Department notification not found for this incident' });
      }

      const hasTeamAssignment = relatedDispatches.some((row) => String(row.team_name || '').trim() !== '');
      if (hasTeamAssignment) {
        return res.status(409).json({
          error: 'Cannot undo department notification once a team is assigned',
          code: 'TEAM_ALREADY_ASSIGNED',
        });
      }

      const departmentOnlyRows = relatedDispatches.filter((row) => String(row.team_name || '').trim() === '');
      if (departmentOnlyRows.length === 0) {
        return res.status(409).json({ error: 'No undoable department notification found' });
      }

      const deletedDispatches = [];
      for (const row of departmentOnlyRows) {
        const deleted = await Dispatch.delete(row.dispatch_id);
        if (deleted) deletedDispatches.push(deleted);
      }

      await logDispatcherAction(req, 'dispatch_undo_department_notification', 'dispatch', deletedDispatches[0]?.dispatch_id || null, {
        report_id: validatedReportId,
        department_code: validatedDepartmentCode,
        deleted_count: deletedDispatches.length,
      });

      const remaining = await Dispatch.findAll({ report_id: validatedReportId, limit: 20, offset: 0 });
      const stillNotified = Array.isArray(remaining) && remaining.length > 0;
      if (!stillNotified) {
        await Incident.updateAutoAssignment(validatedReportId, {
          auto_assignment_status: AUTO_STATUS.NONE,
          suggested_department_code: null,
          suggested_team_name: null,
          auto_assignment_reason: 'notify_undone',
          auto_assignment_mismatch: false,
        }).catch(() => null);
      }

      const incident = await Incident.findById(validatedReportId);
      emitDispatchEvent(req, 'incident:dispatched', validatedReportId, incident);

      return res.json({
        message: 'Department notification undone',
        report_id: validatedReportId,
        department_code: validatedDepartmentCode,
        deleted_count: deletedDispatches.length,
      });
    } catch (error) {
      console.error('Error undoing department notification:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async confirmSuggestion(req, res) {
    try {
      if (!isOpsAssignRole(req.user?.role)) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      const validatedReportId = validateInteger(req.body?.report_id, 'report_id');
      const incident = await Incident.findById(validatedReportId);
      if (!incident) return res.status(404).json({ error: 'Incident report not found' });
      if (String(incident.auto_assignment_status || '').toLowerCase() !== AUTO_STATUS.SUGGESTED) {
        return res.status(409).json({ error: 'No pending suggestion to confirm', code: 'NO_SUGGESTION' });
      }

      const departmentCode = validateOptionalString(req.body?.department_code, 'department_code', 40)
        || incident.suggested_department_code;
      const teamName = validateOptionalString(req.body?.team_name, 'team_name', 150)
        || incident.suggested_team_name;
      if (!departmentCode || !teamName) {
        return res.status(400).json({ error: 'department_code and team_name are required (or persist a suggestion first)' });
      }

      const scope = await assertDepartmentScope(req, departmentCode);
      if (!scope.ok) return res.status(scope.status).json(scope.body);

      if (await Dispatch.departmentHasTeam(validatedReportId, departmentCode)) {
        return res.status(409).json({ error: 'A team is already assigned. Use reassign-team.', code: 'PRIMARY_TEAM_ALREADY_ASSIGNED' });
      }

      const departmentName = (await Department.findByCode(departmentCode))?.name || departmentCode;
      const assignedByUserId = req.user?.user_id ? validateInteger(req.user.user_id, 'assigned_by_user_id') : null;
      const result = await applyTeam({
        req,
        incident,
        departmentCode,
        departmentName,
        teamName,
        incidentType: incident.incident_type,
        assignedByUserId,
        autoStatus: AUTO_STATUS.CONFIRMED,
        reason: 'suggestion_confirmed',
      });
      if (result.outcome !== 'auto_applied') {
        return res.status(409).json({ error: 'No available or standby responders found for selected team', assignment_summary: result.assignment_summary });
      }
      await logDispatcherAction(req, 'dispatch_confirm_suggestion', 'dispatch', result.dispatches?.[0]?.dispatch_id || null, {
        report_id: validatedReportId,
        department_code: departmentCode,
        team_name: teamName,
      });
      return res.status(201).json(result);
    } catch (error) {
      console.error('Error confirming suggestion:', error);
      if (error.message?.includes('must be') || error.message?.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async reassignTeam(req, res) {
    try {
      if (!isOpsAssignRole(req.user?.role)) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      const validatedReportId = validateInteger(req.body?.report_id, 'report_id');
      const departmentCode = validateOptionalString(req.body?.department_code, 'department_code', 40);
      const teamName = validateOptionalString(req.body?.team_name, 'team_name', 150);
      const reason = validateOptionalString(req.body?.reason, 'reason', 500);
      if (!reason || String(reason).trim().length < 10) {
        return res.status(400).json({ error: 'A reassign reason with at least 10 characters is required' });
      }
      const incident = await Incident.findById(validatedReportId);
      if (!incident) return res.status(404).json({ error: 'Incident report not found' });
      if (String(incident.status || '').toLowerCase() === 'closed') {
        return res.status(409).json({ error: 'Cannot reassign a closed incident' });
      }

      const releaseDept = departmentCode || await Dispatch.getPrimaryTeamDepartment(validatedReportId);
      if (releaseDept) {
        const scope = await assertDepartmentScope(req, releaseDept);
        if (!scope.ok) return res.status(scope.status).json(scope.body);
      }
      if (departmentCode && teamName) {
        const scope = await assertDepartmentScope(req, departmentCode);
        if (!scope.ok) return res.status(scope.status).json(scope.body);
        const currentPrimary = (await Dispatch.findPrimaryTeamDispatches(validatedReportId))[0];
        const sameTeam = currentPrimary
          && String(currentPrimary.department_code || '').toLowerCase() === String(departmentCode).toLowerCase()
          && String(currentPrimary.team_name || '').toLowerCase() === String(teamName).toLowerCase();
        if (sameTeam) {
          return res.status(409).json({ error: 'That team is already assigned to this incident' });
        }
        const team = await Responder.findTeamByDepartmentAndName(departmentCode, teamName);
        if (!team) return res.status(404).json({ error: 'Selected team not found in department' });
        const teamStatus = String(team.team_status || '').toLowerCase();
        if (!(teamStatus.includes('available') || teamStatus.includes('standby'))) {
          return res.status(409).json({ error: 'Selected team is currently unavailable', team_status: team.team_status });
        }
        const eligible = await Responder.findEligibleByTeam({
          department_code: departmentCode,
          team_name: teamName,
          incident_type: incident.incident_type,
          limit: 1,
        });
        if (!Array.isArray(eligible) || eligible.length === 0) {
          return res.status(409).json({ error: 'No available or standby responders found for selected team' });
        }
      }

      await Dispatch.releaseTeamAssignment(validatedReportId, releaseDept || null);
      const assignedByUserId = req.user?.user_id ? validateInteger(req.user.user_id, 'assigned_by_user_id') : null;

      if (!departmentCode || !teamName) {
        await Incident.updateAutoAssignment(validatedReportId, {
          auto_assignment_status: AUTO_STATUS.OVERRIDDEN,
          suggested_department_code: departmentCode || null,
          suggested_team_name: null,
          auto_assignment_reason: reason,
          auto_assignment_mismatch: false,
        });
        try {
          await Incident.transitionStatus(validatedReportId, {
            next_status: 'verified',
            actor_user_id: assignedByUserId,
            actor_role: req.user?.role || null,
          });
        } catch (_) {}
        const updated = await Incident.findById(validatedReportId);
        emitDispatchEvent(req, 'incident:dispatched', validatedReportId, updated);
        emitDispatchEvent(req, 'incident:status_updated', validatedReportId, updated);
        return res.json({ outcome: 'released', incident: updated });
      }

      const departmentName = (await Department.findByCode(departmentCode))?.name || departmentCode;
      const refreshed = await Incident.findById(validatedReportId);
      const result = await applyTeam({
        req,
        incident: refreshed,
        departmentCode,
        departmentName,
        teamName,
        incidentType: refreshed.incident_type,
        assignedByUserId,
        autoStatus: AUTO_STATUS.OVERRIDDEN,
        reason,
      });
      if (result.outcome !== 'auto_applied') {
        return res.status(409).json({ error: 'No available or standby responders found for selected team', assignment_summary: result.assignment_summary });
      }
      await logDispatcherAction(req, 'dispatch_reassign_team', 'dispatch', result.dispatches?.[0]?.dispatch_id || null, {
        report_id: validatedReportId,
        department_code: departmentCode,
        team_name: teamName,
        reason,
      });
      return res.status(201).json(result);
    } catch (error) {
      console.error('Error reassigning team:', error);
      if (error.message?.includes('must be') || error.message?.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateMyResponseStatus(req, res) {
    try {
      const userId = req.user?.user_id;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const validatedReportId = validateInteger(req.body?.report_id, 'report_id');
      const nextStatus = validateOptionalString(req.body?.response_status, 'response_status', 50);
      const allowed = new Set(['assigned', 'en route', 'on scene', 'resolved']);
      const normalized = String(nextStatus || '').trim().toLowerCase();
      if (!allowed.has(normalized)) {
        return res.status(400).json({ error: 'response_status must be Assigned, En Route, On Scene, or Resolved' });
      }
      const titleCase = {
        assigned: 'Assigned',
        'en route': 'En Route',
        'on scene': 'On Scene',
        resolved: 'Resolved',
      }[normalized];

      const dispatch = await Dispatch.findByReportAndUser(validatedReportId, userId);
      if (!dispatch) {
        return res.status(404).json({ error: 'No team assignment found for this incident' });
      }

      const updatedDispatch = await Dispatch.updateResponseStatus(dispatch.dispatch_id, titleCase);
      const incident = await Incident.findById(validatedReportId);
      const isVolunteerAcceptor = Number(incident?.accepted_by_user_id) === Number(userId);
      if (isVolunteerAcceptor) {
        try {
          await pool.query(
            'UPDATE incident_reports SET responder_status = $1 WHERE report_id = $2',
            [titleCase, validatedReportId]
          );
        } catch (_) {}
      }

      const actorName = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ')
        || `Responder #${userId}`;
      try {
        await IncidentCoordinationNote.create({
          report_id: validatedReportId,
          user_id: userId,
          author_name: actorName,
          author_role: req.user?.role || 'responder',
          department: dispatch.department_name || dispatch.department_code || 'Operations',
          note: `${actorName} set status to ${titleCase}`,
          source: 'Team Member',
        });
      } catch (noteErr) {
        console.warn('[dispatch] team status note failed:', noteErr.message);
      }

      const refreshed = await Incident.findById(validatedReportId);
      emitDispatchEvent(req, 'incident:status_updated', validatedReportId, refreshed);
      emitDispatchEvent(req, 'incident:note_added', validatedReportId, refreshed);
      const wss = req?.app?.locals?.wss;
      if (wss?.broadcast) {
        Promise.resolve(wss.broadcast('responder:status_changed', {
          report_id: validatedReportId,
          reporter_id: refreshed?.user_id ?? null,
          old_status: dispatch.response_status || null,
          new_status: titleCase,
          responder_status: isVolunteerAcceptor ? titleCase : (refreshed?.responder_status ?? null),
          updated_by_user_id: userId,
          updated_by_name: actorName,
          source: 'team_member',
          assigned_team_name: dispatch.team_name || refreshed?.assigned_team_name || null,
        })).catch(() => {});
      }
      return res.json({
        dispatch: updatedDispatch,
        incident_responder_status_updated: isVolunteerAcceptor,
        incident_resolved: false,
      });
    } catch (error) {
      console.error('Error updating member response status:', error);
      if (error.message?.includes('must be') || error.message?.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
};

dispatchController.assertPrimaryTeamLock = assertPrimaryTeamLock;
module.exports = dispatchController;
