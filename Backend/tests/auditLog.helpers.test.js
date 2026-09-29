jest.mock('../src/models/auditLog', () => ({
  create: jest.fn().mockResolvedValue({ id: 1 }),
}));

const AuditLog = require('../src/models/auditLog');
const {
  logDispatcherAction,
  logUserAction,
  logUserActionByUser,
  DASHBOARD_AUDIT_ROLES,
} = require('../src/utils/auditLog');

function reqFor(role, userId = 10) {
  return {
    user: { user_id: userId, role },
    ip: '127.0.0.1',
    get: () => 'jest-agent',
  };
}

describe('auditLog helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes department-admin and department-head in dashboard roles', () => {
    expect(DASHBOARD_AUDIT_ROLES).toEqual(
      expect.arrayContaining(['dispatcher', 'admin', 'department-admin', 'department-head']),
    );
  });

  it('logDispatcherAction writes for department-admin', async () => {
    await logDispatcherAction(reqFor('department-admin'), 'department_unit_create', 'department_unit', 5, {
      department_id: 2,
    });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 10,
      action: 'department_unit_create',
      resource_type: 'department_unit',
      resource_id: 5,
    }));
  });

  it('logDispatcherAction skips citizen users', async () => {
    await logDispatcherAction(reqFor('user'), 'department_create', 'department', 1, null);
    expect(AuditLog.create).not.toHaveBeenCalled();
  });

  it('logUserActionByUser writes citizen login', async () => {
    await logUserActionByUser(
      { user_id: 99, role: 'user' },
      reqFor('user', 99),
      'user_login',
      'auth',
      null,
      { method: 'phone' },
    );
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 99,
      action: 'user_login',
      resource_type: 'auth',
    }));
  });

  it('logUserAction writes password_change for citizens', async () => {
    await logUserAction(reqFor('user', 7), 'password_change', 'auth', null, { note: 'Password updated' });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 7,
      action: 'password_change',
    }));
  });
});
