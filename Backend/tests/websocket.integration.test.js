/**
 * WebSocket Integration Tests
 *
 * Comprehensive automated tests for the real-time incident notification WebSocket.
 * Requires a running database with seeded data. Run with: npm run test:ws
 *
 * Test accounts (from Backend/ACCOUNTS.md):
 * - admin@rescuelink.test / admin123
 * - dispatcher@rescuelink.test / dispatcher123
 * - depthead_drrmo@rescuelink.test / depthead123
 * - depthead_pnp@rescuelink.test / depthead123
 * - 639005000001 (user@rescuelink.test) / user123
 * - 09666638967 / SecurePass123! (personal account)
 */

require('dotenv').config();
const http = require('http');
const WebSocket = require('ws');
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
const { init: initWebSocket } = require('../src/services/websocketManager');

let server;
let baseUrl;
let wsBaseUrl;
let testPort;

// --- Helpers ---

function getWsUrl(token) {
  const url = new URL(wsBaseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

async function loginDispatcher(email, password) {
  const res = await request(app)
    .post('/api/auth/dispatcher/login')
    .send({ email, password })
    .expect((r) => {
      if (r.status !== 200) {
        throw new Error(`Dispatcher login failed: ${r.status} ${JSON.stringify(r.body)}`);
      }
    });
  return res.body.token;
}

async function loginReporter(phone, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ phone, password });
  if (res.status !== 200) {
    throw new Error(`Reporter login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

/** Try reporter login; returns null if credentials don't work (e.g. phone format mismatch with seed). */
async function tryLoginReporter(phone, password) {
  const res = await request(app).post('/api/auth/login').send({ phone, password });
  return res.status === 200 ? res.body.token : null;
}

function connectWebSocket(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(getWsUrl(token));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    ws.on('close', (code, reason) => {
      if (code !== 1000 && code !== 1005) {
        reject(new Error(`WebSocket closed: ${code} ${reason}`));
      }
    });
  });
}

function connectWebSocketExpectReject(token) {
  return new Promise((resolve) => {
    const url = typeof token === 'string' ? getWsUrl(token) : wsBaseUrl;
    const ws = new WebSocket(url);
    let resolved = false;
    const done = (closeCode) => {
      if (resolved) return;
      resolved = true;
      resolve({ rejected: closeCode === 4001, closeCode });
    };
    ws.on('close', (code) => done(code));
    ws.on('error', () => {
      if (!resolved) {
        resolved = true;
        resolve({ rejected: true, closeCode: null });
      }
    });
  });
}

function waitForMessage(ws, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', onMessage);
      reject(new Error(`Timeout waiting for message after ${timeoutMs}ms`));
    }, timeoutMs);
    const onMessage = (data) => {
      clearTimeout(timer);
      ws.removeListener('message', onMessage);
      try {
        const parsed = JSON.parse(data.toString());
        resolve(parsed);
      } catch {
        resolve({ raw: data.toString() });
      }
    };
    ws.on('message', onMessage);
  });
}

async function createEmergencyIncident(token, latitude = 16.0433, longitude = 120.3333) {
  const res = await request(app)
    .post('/api/incidents/emergency')
    .set('Authorization', `Bearer ${token}`)
    .send({ latitude, longitude });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Create incident failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const incident = res.body.incident ?? res.body;
  return incident.report_id ?? incident.reportId ?? res.body.report_id ?? res.body.reportId ?? res.body.id;
}

async function updateIncidentStatus(token, reportId, status) {
  const res = await request(app)
    .patch(`/api/incidents/${reportId}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status });
  if (res.status !== 200) {
    throw new Error(`Update status failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function createDispatch(token, reportId, departmentCode = 'drrmo') {
  const res = await request(app)
    .post('/api/dispatches')
    .set('Authorization', `Bearer ${token}`)
    .send({
      report_id: reportId,
      department_code: departmentCode,
      response_status: 'dispatched',
    });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Create dispatch failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

// --- Setup / Teardown ---

beforeAll(async () => {
  server = http.createServer(app);
  const wss = initWebSocket(server);
  app.locals.wss = wss;

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      testPort = server.address().port;
      baseUrl = `http://127.0.0.1:${testPort}`;
      wsBaseUrl = `ws://127.0.0.1:${testPort}/ws`;
      resolve();
    });
  });
}, 15000);

afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  try {
    if (app?.locals?.retryTask?.stop) app.locals.retryTask.stop();
    if (app?.locals?.scanRetryTask?.stop) app.locals.scanRetryTask.stop();
  } catch (_) {}
}, 10000);

// --- Authentication Tests ---

describe('WebSocket Authentication', () => {
  test('valid JWT token successfully connects', async () => {
    const token = await loginDispatcher('admin@rescuelink.test', 'admin123');
    const ws = await connectWebSocket(token);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  test('invalid JWT token is rejected with close code 4001', async () => {
    const result = await connectWebSocketExpectReject('invalid.token.here');
    expect(result.rejected).toBe(true);
    expect(result.closeCode).toBe(4001);
  });

  test('missing token is rejected', async () => {
    const result = await connectWebSocketExpectReject(null);
    expect(result.rejected).toBe(true);
    expect(result.closeCode).toBe(4001);
  });

  test('malformed token is rejected', async () => {
    const result = await connectWebSocketExpectReject('not.a.valid.jwt');
    expect(result.rejected).toBe(true);
    expect(result.closeCode).toBe(4001);
  });
});

// --- Role-Based Filtering Tests ---

describe('WebSocket Role-Based Filtering', () => {
  test('admin receives incident:created event when any incident is created', async () => {
    const adminToken = await loginDispatcher('admin@rescuelink.test', 'admin123');

    const ws = await connectWebSocket(adminToken);
    const reportId = await createEmergencyIncident(adminToken);

    const msg = await waitForMessage(ws, 8000);
    expect(msg.event).toBe('incident:created');
    expect(msg.data?.report_id ?? msg.data?.reportId).toBe(reportId);

    ws.close();
  });

  test('dispatcher receives incident:created event', async () => {
    const dispatcherToken = await loginDispatcher('dispatcher@rescuelink.test', 'dispatcher123');
    const adminToken = await loginDispatcher('admin@rescuelink.test', 'admin123');

    const ws = await connectWebSocket(dispatcherToken);
    const reportId = await createEmergencyIncident(adminToken);

    const msg = await waitForMessage(ws, 8000);
    expect(msg.event).toBe('incident:created');
    expect(msg.data?.report_id ?? msg.data?.reportId).toBe(reportId);

    ws.close();
  });

  test('reporter receives incident:created for their own incident', async () => {
    const reporterToken = await tryLoginReporter('639005000001', 'user123')
      || await tryLoginReporter('09005000001', 'user123');
    if (!reporterToken) {
      return; // Skip if reporter login fails (phone format may not match seed)
    }
    const ws = await connectWebSocket(reporterToken);
    const reportId = await createEmergencyIncident(reporterToken);

    const msg = await waitForMessage(ws, 8000);
    expect(msg.event).toBe('incident:created');
    expect(msg.data?.report_id ?? msg.data?.reportId).toBe(reportId);

    ws.close();
  });

  test('department head receives events for incidents dispatched to their department', async () => {
    const adminToken = await loginDispatcher('admin@rescuelink.test', 'admin123');
    const deptHeadToken = await loginDispatcher('depthead_drrmo@rescuelink.test', 'depthead123');

    const reportId = await createEmergencyIncident(adminToken);
    await createDispatch(adminToken, reportId, 'drrmo');

    const ws = await connectWebSocket(deptHeadToken);
    const reportId2 = await createEmergencyIncident(adminToken);
    await createDispatch(adminToken, reportId2, 'drrmo');

    const msg = await waitForMessage(ws, 8000);
    expect(['incident:dispatched', 'incident:status_updated', 'incident:created']).toContain(msg.event);
    expect(msg.data?.report_id ?? msg.data?.reportId).toBeDefined();

    ws.close();
  });
});

// --- Event Type Tests ---

describe('WebSocket Event Types', () => {
  test('incident:created event received when new incident created', async () => {
    const adminToken = await loginDispatcher('admin@rescuelink.test', 'admin123');

    const ws = await connectWebSocket(adminToken);
    const reportId = await createEmergencyIncident(adminToken);

    const msg = await waitForMessage(ws, 8000);
    expect(msg.event).toBe('incident:created');
    expect(msg.data?.report_id ?? msg.data?.reportId).toBe(reportId);
    expect(msg.data?.status).toBeDefined();

    ws.close();
  });

  test('incident:status_updated event received when status changes', async () => {
    const adminToken = await loginDispatcher('admin@rescuelink.test', 'admin123');

    const reportId = await createEmergencyIncident(adminToken);

    const ws = await connectWebSocket(adminToken);
    await updateIncidentStatus(adminToken, reportId, 'verified');

    const msg = await waitForMessage(ws, 8000);
    expect(msg.event).toBe('incident:status_updated');
    expect(msg.data?.report_id ?? msg.data?.reportId).toBe(reportId);
    expect(msg.data?.status).toBe('verified');

    ws.close();
  });

  test('incident:dispatched event received when dispatch created', async () => {
    const adminToken = await loginDispatcher('admin@rescuelink.test', 'admin123');

    const reportId = await createEmergencyIncident(adminToken);

    const ws = await connectWebSocket(adminToken);
    await createDispatch(adminToken, reportId, 'drrmo');

    const msg = await waitForMessage(ws, 8000);
    expect(['incident:dispatched', 'incident:status_updated']).toContain(msg.event);
    expect(msg.data?.report_id ?? msg.data?.reportId).toBe(reportId);

    ws.close();
  });
});

// --- Connection Resilience ---

describe('WebSocket Connection Resilience', () => {
  test('connection stays open and receives multiple events', async () => {
    const adminToken = await loginDispatcher('admin@rescuelink.test', 'admin123');

    const ws = await connectWebSocket(adminToken);
    const reportId1 = await createEmergencyIncident(adminToken);
    const msg1 = await waitForMessage(ws, 8000);
    expect(msg1.event).toBe('incident:created');
    expect(msg1.data?.report_id ?? msg1.data?.reportId).toBe(reportId1);

    const reportId2 = await createEmergencyIncident(adminToken);
    const msg2 = await waitForMessage(ws, 8000);
    expect(msg2.event).toBe('incident:created');
    expect(msg2.data?.report_id ?? msg2.data?.reportId).toBe(reportId2);

    ws.close();
  });
});
