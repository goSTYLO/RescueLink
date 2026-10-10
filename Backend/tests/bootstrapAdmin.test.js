const {
  resolveBootstrapAction,
  readBootstrapEnv,
} = require('../src/startup/bootstrapAdmin');

describe('bootstrapAdmin', () => {
  test('resolveBootstrapAction skips when admins exist', () => {
    expect(resolveBootstrapAction({ BOOTSTRAP_ADMIN_ENABLED: 'true' }, 1)).toBe('skip');
  });

  test('resolveBootstrapAction warns when no admins and bootstrap disabled', () => {
    expect(resolveBootstrapAction({}, 0)).toBe('warn_no_admin');
    expect(resolveBootstrapAction({ BOOTSTRAP_ADMIN_ENABLED: 'false' }, 0)).toBe('warn_no_admin');
  });

  test('resolveBootstrapAction warns when enabled but credentials missing', () => {
    expect(resolveBootstrapAction({ BOOTSTRAP_ADMIN_ENABLED: 'true' }, 0)).toBe('warn_misconfigured');
    expect(
      resolveBootstrapAction(
        { BOOTSTRAP_ADMIN_ENABLED: 'true', BOOTSTRAP_ADMIN_EMAIL: 'a@b.test' },
        0
      )
    ).toBe('warn_misconfigured');
  });

  test('resolveBootstrapAction inserts when enabled with email and password', () => {
    expect(
      resolveBootstrapAction(
        {
          BOOTSTRAP_ADMIN_ENABLED: 'true',
          BOOTSTRAP_ADMIN_EMAIL: 'admin@rescuelink.test',
          BOOTSTRAP_ADMIN_PASSWORD: 'Admin123!',
        },
        0
      )
    ).toBe('insert');
  });

  test('readBootstrapEnv applies defaults', () => {
    const cfg = readBootstrapEnv({});
    expect(cfg.firstName).toBe('Ariel');
    expect(cfg.lastName).toBe('Admin');
    expect(cfg.enabled).toBe(false);
  });
});
