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

describe('WebSocket volunteer acceptor delivery', () => {
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
    pool.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('accepted_by_user_id FROM incident_reports')) {
        return { rows: [{ user_id: 1, accepted_by_user_id: 9 }] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT role FROM users')) {
        return { rows: [{ role: 'volunteer' }] };
      }
      if (typeof sql === 'string' && sql.includes('supported_incident_types')) {
        return { rows: [{ supported_incident_types: ['fire'] }] };
      }
      if (typeof sql === 'string' && sql.includes('FROM dispatches dp')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
  });

  function connectAs(userId, role, departmentId = null) {
    const token = jwt.sign({ user_id: userId, role }, JWT_SECRET, { expiresIn: '1h' });
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

  it('delivers incident:dispatched to volunteer acceptor outside assigned department', async () => {
    const ws = await connectAs(9, 'volunteer');
    await new Promise((r) => setTimeout(r, 50));

    await wss.broadcast('incident:dispatched', {
      report_id: 42,
      reporter_id: 1,
      accepted_by_user_id: 9,
      status: 'in_progress',
    });

    const msg = await waitForMessage(ws);
    expect(msg.event).toBe('incident:dispatched');
    expect(msg.data.report_id).toBe(42);
    ws.close();
  });

  it('does not deliver incident:dispatched to unrelated volunteer', async () => {
    const ws = await connectAs(99, 'volunteer');
    await new Promise((r) => setTimeout(r, 50));

    await wss.broadcast('incident:dispatched', {
      report_id: 42,
      reporter_id: 1,
      accepted_by_user_id: 9,
      status: 'in_progress',
    });

    await expect(waitForMessage(ws, 800)).rejects.toThrow('timeout');
    ws.close();
  });
});
