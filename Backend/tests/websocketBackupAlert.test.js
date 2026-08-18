jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/models/tokenBlacklist', () => ({
  isBlacklisted: jest.fn().mockResolvedValue(false),
}));

jest.mock('../src/models/user', () => ({
  findById: jest.fn(),
}));

const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/db');
const { JWT_SECRET } = require('../src/config/jwt');
const { init: initWebSocket } = require('../src/services/websocketManager');

describe('WebSocket responder:backup_alert delivery', () => {
  let server;
  let wss;
  let wsUrl;

  beforeAll((done) => {
    server = http.createServer();
    wss = initWebSocket(server);
    server.listen(0, '127.0.0.1', () => {
      wsUrl = `ws://127.0.0.1:${server.address().port}/ws`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockImplementation(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('SELECT role FROM users')) {
        return { rows: [{ role: 'responder' }] };
      }
      if (typeof sql === 'string' && sql.includes('supported_incident_types')) {
        const userId = params?.[0];
        if (Number(userId) === 20) {
          return { rows: [{ supported_incident_types: ['medical'] }] };
        }
        return { rows: [{ supported_incident_types: ['medical'] }] };
      }
      if (typeof sql === 'string' && sql.includes('accepted_by_user_id FROM incident_reports')) {
        return { rows: [{ user_id: 1, accepted_by_user_id: 9 }] };
      }
      if (typeof sql === 'string' && sql.includes('FROM backup_responses')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('responder_online')) {
        const ids = params?.[0] || [];
        const rows = ids.map((user_id) => ({
          user_id,
          responder_online: true,
          latitude: 16.04,
          longitude: 120.33,
        }));
        return { rows };
      }
      if (typeof sql === 'string' && sql.includes('FROM dispatches dp')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
  });

  function connectAs(userId) {
    const token = jwt.sign({ user_id: userId, role: 'responder' }, JWT_SECRET, { expiresIn: '1h' });
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  function waitForMessage(ws, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      ws.on('message', (raw) => {
        clearTimeout(timer);
        resolve(JSON.parse(raw.toString()));
      });
    });
  }

  function expectNoMessage(ws, timeoutMs = 400) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      ws.on('message', () => {
        clearTimeout(timer);
        reject(new Error('unexpected message'));
      });
    });
  }

  it('delivers backup_alert to eligible nearby volunteer but not primary acceptor', async () => {
    const primaryWs = await connectAs(9);
    const nearbyWs = await connectAs(20);
    await new Promise((r) => setTimeout(r, 80));

    await wss.broadcast('responder:backup_alert', {
      report_id: 42,
      reporter_id: 1,
      user_id: 1,
      accepted_by_user_id: 9,
      backup_request_id: 7,
      incident_type: 'medical',
      latitude: 16.04,
      longitude: 120.33,
      is_backup: true,
      requested_by_name: 'Volunteer One',
    });

    const msg = await waitForMessage(nearbyWs);
    expect(msg.event).toBe('responder:backup_alert');
    expect(msg.data.backup_request_id).toBe(7);
    expect(msg.data.is_backup).toBe(true);

    await expectNoMessage(primaryWs);

    primaryWs.close();
    nearbyWs.close();
  });
});
