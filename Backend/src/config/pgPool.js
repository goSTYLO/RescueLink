require('dotenv').config();
const fs = require('fs');
const path = require('path');

function useDatabaseSsl() {
  return process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true';
}

/** Supabase pooler/RDS: use DATABASE_SSL_CA_PATH from dashboard for verify-full; else encrypt only. */
function getSslConfig() {
  if (!useDatabaseSsl()) return undefined;

  const caPath = process.env.DATABASE_SSL_CA_PATH;
  if (caPath) {
    const resolved = path.isAbsolute(caPath) ? caPath : path.join(process.cwd(), caPath);
    if (fs.existsSync(resolved)) {
      return { ca: fs.readFileSync(resolved, 'utf8'), rejectUnauthorized: true };
    }
  }

  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true') {
    return { rejectUnauthorized: true };
  }

  // Same as sslmode=require: TLS without full chain verify (Supabase docs for serverless).
  return { rejectUnauthorized: false };
}

/** Shared pg Pool options for app, setup-db, and seed scripts */
function getPgPoolConfig(overrides = {}) {
  const poolMax = parseInt(process.env.PG_POOL_MAX, 10) || 2;
  const ssl = getSslConfig();
  return {
    connectionString: process.env.DATABASE_URL,
    max: poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ...(ssl && { ssl }),
    ...overrides,
  };
}

/** Log-safe database target (no credentials) */
function formatDatabaseTarget(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) return '(DATABASE_URL not set)';
  try {
    const normalized = connectionString.replace(/^postgresql:/i, 'postgres:');
    const u = new URL(normalized);
    const db = u.pathname.replace(/^\//, '') || 'postgres';
    const port = u.port || '5432';
    return `${u.hostname}:${port}/${db}`;
  } catch {
    return '(DATABASE_URL set)';
  }
}

module.exports = { getPgPoolConfig, formatDatabaseTarget, useDatabaseSsl };
