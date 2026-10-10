const User = require('../models/user');
const { ROLES } = require('../config/roles');
const { hashPassword } = require('../utils/hash');
const { validateEmail, validatePassword, validatePhone } = require('../utils/validation');

const DEFAULT_FIRST_NAME = 'Ariel';
const DEFAULT_LAST_NAME = 'Admin';

/**
 * @returns {'insert'|'skip'|'warn_no_admin'|'warn_misconfigured'}
 */
function resolveBootstrapAction(env, adminCount) {
  const enabled = env.BOOTSTRAP_ADMIN_ENABLED === 'true';
  if (adminCount > 0) {
    return 'skip';
  }
  if (!enabled) {
    return 'warn_no_admin';
  }
  const email = String(env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    return 'warn_misconfigured';
  }
  return 'insert';
}

function readBootstrapEnv(env = process.env) {
  return {
    enabled: env.BOOTSTRAP_ADMIN_ENABLED === 'true',
    email: String(env.BOOTSTRAP_ADMIN_EMAIL || '').trim(),
    password: env.BOOTSTRAP_ADMIN_PASSWORD,
    firstName: String(env.BOOTSTRAP_ADMIN_FIRST_NAME || DEFAULT_FIRST_NAME).trim() || DEFAULT_FIRST_NAME,
    lastName: String(env.BOOTSTRAP_ADMIN_LAST_NAME || DEFAULT_LAST_NAME).trim() || DEFAULT_LAST_NAME,
    phone: String(env.BOOTSTRAP_ADMIN_PHONE || '').trim(),
  };
}

async function ensureBootstrapAdmin() {
  const adminCount = await User.countByRole(ROLES.ADMIN);
  const action = resolveBootstrapAction(process.env, adminCount);

  if (action === 'skip') {
    return;
  }
  if (action === 'warn_no_admin') {
    console.warn(
      '[bootstrap-admin] No active admin users in database. Set BOOTSTRAP_ADMIN_ENABLED=true and BOOTSTRAP_ADMIN_EMAIL/PASSWORD to auto-create one on startup.'
    );
    return;
  }
  if (action === 'warn_misconfigured') {
    console.warn(
      '[bootstrap-admin] BOOTSTRAP_ADMIN_ENABLED is true but BOOTSTRAP_ADMIN_EMAIL and/or BOOTSTRAP_ADMIN_PASSWORD are missing.'
    );
    return;
  }

  const cfg = readBootstrapEnv();
  let email;
  let password;
  let normalizedPhone = null;
  try {
    email = validateEmail(cfg.email);
    password = validatePassword(String(cfg.password));
    if (cfg.phone) {
      normalizedPhone = validatePhone(cfg.phone);
    }
  } catch (err) {
    console.warn(`[bootstrap-admin] Invalid bootstrap credentials: ${err.message}`);
    return;
  }

  const existing = await User.findByEmail(email);
  if (existing) {
    console.warn(
      `[bootstrap-admin] Admin bootstrap skipped: ${email} already exists but no active admin role count was detected.`
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  try {
    await User.create({
      email,
      phone_number: normalizedPhone,
      first_name: cfg.firstName,
      last_name: cfg.lastName,
      password: passwordHash,
      role: ROLES.ADMIN,
      phone_verified: true,
      department_id: null,
    });
    console.info(`[bootstrap-admin] Created bootstrap admin user: ${email}`);
  } catch (err) {
    if (err.code === '23505') {
      console.info('[bootstrap-admin] Bootstrap admin already created (concurrent startup).');
      return;
    }
    throw err;
  }
}

module.exports = {
  ensureBootstrapAdmin,
  resolveBootstrapAction,
  readBootstrapEnv,
};
