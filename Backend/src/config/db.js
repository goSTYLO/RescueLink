const { Pool } = require('pg');
require('dotenv').config();

// Prefer DATABASE_URL for production / Heroku; fall back to individual env vars
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // if you prefer to use separate vars, pg will pick them up automatically (PGHOST, PGUSER, etc.)
});

module.exports = pool;
