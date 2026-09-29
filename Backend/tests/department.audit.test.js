jest.mock('../src/utils/auditLog', () => ({
  logDispatcherAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/models/user');
jest.mock('../src/models/department');

const Department = require('../src/models/department');
const User = require('../src/models/user');
const { logDispatcherAction } = require('../src/utils/auditLog');
const departmentController = require('../src/controllers/department');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('department controller audit writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs department_create after successful create', async () => {
    Department.create.mockResolvedValue({
      department_id: 11,
      name: 'BFP Station',
      code: 'bfp-station',
      type: 'fire',
      latitude: null,
      longitude: null,
    });

    const req = {
      body: { name: 'BFP Station', type: 'fire', color: '#ff0000' },
      user: { user_id: 1, role: 'admin' },
    };
    const res = mockRes();

    await departmentController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(logDispatcherAction).toHaveBeenCalledWith(
      req,
      'department_create',
      'department',
      11,
      expect.objectContaining({ name: 'BFP Station', code: 'bfp-station' }),
    );
  });

  it('logs department_unit_assign', async () => {
    User.findById.mockResolvedValue({ user_id: 4, department_id: 2 });
    Department.recordUnitUsageForIncident.mockResolvedValue({
      report_id: 9,
      unit_id: 3,
      department_id: 2,
    });

    const req = {
      params: { id: '2', unitId: '3' },
      body: { report_id: 9 },
      user: { user_id: 4, role: 'department-admin' },
    };
    const res = mockRes();

    await departmentController.assignUnit(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(logDispatcherAction).toHaveBeenCalledWith(
      req,
      'department_unit_assign',
      'department_unit',
      3,
      expect.objectContaining({ department_id: 2, report_id: 9 }),
    );
  });
});
