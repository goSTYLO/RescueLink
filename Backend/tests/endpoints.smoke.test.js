const request = require('supertest');

jest.mock('../src/services/retryAiClassification', () => ({
  startRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/retryFileScan', () => ({
  startFileScanRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/duplicateBackgroundAnalyzer', () => ({
  startDuplicateAnalyzer: () => null,
}));

const app = require('../src/app');

afterAll(() => {
  try {
    if (app?.locals?.retryTask?.stop) app.locals.retryTask.stop();
    if (app?.locals?.scanRetryTask?.stop) app.locals.scanRetryTask.stop();
  } catch (_) {
    // noop
  }
});

function issueRequest(method, path, body = undefined) {
  const runner = request(app)[method](path).set('Accept', 'application/json');
  if (body !== undefined) {
    return runner.send(body);
  }
  return runner;
}

const endpoints = [
  // Health
  { method: 'get', path: '/health' },

  // Auth (public)
  { method: 'post', path: '/api/auth/register', body: {} },
  { method: 'post', path: '/api/auth/login', body: {} },
  { method: 'post', path: '/api/auth/dispatcher/login', body: {} },
  { method: 'post', path: '/api/auth/dispatcher/verify-otp', body: {} },
  { method: 'post', path: '/api/auth/dispatcher/signup', body: {} },
  { method: 'post', path: '/api/auth/onboard-phone', body: {} },
  { method: 'post', path: '/api/auth/reset-password', body: {} },
  { method: 'post', path: '/api/auth/forgot-password', body: {} },
  { method: 'post', path: '/api/auth/reset-password-with-token', body: {} },

  // Auth (protected)
  { method: 'get', path: '/api/auth/me' },
  { method: 'post', path: '/api/auth/change-password', body: {} },
  { method: 'post', path: '/api/auth/logout', body: {} },

  // Incidents
  { method: 'post', path: '/api/incidents/emergency', body: {} },
  { method: 'post', path: '/api/incidents/with-audio', body: {} },
  { method: 'get', path: '/api/incidents/1/audio' },
  { method: 'get', path: '/api/incidents/1/media/0' },
  { method: 'get', path: '/api/incidents/1/with-ai' },
  { method: 'post', path: '/api/incidents/1/verify', body: {} },
  { method: 'patch', path: '/api/incidents/1/status', body: {} },
  { method: 'post', path: '/api/incidents/1/confirm-resolution', body: {} },
  { method: 'post', path: '/api/incidents/1/reclassify', body: {} },
  { method: 'get', path: '/api/incidents/user/my' },
  { method: 'get', path: '/api/incidents' },
  { method: 'get', path: '/api/incidents/1' },
  { method: 'get', path: '/api/incidents/1/duplicates' },
  { method: 'get', path: '/api/incidents/1/potential-duplicates' },
  { method: 'post', path: '/api/incidents/1/link-duplicate', body: { parent_report_id: 100 } },
  { method: 'post', path: '/api/incidents/1/unlink-duplicate', body: {} },

  // Dispatches
  { method: 'post', path: '/api/dispatches', body: {} },
  { method: 'get', path: '/api/dispatches' },
  { method: 'get', path: '/api/dispatches/1' },
  { method: 'put', path: '/api/dispatches/1', body: {} },
  { method: 'delete', path: '/api/dispatches/1' },

  // Responders + Teams
  { method: 'get', path: '/api/responders/teams' },
  { method: 'post', path: '/api/responders/teams', body: {} },
  { method: 'get', path: '/api/responders/teams/1' },
  { method: 'put', path: '/api/responders/teams/1', body: {} },
  { method: 'patch', path: '/api/responders/teams/1/status', body: {} },
  { method: 'delete', path: '/api/responders/teams/1' },
  { method: 'get', path: '/api/responders/teams/1/members' },
  { method: 'post', path: '/api/responders/teams/1/members', body: {} },
  { method: 'delete', path: '/api/responders/teams/1/members/1' },
  { method: 'get', path: '/api/responders' },
  { method: 'post', path: '/api/responders', body: {} },
  { method: 'get', path: '/api/responders/1' },
  { method: 'put', path: '/api/responders/1', body: {} },
  { method: 'patch', path: '/api/responders/1/status', body: {} },
  { method: 'delete', path: '/api/responders/1' },

  // Notifications
  { method: 'post', path: '/api/notifications', body: {} },
  { method: 'get', path: '/api/notifications' },
  { method: 'get', path: '/api/notifications/1' },
  { method: 'put', path: '/api/notifications/1', body: {} },
  { method: 'delete', path: '/api/notifications/1' },

  // Location
  { method: 'post', path: '/api/location/check', body: {} },
  { method: 'post', path: '/api/location/closest-units', body: {} },
  { method: 'post', path: '/api/location/geofence-alerts', body: {} },
  { method: 'get', path: '/api/location/heatmap' },

  // Audit
  { method: 'get', path: '/api/audit-logs' },

  // Admin
  { method: 'get', path: '/api/admin/users' },
  { method: 'get', path: '/api/admin/users/1' },
  { method: 'post', path: '/api/admin/users', body: {} },
  { method: 'put', path: '/api/admin/users/1/role', body: {} },
  { method: 'put', path: '/api/admin/users/1/deactivate', body: {} },
  { method: 'delete', path: '/api/admin/users/1' },
  { method: 'get', path: '/api/admin/stats' },

  // Departments
  { method: 'get', path: '/api/departments' },
  { method: 'get', path: '/api/departments/1' },
  { method: 'post', path: '/api/departments', body: {} },
  { method: 'put', path: '/api/departments/1', body: {} },
  { method: 'delete', path: '/api/departments/1' },
  { method: 'get', path: '/api/departments/1/metrics' },
  { method: 'get', path: '/api/departments/1/units' },
  { method: 'post', path: '/api/departments/1/units', body: {} },
  { method: 'put', path: '/api/departments/1/units/1', body: {} },
  { method: 'delete', path: '/api/departments/1/units/1' },
  { method: 'get', path: '/api/departments/1/personnel' },
  { method: 'post', path: '/api/departments/1/personnel', body: {} },
  { method: 'put', path: '/api/departments/1/personnel/1', body: {} },
  { method: 'delete', path: '/api/departments/1/personnel/1' },
];

describe('Endpoint Smoke Coverage', () => {
  test.each(endpoints)('$method $path is reachable (not 404/405)', async ({ method, path, body }) => {
    const response = await issueRequest(method, path, body);
    expect([404, 405]).not.toContain(response.status);
  });
});
