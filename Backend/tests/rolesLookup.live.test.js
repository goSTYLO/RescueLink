/**
 * Live DB checks for roles lookup + sync trigger. Skips when the schema is not migrated.
 */
const pool = require('../src/config/db');
const User = require('../src/models/user');

async function schemaReady() {
  try {
    await pool.query('SELECT 1 FROM roles LIMIT 0');
    await pool.query('SELECT role_id FROM users LIMIT 0');
    return true;
  } catch {
    return false;
  }
}

describe('roles lookup (live db)', () => {
  let ready = false;
  let userId;

  beforeAll(async () => {
    ready = await schemaReady();
  });

  afterAll(async () => {
    if (!ready) return;
    try {
      if (userId) await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    } catch (_) { /* cleanup best-effort */ }
  });

  it('stores role_id, syncs code from trigger, rejects unknown ids, and leaves role_id on deactivate', async () => {
    if (!ready) return;
    const inserted = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password, role, role_id, phone_verified)
       VALUES ('Role', 'Test', $1, $2, 'x', 'user', 8, TRUE)
       RETURNING user_id, role, role_id`,
      [`role.lookup.${Date.now()}@rescuelink.test`, `63901${String(Date.now()).slice(-8)}`]
    );
    userId = inserted.rows[0].user_id;
    expect(inserted.rows[0]).toMatchObject({ role: 'user', role_id: 8 });

    const promoted = await pool.query(
      'UPDATE users SET role_id = 1 WHERE user_id = $1 RETURNING role, role_id',
      [userId]
    );
    expect(promoted.rows[0]).toMatchObject({ role: 'admin', role_id: 1 });

    const volunteer = await pool.query(
      "UPDATE users SET role = 'volunteer' WHERE user_id = $1 RETURNING role, role_id",
      [userId]
    );
    expect(volunteer.rows[0]).toMatchObject({ role: 'volunteer', role_id: 7 });

    await expect(
      pool.query('INSERT INTO users (first_name, last_name, email, password, role, role_id) VALUES ($1,$2,$3,$4,$5,$6)', [
        'Bad', 'Role', `bad.role.${Date.now()}@rescuelink.test`, 'x', 'user', 99,
      ])
    ).rejects.toMatchObject({ code: '23503' });

    const roleCode = await User.getRoleById(userId);
    expect(roleCode).toBe('volunteer');

    await User.deactivate(userId);
    const afterDeactivate = await pool.query(
      'SELECT role, role_id, is_active FROM users WHERE user_id = $1',
      [userId]
    );
    expect(afterDeactivate.rows[0]).toMatchObject({ role: 'volunteer', role_id: 7, is_active: false });
  });
});
