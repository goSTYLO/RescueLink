const Dispatch = require('../models/dispatch');
const Responder = require('../models/responder');
const Incident = require('../models/incident');
const User = require('../models/user');
const Department = require('../models/department');
const { validateInteger, validateOptionalString, validatePagination } = require('../utils/validation');
const { logDispatcherAction } = require('../utils/auditLog');
const { ROLES } = require('../config/roles');
const { persistIncidentNotifications } = require('../services/notificationPersistence');

function emitDispatchEvent(req, event, reportId, incident = null) {
  const wss = req.app?.locals?.wss;
  if (!reportId) return;
  const data = incident
    ? {
        report_id: reportId,
        reporter_id: incident.user_id ?? incident.userId ?? incident.reporter_id,
        status: incident.status,
        incident_type: incident.incident_type,
        severity_level: incident.severity_level,
        barangay: incident.barangay,
        updated_at: incident.updated_at ?? incident.created_at ?? new Date().toISOString(),
      }
    : { report_id: reportId, updated_at: new Date().toISOString() };
  if (wss?.broadcast) {
    wss.broadcast(event, data).catch(() => {});
  }
  persistIncidentNotifications(event, data).catch((err) =>
    console.error('[emitDispatchEvent] Notification persistence failed:', err.message)
  );
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
      if (req.user.role === ROLES.DEPARTMENT_ADMIN && req.user.user_id && validatedDepartmentCode) {
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
  }
};

module.exports = dispatchController;
