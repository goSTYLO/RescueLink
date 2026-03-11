const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const WS_PATH = process.env.WS_PATH || '/ws';

let wss = null;
const clients = new Set();

/**
 * Verify JWT token from query parameter
 * @param {string} token - JWT token
 * @returns {Object|null} - Decoded token or null if invalid
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Attach WebSocket server to HTTP server
 * @param {http.Server} httpServer - HTTP server instance
 */
function attachToServer(httpServer) {
  wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws, req, user) => {
    const clientInfo = {
      ws,
      userId: user.userId,
      role: user.role,
      departmentId: user.departmentId,
      connectedAt: new Date(),
    };
    clients.add(clientInfo);

    console.log(`[WS] Client connected: userId=${user.userId}, role=${user.role}, total clients=${clients.size}`);

    // Send initial connection success message
    ws.send(JSON.stringify({
      type: 'connection:established',
      payload: { connected: true, timestamp: new Date().toISOString() }
    }));

    // Handle client disconnect
    ws.on('close', (code, reason) => {
      clients.delete(clientInfo);
      console.log(`[WS] Client disconnected: userId=${user.userId}, code=${code}, remaining clients=${clients.size}`);
    });

    // Handle errors
    ws.on('error', (err) => {
      console.error(`[WS] Client error for userId=${user.userId}:`, err.message);
      clients.delete(clientInfo);
    });

    // Handle incoming messages (for future bidirectional features)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`[WS] Received message from userId=${user.userId}:`, message.type);
      } catch (err) {
        console.error('[WS] Failed to parse message:', err.message);
      }
    });
  });

  // Handle HTTP upgrade for WebSocket connections
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;

    if (pathname !== WS_PATH) {
      socket.destroy();
      return;
    }

    const query = url.parse(request.url, true).query;
    const token = query.token;
    const user = verifyToken(token);

    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      console.log('[WS] Connection rejected: invalid or missing token');
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, user);
    });
  });

  console.log(`[WS] WebSocket server attached to HTTP server on path ${WS_PATH}`);
}

/**
 * Broadcast message to all connected clients
 * @param {string} type - Event type (e.g., 'incident:created', 'incident:updated')
 * @param {Object} payload - Event payload
 */
function broadcast(type, payload) {
  if (!wss) {
    console.error('[WS] Cannot broadcast: WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({ type, payload });
  let sentCount = 0;

  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
      sentCount++;
    }
  }

  console.log(`[WS] Broadcast: type=${type}, clients=${sentCount}, payload=${JSON.stringify(payload).slice(0, 100)}`);
}

/**
 * Get current connection statistics
 * @returns {Object} - Connection stats
 */
function getStats() {
  return {
    totalClients: clients.size,
    openConnections: Array.from(clients).filter(c => c.ws.readyState === WebSocket.OPEN).length,
  };
}

module.exports = {
  attachToServer,
  broadcast,
  getStats,
};
