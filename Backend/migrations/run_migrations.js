#!/usr/bin/env node

/**
 * Run database migrations for RescueLink Backend
 * Usage: node migrations/run_migrations.js
 * Or: npm run migrate
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const MIGRATIONS_DIR = path.join(__dirname);
const MIGRATION_ORDER = [
  'add_duplicate_detection.sql',
  'add_flagged_for_review.sql',
  'add_notifications_is_read.sql',
  'add_notification_event_type.sql',
  'add_responder_applications.sql',
];

async function runMigrations() {
  console.log('Running database migrations...');

  for (const filename of MIGRATION_ORDER) {
    const migrationFile = path.join(MIGRATIONS_DIR, filename);
    if (!fs.existsSync(migrationFile)) {
      console.warn(`   ⚠ Migration file not found: ${filename}`);
      continue;
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    try {
      await pool.query(sql);
      console.log(`   ✓ ${filename}`);
    } catch (err) {
      console.error(`   ✗ ${filename} failed:`, err.message);
      throw err;
    }
  }

  console.log('Migration completed successfully');
}

runMigrations()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
