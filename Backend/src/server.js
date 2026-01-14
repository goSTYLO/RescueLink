require('dotenv').config();
const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 3000;

(async function start() {
  try {
    // quick DB sanity check
    await pool.query('SELECT 1');
    app.listen(PORT, () => {
      const url = `http://localhost:${PORT}`;
      console.log(`Server listening on port ${PORT}`);
      console.log(`Backend URL: ${url}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
