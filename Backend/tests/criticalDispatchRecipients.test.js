jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const {
  getCriticalDispatchRecipients,
  getRecipientUserIds,
} = require('../src/services/notificationPersistence');

describe('getCriticalDispatchRecipients', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('returns team member user ids when team dispatches exist', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: 31 }, { user_id: 32 }, { user_id: 31 }],
      })
      .mockResolvedValueOnce({ rows: [{ department_id: 2 }] }) // assigned depts
      .mockResolvedValueOnce({ rows: [{ user_id: 11 }] }); // dept admin

    const result = await getCriticalDispatchRecipients({
      report_id: 100,
      assigned_team_name: 'Rescue Alpha',
    });

    expect(result.kind).toBe('team');
    expect(result.userIds.sort()).toEqual([11, 31, 32]);
  });

  test('returns department admins/heads/responders when dept-only (no team)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // team members
      .mockResolvedValueOnce({ rows: [{ department_id: 2 }] }) // assigned depts
      .mockResolvedValueOnce({ rows: [{ user_id: 11 }, { user_id: 21 }, { user_id: 31 }] }); // dept ops + responders

    const result = await getCriticalDispatchRecipients({ report_id: 200 });

    expect(result.kind).toBe('dept');
    expect(result.userIds.sort()).toEqual([11, 21, 31]);
    const deptStaffSql = pool.query.mock.calls[2][0];
    expect(deptStaffSql).toMatch(/department-admin/);
    expect(deptStaffSql).toMatch(/department-head/);
    expect(deptStaffSql).toMatch(/responder/);
  });

  test('falls through to dept amber when assigned_team_name set but no team user_ids', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // team members empty
      .mockResolvedValueOnce({ rows: [{ department_id: 2 }] }) // assigned depts
      .mockResolvedValueOnce({ rows: [{ user_id: 11 }] }); // dept admin

    const result = await getCriticalDispatchRecipients({
      report_id: 201,
      assigned_team_name: 'Rescue Alpha',
    });

    expect(result.kind).toBe('dept');
    expect(result.userIds).toEqual([11]);
    const deptJoinSql = pool.query.mock.calls[1][0];
    expect(deptJoinSql).toMatch(/LOWER\(TRIM\(d\.code\)\)\s*=\s*LOWER\(TRIM\(dp\.department_code\)\)/);
  });

  test('team amber includes department-admin/head but not unassigned responders', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 31 }] }) // team member
      .mockResolvedValueOnce({ rows: [{ department_id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 11 }, { user_id: 21 }] }); // admin + head

    const result = await getCriticalDispatchRecipients({ report_id: 202 });

    expect(result.kind).toBe('team');
    expect(result.userIds.sort()).toEqual([11, 21, 31]);
    const opsSql = pool.query.mock.calls[2][0];
    expect(opsSql).toMatch(/department-admin/);
    expect(opsSql).toMatch(/department-head/);
    expect(opsSql).not.toMatch(/'responder'/);
  });
});

describe('getRecipientUserIds reporter fallback', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('loads reporter from incident_reports when reporter_id missing', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // assigned dept ids
      .mockResolvedValueOnce({ rows: [{ user_id: 71 }] }) // reporter lookup
      .mockResolvedValueOnce({ rows: [] }); // dispatch responders

    const ids = await getRecipientUserIds('incident:status_updated', { report_id: 308 });

    expect(ids).toContain(71);
    const reporterSql = pool.query.mock.calls[1][0];
    expect(reporterSql).toMatch(/FROM incident_reports/);
    expect(reporterSql).not.toMatch(/FROM incidents\b/);
  });
});
