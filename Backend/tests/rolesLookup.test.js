jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const { ROLES, ROLE_IDS, resolveRole } = require('../src/config/roles');
const User = require('../src/models/user');

describe('role ID lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({ rows: [] });
  });

  it('maps canonical codes to the confirmed IDs', () => {
    expect(resolveRole('admin')).toEqual({ code: 'admin', roleId: 1 });
    expect(resolveRole(ROLES.DISPATCHER)).toEqual({ code: 'dispatcher', roleId: 2 });
    expect(resolveRole('supervisor')).toEqual({ code: 'supervisor', roleId: 3 });
    expect(resolveRole('department-admin')).toEqual({ code: 'department-admin', roleId: 4 });
    expect(resolveRole('department-head')).toEqual({ code: 'department-head', roleId: 5 });
    expect(resolveRole('responder')).toEqual({ code: 'responder', roleId: 6 });
    expect(resolveRole('volunteer')).toEqual({ code: 'volunteer', roleId: 7 });
    expect(resolveRole('user')).toEqual({ code: 'user', roleId: 8 });
  });

  it('maps super-admin aliases to role_id 1', () => {
    expect(resolveRole('super-admin').roleId).toBe(1);
    expect(resolveRole('superadmin').roleId).toBe(1);
    expect(ROLE_IDS.admin).toBe(1);
  });

  it('defaults an empty role to user', () => {
    expect(resolveRole('')).toEqual({ code: 'user', roleId: 8 });
    expect(resolveRole(null)).toEqual({ code: 'user', roleId: 8 });
  });

  it('rejects unknown codes', () => {
    expect(() => resolveRole('superuser')).toThrow(/Unknown role/);
    try {
      resolveRole('superuser');
    } catch (err) {
      expect(err.code).toBe('UNKNOWN_ROLE');
    }
  });

  it('User.create stores role_id 1 for admin', async () => {
    pool.query.mockResolvedValue({
      rows: [{ user_id: 10, role: 'admin', role_id: 1, email: 'a@b.c' }],
    });
    const user = await User.create({
      email: 'a@b.c',
      password: 'hash',
      first_name: 'A',
      last_name: 'B',
      role: 'admin',
    });
    expect(user.role).toBe('admin');
    const sql = pool.query.mock.calls[0][0];
    const params = pool.query.mock.calls[0][1];
    expect(sql).toContain('role_id');
    expect(params).toContain(1);
    expect(params).toContain('admin');
  });

  it('User.updateRole rejects unknown codes before writing', async () => {
    await expect(User.updateRole(1, 'superuser')).rejects.toMatchObject({ code: 'UNKNOWN_ROLE' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('User.updateRole writes both code and role_id', async () => {
    pool.query.mockResolvedValue({
      rows: [{ user_id: 1, role: 'dispatcher', role_id: 2 }],
    });
    await User.updateRole(1, 'dispatcher');
    expect(pool.query.mock.calls[0][1]).toEqual(['dispatcher', 2, 1]);
  });

  it('getRoleById returns the role code string', async () => {
    pool.query.mockResolvedValue({ rows: [{ role: 'dispatcher' }] });
    await expect(User.getRoleById(2)).resolves.toBe('dispatcher');
    expect(pool.query.mock.calls[0][0]).toMatch(/SELECT role\b/);
    expect(pool.query.mock.calls[0][0]).not.toContain('role_id');
  });

  it('deactivate and reactivate do not write role_id', async () => {
    pool.query.mockResolvedValue({ rows: [{ user_id: 3, role: 'user', role_id: 8, is_active: false }] });
    await User.deactivate(3);
    expect(pool.query.mock.calls[0][0]).toMatch(/SET is_active = false/i);
    expect(pool.query.mock.calls[0][0]).not.toMatch(/SET[\s\S]*role_id/i);

    pool.query.mockResolvedValue({ rows: [{ user_id: 3, role: 'user', role_id: 8, is_active: true }] });
    await User.reactivate(3);
    expect(pool.query.mock.calls[1][0]).toMatch(/SET is_active = true/i);
    expect(pool.query.mock.calls[1][0]).not.toMatch(/SET[\s\S]*role_id/i);
  });

  it('volunteer maps to role_id 7 on create', async () => {
    pool.query.mockResolvedValue({
      rows: [{ user_id: 4, role: 'volunteer', role_id: 7 }],
    });
    await User.create({ email: 'v@b.c', password: 'hash', first_name: 'V', last_name: 'U', role: 'volunteer' });
    expect(pool.query.mock.calls[0][1]).toContain(7);
    expect(pool.query.mock.calls[0][1]).toContain('volunteer');
  });
});
