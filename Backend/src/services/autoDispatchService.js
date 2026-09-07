/**
 * Hybrid auto team assignment.
 * SOS always targets one CDRRMO (drrmo) team. AI reports auto-apply when
 * confidence is high and a matching available team exists; otherwise persist a
 * suggestion. Text-only / no-AI non-SOS is suggestion-only.
 *
 * ponytail: team pick is type + availability, not GPS. Upgrade: rank by closest-units ETA.
 */

const Dispatch = require('../models/dispatch');
const Responder = require('../models/responder');
const Incident = require('../models/incident');
const Department = require('../models/department');
const pool = require('../config/db');
const { normalizeAiIncidentType } = require('../utils/incidentTypeNormalize');
const { emitIncidentEvent } = require('../utils/incidentEvents');

const SOS_DEPARTMENT_CODE = 'drrmo';
const FALLBACK_TYPE_MAP = {
  police: 'pnp',
  fire: 'drrmo',
  medical: 'drrmo',
  disaster: 'drrmo',
  accident: 'drrmo',
};

const AUTO_STATUS = {
  NONE: 'none',
  SUGGESTED: 'suggested',
  AUTO_APPLIED: 'auto_applied',
  DEPT_NOTIFIED: 'dept_notified',
  CONFIRMED: 'confirmed',
  OVERRIDDEN: 'overridden',
};

function newAssignmentGroupId() {
  return `asg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeDeptCode(value) {
  return String(value || '').trim().toLowerCase();
}

function isSosType(incidentType) {
  return normalizeAiIncidentType(incidentType) === 'sos'
    || String(incidentType || '').trim().toUpperCase() === 'SOS';
}

function isTerminalStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'resolved' || normalized === 'closed';
}

function teamStatusRank(teamStatus) {
  const normalized = String(teamStatus || '').toLowerCase();
  if (normalized.includes('available')) return 2;
  if (normalized.includes('standby')) return 1;
  return 0;
}

async function listDepartmentsForMapping() {
  try {
    const res = await pool.query(
      `SELECT code, name, supported_incident_types, status
         FROM departments
        WHERE LOWER(COALESCE(status, 'active')) = 'active'`
    );
    return res.rows || [];
  } catch (error) {
    if (error.code === '42703' || /supported_incident_types/i.test(error.message)) {
      const fallback = await Department.findAll();
      return (fallback || []).map((row) => ({
        ...row,
        supported_incident_types: FALLBACK_TYPE_MAP[normalizeDeptCode(row.code)]
          ? Object.keys(FALLBACK_TYPE_MAP).filter((type) => FALLBACK_TYPE_MAP[type] === normalizeDeptCode(row.code))
          : [],
      }));
    }
    throw error;
  }
}

async function mapTypeToDepartment(incidentType) {
  if (isSosType(incidentType)) return SOS_DEPARTMENT_CODE;
  const type = normalizeAiIncidentType(incidentType);
  if (!type || type === 'other') return null;

  const departments = await listDepartmentsForMapping();
  const match = departments.find((dept) => {
    const types = Array.isArray(dept.supported_incident_types) ? dept.supported_incident_types : [];
    return types.map((value) => String(value).toLowerCase()).includes(type);
  });
  if (match?.code) return normalizeDeptCode(match.code);
  return FALLBACK_TYPE_MAP[type] || null;
}

async function departmentNameForCode(departmentCode) {
  const dept = await Department.findByCode(departmentCode);
  return dept?.name || String(departmentCode || '').toUpperCase();
}

async function pickTeam({ departmentCode, incidentType }) {
  const teams = await Responder.listTeams({ department_code: departmentCode, limit: 200 });
  const type = isSosType(incidentType) ? 'sos' : normalizeAiIncidentType(incidentType);
  const assignable = (teams || []).filter((team) => {
    if (team.is_active === false) return false;
    const rank = teamStatusRank(team.team_status);
    if (rank <= 0) return false;
    if (type === 'sos' || type === 'other' || !type) return true;
    const types = Array.isArray(team.supported_incident_types) ? team.supported_incident_types : [];
    if (types.length === 0) return true;
    return types.map((value) => String(value).toLowerCase()).includes(type);
  });

  const ranked = [];
  for (const team of assignable) {
    const eligible = await Responder.findEligibleByTeam({
      department_code: departmentCode,
      team_name: team.team_name,
      incident_type: type,
      limit: 100,
    });
    if (Array.isArray(eligible) && eligible.length > 0) {
      ranked.push({ team, eligibleCount: eligible.length });
    }
  }
  ranked.sort((a, b) => {
    const rankDiff = teamStatusRank(b.team.team_status) - teamStatusRank(a.team.team_status);
    if (rankDiff !== 0) return rankDiff;
    if (b.eligibleCount !== a.eligibleCount) return b.eligibleCount - a.eligibleCount;
    return Number(a.team.team_id || 0) - Number(b.team.team_id || 0);
  });
  return ranked[0] || null;
}

async function persistAssignmentState(reportId, fields) {
  return Incident.updateAutoAssignment(reportId, fields);
}

function emitSafe(req, event, incident) {
  const safeReq = req && typeof req === 'object' ? req : { app: { locals: {} } };
  try {
    emitIncidentEvent(safeReq, event, incident);
  } catch (err) {
    console.error('[autoDispatch] emit failed:', err.message);
  }
}

async function applyTeam({
  req,
  incident,
  departmentCode,
  departmentName,
  teamName,
  incidentType,
  assignedByUserId = null,
  autoStatus,
  reason,
}) {
  const assignmentGroupId = newAssignmentGroupId();
  const autoAssignment = await Dispatch.createAutoAssignmentGroup({
    report_id: incident.report_id,
    department_code: departmentCode,
    department_name: departmentName,
    team_name: teamName,
    incident_type: incidentType,
    default_department_code: departmentCode,
    was_default_department: true,
    response_status: 'Assigned',
    assignment_group_id: assignmentGroupId,
    assigned_by_user_id: assignedByUserId,
  });

  if (!autoAssignment.dispatches.length) {
    return { outcome: 'no_members', assignment_summary: autoAssignment.assignment_summary };
  }

  try {
    await Incident.transitionStatus(incident.report_id, {
      next_status: 'in_progress',
      actor_user_id: assignedByUserId,
      actor_role: 'system',
    });
  } catch (_) {
    // Best-effort lifecycle hook.
  }

  await persistAssignmentState(incident.report_id, {
    auto_assignment_status: autoStatus,
    suggested_department_code: departmentCode,
    suggested_team_name: teamName,
    auto_assignment_reason: reason,
    auto_assignment_mismatch: false,
  });

  const updated = await Incident.findById(incident.report_id);
  if (updated) updated.assigned_team_name = teamName;
  emitSafe(req, 'incident:dispatched', updated);
  emitSafe(req, 'incident:status_updated', updated);
  return {
    outcome: 'auto_applied',
    assignment_group_id: assignmentGroupId,
    dispatches: autoAssignment.dispatches,
    incident: updated,
  };
}

async function applyDepartmentNotify({
  req,
  incident,
  departmentCode,
  departmentName,
  assignedByUserId = null,
  reason,
}) {
  const assignmentGroupId = newAssignmentGroupId();
  await Dispatch.createDepartmentOnly({
    report_id: incident.report_id,
    department_code: departmentCode,
    department_name: departmentName,
    default_department_code: departmentCode,
    was_default_department: true,
    response_status: 'assigned',
    assignment_group_id: assignmentGroupId,
    assigned_by_user_id: assignedByUserId,
  });

  if (String(incident.status || '').toLowerCase() === 'pending') {
    try {
      await Incident.transitionStatus(incident.report_id, {
        next_status: 'verified',
        actor_user_id: assignedByUserId,
        actor_role: 'system',
      });
    } catch (_) {
      // Best-effort lifecycle hook.
    }
  }

  await persistAssignmentState(incident.report_id, {
    auto_assignment_status: AUTO_STATUS.DEPT_NOTIFIED,
    suggested_department_code: departmentCode,
    suggested_team_name: null,
    auto_assignment_reason: reason,
    auto_assignment_mismatch: false,
  });

  const updated = await Incident.findById(incident.report_id);
  emitSafe(req, 'incident:dispatched', updated);
  emitSafe(req, 'incident:status_updated', updated);
  return { outcome: 'dept_notified', assignment_group_id: assignmentGroupId, incident: updated };
}

async function persistSuggestion({
  incident,
  departmentCode,
  teamName,
  reason,
}) {
  await persistAssignmentState(incident.report_id, {
    auto_assignment_status: AUTO_STATUS.SUGGESTED,
    suggested_department_code: departmentCode,
    suggested_team_name: teamName,
    auto_assignment_reason: reason,
    auto_assignment_mismatch: false,
  });
  return { outcome: 'suggested', reason, suggested_department_code: departmentCode, suggested_team_name: teamName };
}

/**
 * @param {object} incident
 * @param {object} [options]
 * @param {object} [options.req]
 * @param {'sos'|'ai'|'retry'|'text'|'reclassify'} [options.source]
 * @param {object} [options.aiResult]
 * @param {boolean} [options.duplicateFlagged]
 */
async function maybeAutoDispatch(incident, options = {}) {
  if (!incident?.report_id) return { outcome: 'skipped', reason: 'missing_incident' };

  const source = options.source || 'text';
  const status = String(incident.status || '').toLowerCase();
  if (isTerminalStatus(status) || incident.archived_at) {
    return { outcome: 'skipped', reason: 'terminal' };
  }

  const hasPrimaryTeam = await Dispatch.hasPrimaryTeamAssignment(incident.report_id);
  if (hasPrimaryTeam) {
    return { outcome: 'skipped', reason: 'already_teamed' };
  }

  const duplicateBlocked = Boolean(incident.is_duplicate)
    || Boolean(incident.flagged_for_review)
    || Boolean(options.duplicateFlagged);
  const sos = isSosType(incident.incident_type);
  const aiResult = options.aiResult || {};
  const lowConfidence = Boolean(aiResult.lowConfidenceFlag) || Boolean(aiResult.fallbackUsed);
  const highConfidenceAi = (source === 'ai' || source === 'retry') && !lowConfidence;

  let departmentCode = sos ? SOS_DEPARTMENT_CODE : await mapTypeToDepartment(incident.incident_type);
  const departmentName = departmentCode ? await departmentNameForCode(departmentCode) : null;
  const picked = departmentCode
    ? await pickTeam({ departmentCode, incidentType: incident.incident_type })
    : null;

  const shouldAutoApply = !duplicateBlocked && (sos || highConfidenceAi) && Boolean(departmentCode);

  if (shouldAutoApply && picked?.team?.team_name) {
    const applied = await applyTeam({
      req: options.req,
      incident,
      departmentCode,
      departmentName,
      teamName: picked.team.team_name,
      incidentType: incident.incident_type,
      assignedByUserId: options.assignedByUserId || null,
      autoStatus: AUTO_STATUS.AUTO_APPLIED,
      reason: sos ? 'sos_cdrrmo_auto' : 'high_confidence_auto',
    });
    if (applied?.outcome === 'auto_applied') return applied;
    // Race: team emptied between pick and apply — fall through to dept-notify.
  }

  if (shouldAutoApply && departmentCode) {
    const existingDept = await Dispatch.findAll({
      report_id: incident.report_id,
      department_code: departmentCode,
      limit: 5,
    });
    if (Array.isArray(existingDept) && existingDept.length > 0) {
      return persistSuggestion({
        incident,
        departmentCode,
        teamName: null,
        reason: 'no_available_team',
      });
    }
    return applyDepartmentNotify({
      req: options.req,
      incident,
      departmentCode,
      departmentName,
      assignedByUserId: options.assignedByUserId || null,
      reason: sos ? 'sos_cdrrmo_no_team' : 'high_confidence_no_team',
    });
  }

  return persistSuggestion({
    incident,
    departmentCode,
    teamName: picked?.team?.team_name || null,
    reason: duplicateBlocked
      ? 'duplicate_flagged'
      : (!departmentCode ? 'unmapped_type' : (lowConfidence ? 'low_confidence' : 'needs_confirm')),
  });
}

async function refreshSuggestionAfterReclassify(incident) {
  const status = String(incident?.auto_assignment_status || '').toLowerCase();
  if (status === AUTO_STATUS.AUTO_APPLIED || status === AUTO_STATUS.CONFIRMED || status === AUTO_STATUS.OVERRIDDEN) {
    const mapped = isSosType(incident.incident_type)
      ? SOS_DEPARTMENT_CODE
      : await mapTypeToDepartment(incident.incident_type);
    const currentTeamDept = await Dispatch.getPrimaryTeamDepartment(incident.report_id);
    const mismatch = Boolean(mapped && currentTeamDept && mapped !== currentTeamDept);
    await persistAssignmentState(incident.report_id, {
      auto_assignment_mismatch: mismatch,
      auto_assignment_reason: mismatch ? 'reclassify_type_mismatch' : incident.auto_assignment_reason,
    });
    return { outcome: 'mismatch_flagged', mismatch };
  }

  if (status === AUTO_STATUS.DEPT_NOTIFIED) {
    const mapped = await mapTypeToDepartment(incident.incident_type);
    const mismatch = Boolean(mapped && incident.suggested_department_code
      && mapped !== normalizeDeptCode(incident.suggested_department_code));
    await persistAssignmentState(incident.report_id, {
      auto_assignment_mismatch: mismatch,
      auto_assignment_reason: mismatch ? 'reclassify_dept_mismatch' : incident.auto_assignment_reason,
    });
    return { outcome: 'mismatch_flagged', mismatch };
  }

  return maybeAutoDispatch(incident, { source: 'reclassify' });
}

async function cancelSuggestion(reportId, reason = 'duplicate_linked') {
  const incident = await Incident.findById(reportId);
  if (!incident) return null;
  const status = String(incident.auto_assignment_status || '').toLowerCase();
  if (status !== AUTO_STATUS.SUGGESTED && status !== AUTO_STATUS.NONE) return incident;
  return persistAssignmentState(reportId, {
    auto_assignment_status: AUTO_STATUS.NONE,
    suggested_department_code: null,
    suggested_team_name: null,
    auto_assignment_reason: reason,
    auto_assignment_mismatch: false,
  });
}

module.exports = {
  SOS_DEPARTMENT_CODE,
  AUTO_STATUS,
  FALLBACK_TYPE_MAP,
  mapTypeToDepartment,
  pickTeam,
  maybeAutoDispatch,
  refreshSuggestionAfterReclassify,
  cancelSuggestion,
  applyTeam,
  persistSuggestion,
};
