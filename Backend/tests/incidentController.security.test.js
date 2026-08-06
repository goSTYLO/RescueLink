jest.mock('../src/models/incident', () => ({
  createWithAi: jest.fn(),
  updateWithAiResults: jest.fn(),
  createClassification: jest.fn(),
  markAiPending: jest.fn(),
  updateScanStatus: jest.fn(),
}));

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/utils/validation', () => ({
  validateLatitude: jest.fn((value) => Number(value)),
  validateLongitude: jest.fn((value) => Number(value)),
  validateInteger: jest.fn((value) => Number(value)),
  validatePagination: jest.fn(() => ({ limit: 20, offset: 0 })),
  validateOptionalString: jest.fn((value) => value),
  validateAllowedValue: jest.fn((value) => value),
}));

jest.mock('../src/utils/geolocation', () => ({
  getBarangayFromCoordinates: jest.fn(() => 'Sample Barangay'),
}));

jest.mock('../src/services/aiService', () => ({
  processIncidentWithAudio: jest.fn(),
}));

jest.mock('../src/services/fileScanService', () => ({
  queueDeepScanJob: jest.fn(),
  computeInitialScanStatus: jest.fn(),
}));

jest.mock('../src/services/blockchainService', () => ({
  verifyIncidentOnBlockchain: jest.fn(),
}));

jest.mock('../src/utils/fileValidation', () => ({
  saveAudioFile: jest.fn(),
  saveMediaFiles: jest.fn(),
  deleteIncidentFiles: jest.fn(),
  fileExists: jest.fn(),
  getAbsolutePath: jest.fn((p) => p),
}));

jest.mock('../src/utils/auditLog', () => ({
  logDispatcherAction: jest.fn(),
  logUserAction: jest.fn(),
}));

jest.mock('../src/config/roles', () => ({
  ROLES: { USER: 'user', DISPATCHER: 'dispatcher', ADMIN: 'admin' },
}));

jest.mock('../src/utils/ownership', () => ({
  isResourceOwner: jest.fn(() => true),
  getOwnershipFilter: jest.fn(() => ({})),
}));

const Incident = require('../src/models/incident');
const pool = require('../src/config/db');
const { processIncidentWithAudio } = require('../src/services/aiService');
const { queueDeepScanJob, computeInitialScanStatus } = require('../src/services/fileScanService');
const { saveAudioFile, saveMediaFiles } = require('../src/utils/fileValidation');
const incidentController = require('../src/controllers/incident');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('incidentController security scan response', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Incident.createWithAi.mockResolvedValue({ report_id: 101 });
    Incident.updateWithAiResults.mockResolvedValue({ report_id: 101, severity_level: 'high' });
    Incident.createClassification.mockResolvedValue({});
    Incident.markAiPending.mockResolvedValue({});
    Incident.updateScanStatus.mockResolvedValue({ report_id: 101, scan_status: 'pending' });

    saveAudioFile.mockResolvedValue('uploads/incidents/incident_101_audio.wav');
    saveMediaFiles.mockResolvedValue(['uploads/incidents/incident_101_photo_1.jpg']);

    queueDeepScanJob.mockResolvedValue({ status: 'ready', queued: true, engine: 'clamav', job_id: 'job-101' });
    computeInitialScanStatus.mockReturnValue({ scan_status: 'pending', scan_engine: 'clamav', scan_error: null });

    pool.query.mockResolvedValue({ rows: [] });
  });

  it('returns security_scan metadata when AI succeeds', async () => {
    processIncidentWithAudio.mockResolvedValue({
      primaryType: 'Medical',
      severity: 'high',
      transcription: 'help needed',
      maxConfidence: 0.88,
      lowConfidenceFlag: false,
      incidentTypes: ['Medical'],
    });

    const req = {
      body: { latitude: 16.04, longitude: 120.33, description: 'Emergency' },
      user: { user_id: 1, role: 'user' },
      files: {
        audio: [{ originalname: 'sample.wav', size: 100, buffer: Buffer.from([0x52, 0x49, 0x46, 0x46]) }],
        media: [{ originalname: 'img.jpg', size: 100, buffer: Buffer.from([0xff, 0xd8, 0xff]) }],
      },
      uploadSecurity: {
        quick: { status: 'clean', findings: [] },
        requires_follow_up: true,
      },
    };
    const res = makeRes();

    await incidentController.createWithAudio(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.security_scan).toBeDefined();
    expect(payload.security_scan.quick_scan.status).toBe('clean');
    expect(payload.security_scan.deep_scan.engine).toBe('clamav');
    expect(payload.security_scan.fail_open_flagged).toBe(true);
  });

  it('returns security_scan metadata when AI falls back to pending', async () => {
    processIncidentWithAudio.mockRejectedValue(new Error('AI unavailable'));

    const req = {
      body: { latitude: 16.04, longitude: 120.33, description: 'Emergency' },
      user: { user_id: 1, role: 'user' },
      files: {
        audio: [{ originalname: 'sample.wav', size: 100, buffer: Buffer.from([0x52, 0x49, 0x46, 0x46]) }],
        media: [],
      },
      uploadSecurity: {
        quick: { status: 'clean', findings: [] },
        requires_follow_up: false,
      },
    };
    const res = makeRes();

    await incidentController.createWithAudio(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.ai_status).toBe('pending');
    expect(payload.security_scan).toBeDefined();
    expect(payload.security_scan.deep_scan.job_id).toBe('job-101');
  });
});
