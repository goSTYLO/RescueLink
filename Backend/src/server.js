require('dotenv').config();
const http = require('http');
const app = require('./app');
const pool = require('./config/db');
const { attachToServer } = require('./websocket/server');

const PORT = process.env.PORT || 3000;

(async function start() {
  try {
    // quick DB sanity check
    await pool.query('SELECT 1');

    // Create HTTP server from Express app
    const httpServer = http.createServer(app);

    // Attach WebSocket server to HTTP server
    attachToServer(httpServer);

    // Start listening
    httpServer.listen(PORT, () => {
      const url = `http://localhost:${PORT}`;
      console.log(`Server listening on port ${PORT}`);
      console.log(`Backend URL: ${url}`);
      console.log(`WebSocket URL: ws://localhost:${PORT}/ws`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
