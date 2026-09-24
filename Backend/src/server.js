require('dotenv').config();
const http = require('http');
const app = require('./app');
const pool = require('./config/db');
const { init: initWebSocket } = require('./services/websocketManager');

const PORT = process.env.PORT || 3000;

(async function start() {
  try {
    // quick DB sanity check
    await pool.query('SELECT 1');
    const server = http.createServer(app);
    const wss = initWebSocket(server);
    app.locals.wss = wss;

    server.listen(PORT, '0.0.0.0', () => {
      const url = `http://localhost:${PORT}`;
      console.log(`Server listening on port ${PORT}`);
      console.log(`Backend URL: ${url}`);
      console.log(`WebSocket: ws://localhost:${PORT}/ws`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
