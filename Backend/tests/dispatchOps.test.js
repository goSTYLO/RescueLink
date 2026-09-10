jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/models/dispatch', () => ({
  hasPrimaryTeamAssignment: jest.fn(),
  departmentHasDispatch: jest.fn(),
  departmentHasTeam: jest.fn(),
  isAssistingDepartment: jest.fn(),
  findByReportAndUser: jest.fn(),
  updateResponseStatus: jest.fn(),
  reportExists: jest.fn(),
  countByReportId: jest.fn(),
  getIncidentType: jest.fn(),
}));

jest.mock('../src/models/responder', () => ({
  findTeamByDepartmentAndName: jest.fn(),
  updateTeamStatus: jest.fn(),
  updateStatus: jest.fn(),
}));

jest.mock('../src/models/incident', () => ({
  findById: jest.fn(),
  transitionStatus: jest.fn(),
  updateAutoAssignment: jest.fn(),
}));

jest.mock('../src/models/user', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/models/department', () => ({
  findById: jest.fn(),
  findByCode: jest.fn(),
}));

jest.mock('../src/utils/auditLog', () => ({
  logDispatcherAction: jest.fn(),
}));

jest.mock('../src/services/notificationPersistence', () => ({
  persistIncidentNotifications: jest.fn(),
}));

jest.mock('../src/utils/incidentEvents', () => ({
  buildIncidentEventPayload: jest.fn(() => ({})),
  emitIncidentEvent: jest.fn(),
}));

jest.mock('../src/models/incidentCoordinationNote', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/services/autoDispatchService', () => ({
  AUTO_STATUS: {
    AUTO_APPLIED: 'auto_applied',
    CONFIRMED: 'confirmed',
    OVERRIDDEN: 'overridden',
  },
  applyTeam: jest.fn(),
}));

const pool = require('../src/config/db');
const Dispatch = require('../src/models/dispatch');
const Incident = require('../src/models/incident');
const IncidentCoordinationNote = require('../src/models/incidentCoordinationNote');
const dispatchController = require('../src/controllers/dispatch');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('dispatch primary lock and member status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Dispatch.departmentHasDispatch.mockResolvedValue(false);
    Dispatch.departmentHasTeam.mockResolvedValue(false);
    Dispatch.hasPrimaryTeamAssignment.mockResolvedValue(false);
    Dispatch.isAssistingDepartment.mockResolvedValue(false);
  });

  it('409s a second primary team create for the same incident', async () => {
    Dispatch.hasPrimaryTeamAssignment.mockResolvedValue(true);
    const lock = await dispatchController.assertPrimaryTeamLock({
      reportId: 12,
      departmentCode: 'pnp',
      creatingTeam: true,
      creatingDeptOnly: false,
    });
    expect(lock.ok).toBe(false);
    expect(lock.status).toBe(409);
    expect(lock.body.code).toBe('PRIMARY_TEAM_ALREADY_ASSIGNED');
  });

  it('409s department-only create when that department already has a dispatch', async () => {
    Dispatch.departmentHasDispatch.mockResolvedValue(true);
    const lock = await dispatchController.assertPrimaryTeamLock({
      reportId: 12,
      departmentCode: 'drrmo',
      creatingTeam: false,
      creatingDeptOnly: true,
    });
    expect(lock.ok).toBe(false);
    expect(lock.status).toBe(409);
    expect(lock.body.code).toBe('DEPARTMENT_ALREADY_NOTIFIED');
  });

  it('allows assisting-department team create when a primary team already exists', async () => {
    Dispatch.hasPrimaryTeamAssignment.mockResolvedValue(true);
    Dispatch.isAssistingDepartment.mockResolvedValue(true);
    const lock = await dispatchController.assertPrimaryTeamLock({
      reportId: 12,
      departmentCode: 'pnp',
      creatingTeam: true,
      creatingDeptOnly: false,
    });
    expect(lock.ok).toBe(true);
  });

  it('does not clobber volunteer responder_status when a non-acceptor team member updates dispatch status', async () => {
    Dispatch.findByReportAndUser.mockResolvedValue({
      dispatch_id: 44,
      department_name: 'CDRRMO',
      department_code: 'drrmo',
    });
    Dispatch.updateResponseStatus.mockResolvedValue({ dispatch_id: 44, response_status: 'En Route' });
    Incident.findById.mockResolvedValue({
      report_id: 12,
      accepted_by_user_id: 99,
      status: 'in_progress',
    });

    const req = {
      user: { user_id: 7, first_name: 'Ana', last_name: 'Cruz', role: 'responder' },
      body: { report_id: 12, response_status: 'En Route' },
      app: { locals: { wss: { broadcast: jest.fn() } } },
    };
    const res = mockRes();
    await dispatchController.updateMyResponseStatus(req, res);

    expect(Dispatch.updateResponseStatus).toHaveBeenCalledWith(44, 'En Route');
    expect(req.app.locals.wss.broadcast).toHaveBeenCalledWith(
      'responder:status_changed',
      expect.objectContaining({
        report_id: 12,
        new_status: 'En Route',
        source: 'team_member',
      })
    );
    expect(IncidentCoordinationNote.create).toHaveBeenCalledWith(expect.objectContaining({
      report_id: 12,
      note: expect.stringMatching(/Ana Cruz set status to En Route/),
    }));
    const incidentStatusWrites = pool.query.mock.calls.filter((call) =>
      String(call[0]).includes('responder_status')
    );
    expect(incidentStatusWrites).toHaveLength(0);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      incident_responder_status_updated: false,
      incident_resolved: false,
    }));
  });

  it('updates volunteer responder_status only when the team member is also the acceptor', async () => {
    Dispatch.findByReportAndUser.mockResolvedValue({
      dispatch_id: 44,
      department_name: 'CDRRMO',
    });
    Dispatch.updateResponseStatus.mockResolvedValue({ dispatch_id: 44, response_status: 'On Scene' });
    Incident.findById.mockResolvedValue({
      report_id: 12,
      accepted_by_user_id: 7,
      status: 'in_progress',
    });
    pool.query.mockResolvedValue({ rows: [] });

    const req = {
      user: { user_id: 7, first_name: 'Ana', last_name: 'Cruz', role: 'responder' },
      body: { report_id: 12, response_status: 'On Scene' },
      app: { locals: { wss: { broadcast: jest.fn() } } },
    };
    const res = mockRes();
    await dispatchController.updateMyResponseStatus(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/responder_status/),
      ['On Scene', 12]
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      incident_responder_status_updated: true,
      incident_resolved: false,
    }));
  });
});
