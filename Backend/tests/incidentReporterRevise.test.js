jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/models/incident', () => ({
  findById: jest.fn(),
  cancelByReporter: jest.fn(),
  updateDetailsByReporter: jest.fn(),
}));

jest.mock('../src/models/dispatch', () => ({
  findAll: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/models/department', () => ({
  releaseUnitsFromReport: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/models/auditLog', () => ({
  create: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.mock('../src/services/autoDispatchService', () => ({
  maybeAutoDispatch: jest.fn().mockResolvedValue({ outcome: 'skipped' }),
  refreshSuggestionAfterReclassify: jest.fn(),
  cancelSuggestion: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/services/notificationPersistence', () => ({
  persistIncidentNotifications: jest.fn().mockResolvedValue(undefined),
  getRecipientUserIds: jest.fn(async () => []),
  getCriticalDispatchRecipients: jest.fn(async () => ({ kind: 'staff', userIds: [] })),
}));

jest.mock('../src/utils/geolocation', () => ({
  getBarangayFromCoordinates: jest.fn(() => 'Pogo Chico'),
  calculateDistance: jest.fn(),
  isPointInDagupan: jest.fn(() => true),
}));

const Incident = require('../src/models/incident');
const Dispatch = require('../src/models/dispatch');
const AuditLog = require('../src/models/auditLog');
const { maybeAutoDispatch, cancelSuggestion } = require('../src/services/autoDispatchService');
const { isPointInDagupan } = require('../src/utils/geolocation');
const incidentController = require('../src/controllers/incident');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides = {}) {
  return {
    params: { id: '5' },
    body: {},
    user: { user_id: 9, role: 'volunteer' },
    ip: '127.0.0.1',
    get: () => 'jest',
    app: { locals: {} },
    ...overrides,
  };
}

describe('reporter cancel and edit audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Dispatch.findAll.mockResolvedValue([]);
    isPointInDagupan.mockReturnValue(true);
  });

  it('writes a cancel audit row for a volunteer owner', async () => {
    Incident.findById.mockResolvedValue({
      report_id: 5,
      user_id: 9,
      status: 'pending',
    });
    Incident.cancelByReporter.mockResolvedValue({
      report_id: 5,
      user_id: 9,
      status: 'cancelled',
    });
    const res = makeRes();

    await incidentController.cancelByReporter(makeReq(), res);

    expect(cancelSuggestion).toHaveBeenCalledWith(5, 'reporter_cancelled');
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 9,
      action: 'incident_reporter_cancel',
      resource_type: 'incident',
      resource_id: 5,
      details: { previous_status: 'pending' },
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('writes a details audit row without the description text', async () => {
    Incident.findById.mockResolvedValue({
      report_id: 5,
      user_id: 9,
      status: 'pending',
      description: 'old text',
      latitude: 16.04,
      longitude: 120.33,
      auto_assignment_status: 'suggested',
    });
    Incident.updateDetailsByReporter.mockResolvedValue({
      report_id: 5,
      status: 'pending',
      description: 'new text',
      latitude: 16.05,
      longitude: 120.34,
      barangay: 'Pogo Chico',
    });
    const res = makeRes();

    await incidentController.updateDetailsByReporter(makeReq({
      body: {
        description: 'new text',
        latitude: 16.05,
        longitude: 120.34,
      },
    }), res);

    expect(maybeAutoDispatch).toHaveBeenCalled();
    const audit = AuditLog.create.mock.calls[0][0];
    expect(audit.action).toBe('incident_reporter_update_details');
    expect(audit.user_id).toBe(9);
    expect(audit.details).toEqual(expect.objectContaining({
      description_changed: true,
      previous_latitude: 16.04,
      previous_longitude: 120.33,
      latitude: 16.05,
      longitude: 120.34,
      barangay: 'Pogo Chico',
    }));
    expect(JSON.stringify(audit.details)).not.toContain('new text');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('rejects a pin outside Dagupan before writing an audit row', async () => {
    isPointInDagupan.mockReturnValue(false);
    const res = makeRes();

    await incidentController.updateDetailsByReporter(makeReq({
      body: { description: 'moved', latitude: 14.6, longitude: 120.98 },
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(AuditLog.create).not.toHaveBeenCalled();
    expect(Incident.updateDetailsByReporter).not.toHaveBeenCalled();
  });

  it('does not refresh a suggestion when a team is already dispatched', async () => {
    Incident.findById.mockResolvedValue({
      report_id: 5,
      user_id: 9,
      status: 'in_progress',
      description: 'same',
      latitude: 16.04,
      longitude: 120.33,
      auto_assignment_status: 'suggested',
    });
    Incident.updateDetailsByReporter.mockResolvedValue({ report_id: 5, status: 'in_progress' });
    Dispatch.findAll.mockResolvedValue([{ dispatch_id: 1 }]);
    const res = makeRes();

    await incidentController.updateDetailsByReporter(makeReq({
      body: { description: 'same', latitude: 16.041, longitude: 120.331 },
    }), res);

    expect(maybeAutoDispatch).not.toHaveBeenCalled();
    expect(AuditLog.create).toHaveBeenCalled();
  });
});
