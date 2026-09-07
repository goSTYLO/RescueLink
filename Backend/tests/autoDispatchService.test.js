jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/models/dispatch', () => ({
  hasPrimaryTeamAssignment: jest.fn(),
  createAutoAssignmentGroup: jest.fn(),
  createDepartmentOnly: jest.fn(),
  findAll: jest.fn(),
  getPrimaryTeamDepartment: jest.fn(),
}));

jest.mock('../src/models/responder', () => ({
  listTeams: jest.fn(),
  findEligibleByTeam: jest.fn(),
}));

jest.mock('../src/models/incident', () => ({
  updateAutoAssignment: jest.fn(),
  findById: jest.fn(),
  transitionStatus: jest.fn(),
}));

jest.mock('../src/models/department', () => ({
  findAll: jest.fn(),
  findByCode: jest.fn(),
}));

jest.mock('../src/utils/incidentEvents', () => ({
  emitIncidentEvent: jest.fn(),
}));

const pool = require('../src/config/db');
const Dispatch = require('../src/models/dispatch');
const Responder = require('../src/models/responder');
const Incident = require('../src/models/incident');
const Department = require('../src/models/department');
const {
  maybeAutoDispatch,
  mapTypeToDepartment,
  SOS_DEPARTMENT_CODE,
} = require('../src/services/autoDispatchService');

describe('autoDispatchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Dispatch.hasPrimaryTeamAssignment.mockResolvedValue(false);
    Dispatch.findAll.mockResolvedValue([]);
    Dispatch.createAutoAssignmentGroup.mockResolvedValue({
      dispatches: [{ dispatch_id: 1, team_name: 'Rescue Alpha' }],
      assignment_summary: { assigned_count: 1 },
    });
    Dispatch.createDepartmentOnly.mockResolvedValue({ dispatch_id: 9 });
    Incident.updateAutoAssignment.mockResolvedValue({});
    Incident.transitionStatus.mockResolvedValue({});
    Incident.findById.mockImplementation(async (id) => ({ report_id: id, status: 'in_progress' }));
    Department.findByCode.mockResolvedValue({ code: 'drrmo', name: 'CDRRMO' });
    pool.query.mockResolvedValue({
      rows: [
        { code: 'pnp', supported_incident_types: ['police'], status: 'active' },
        { code: 'drrmo', supported_incident_types: ['fire', 'medical', 'disaster', 'accident'], status: 'active' },
      ],
    });
    Responder.listTeams.mockResolvedValue([
      { team_id: 1, team_name: 'Rescue Alpha', team_status: 'available', supported_incident_types: ['disaster', 'medical'], is_active: true },
    ]);
    Responder.findEligibleByTeam.mockResolvedValue([{ responder_id: 11, name: 'Rescuer' }]);
  });

  it('maps police to pnp and medical to drrmo', async () => {
    await expect(mapTypeToDepartment('police')).resolves.toBe('pnp');
    await expect(mapTypeToDepartment('medical')).resolves.toBe('drrmo');
    await expect(mapTypeToDepartment('SOS')).resolves.toBe(SOS_DEPARTMENT_CODE);
  });

  it('auto-assigns one CDRRMO team for SOS without AI confidence', async () => {
    const result = await maybeAutoDispatch({
      report_id: 42,
      incident_type: 'SOS',
      status: 'pending',
    }, { source: 'sos' });

    expect(result.outcome).toBe('auto_applied');
    expect(Dispatch.createAutoAssignmentGroup).toHaveBeenCalledWith(expect.objectContaining({
      report_id: 42,
      department_code: 'drrmo',
      team_name: 'Rescue Alpha',
    }));
    expect(Incident.updateAutoAssignment).toHaveBeenCalledWith(42, expect.objectContaining({
      auto_assignment_status: 'auto_applied',
      auto_assignment_reason: 'sos_cdrrmo_auto',
    }));
  });

  it('auto-assigns on high-confidence AI medical reports', async () => {
    const result = await maybeAutoDispatch({
      report_id: 7,
      incident_type: 'medical',
      status: 'pending',
    }, { source: 'ai', aiResult: { lowConfidenceFlag: false, fallbackUsed: false } });

    expect(result.outcome).toBe('auto_applied');
    expect(Dispatch.createAutoAssignmentGroup).toHaveBeenCalled();
  });

  it('suggests when AI confidence is low', async () => {
    const result = await maybeAutoDispatch({
      report_id: 8,
      incident_type: 'medical',
      status: 'pending',
    }, { source: 'ai', aiResult: { lowConfidenceFlag: true, fallbackUsed: false } });

    expect(result.outcome).toBe('suggested');
    expect(Dispatch.createAutoAssignmentGroup).not.toHaveBeenCalled();
    expect(Incident.updateAutoAssignment).toHaveBeenCalledWith(8, expect.objectContaining({
      auto_assignment_status: 'suggested',
      auto_assignment_reason: 'low_confidence',
    }));
  });

  it('suggests text-only non-SOS reports', async () => {
    const result = await maybeAutoDispatch({
      report_id: 9,
      incident_type: 'fire',
      status: 'pending',
    }, { source: 'text' });

    expect(result.outcome).toBe('suggested');
    expect(Dispatch.createAutoAssignmentGroup).not.toHaveBeenCalled();
  });

  it('blocks auto-apply for duplicate-flagged incidents', async () => {
    const result = await maybeAutoDispatch({
      report_id: 10,
      incident_type: 'SOS',
      status: 'pending',
      flagged_for_review: true,
    }, { source: 'sos' });

    expect(result.outcome).toBe('suggested');
    expect(result.reason).toBe('duplicate_flagged');
    expect(Dispatch.createAutoAssignmentGroup).not.toHaveBeenCalled();
  });

  it('notifies the department when SOS has no free team', async () => {
    Responder.findEligibleByTeam.mockResolvedValue([]);
    const result = await maybeAutoDispatch({
      report_id: 11,
      incident_type: 'sos',
      status: 'pending',
    }, { source: 'sos' });

    expect(result.outcome).toBe('dept_notified');
    expect(Dispatch.createDepartmentOnly).toHaveBeenCalledWith(expect.objectContaining({
      department_code: 'drrmo',
    }));
  });

  it('falls back to department notify when the picked team has no members at apply time', async () => {
    Dispatch.createAutoAssignmentGroup.mockResolvedValueOnce({
      dispatches: [],
      assignment_summary: { unassigned_reason: 'no_available_team_members' },
    });
    const result = await maybeAutoDispatch({
      report_id: 21,
      incident_type: 'SOS',
      status: 'pending',
    }, { source: 'sos' });

    expect(result.outcome).toBe('dept_notified');
    expect(Dispatch.createDepartmentOnly).toHaveBeenCalled();
  });

  it('skips when a primary team is already assigned', async () => {
    Dispatch.hasPrimaryTeamAssignment.mockResolvedValue(true);
    const result = await maybeAutoDispatch({
      report_id: 12,
      incident_type: 'SOS',
      status: 'pending',
    }, { source: 'sos' });
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('already_teamed');
  });
});
