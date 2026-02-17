#!/usr/bin/env node
/**
 * Optional backup script: run pg_dump using DATABASE_URL.
 * Requires pg_dump on PATH. Schedule via cron or your platform's job runner.
 * Usage: npm run backup-db (from Backend directory) or node scripts/backup-db.js
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Set it in .env or the environment.');
  process.exit(1);
}

const backupsDir = path.join(__dirname, '..', 'backups');
fs.mkdirSync(backupsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const filename = `backup-${timestamp}.sql`;
const outPath = path.join(backupsDir, filename);

const result = spawnSync('pg_dump', [DATABASE_URL, '-f', outPath], {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

if (result.status !== 0) {
  console.error('pg_dump failed. Ensure pg_dump is on PATH and DATABASE_URL is correct.');
  process.exit(result.status || 1);
}

console.log('Backup written to', outPath);
