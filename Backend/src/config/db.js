const { Pool } = require('pg');
require('dotenv').config();

// Limit connections to avoid "too many clients" (pg default is 10 per pool)
const poolMax = parseInt(process.env.PG_POOL_MAX, 10) || 2;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
