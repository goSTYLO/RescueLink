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
  'add_rbac_system.sql',
  'add_department_management.sql',
  'add_department_location_and_dispatch_eta.sql',
  'add_team_member_assignment_schema.sql',
  'add_unit_assigned_report.sql',
  'add_incident_unit_usage.sql',
  'add_dispatcher_audit_logs.sql',
  'add_token_blacklist.sql',
  'add_dispatcher_login_otp.sql',
  'add_incident_barangay.sql',
  'add_incident_verified.sql',
  'add_ai_fields.sql',
  'add_upload_scan_fields.sql',
  'add_incident_coordination_notes.sql',
  'add_incident_resolved_at.sql',
  'add_duplicate_detection.sql',
  'add_flagged_for_review.sql',
  'add_notifications_is_read.sql',
  'add_notification_event_type.sql',
  'add_responder_applications.sql',
  'add_phase3_responder_acceptance.sql',
  'add_backup_request_status.sql',
  'add_backup_responses.sql',
  'add_responder_specialization.sql',
  'add_responder_revoked_status.sql',
  'add_responder_task_and_team_status.sql',
  'add_responder_module_placeholders.sql',
  'add_incident_types_array.sql',
  'add_ai_confidence_metadata.sql',
  'add_dispatch_assignment_v2_and_secondary_ai.sql',
  'add_incident_closed_status_fields.sql',
  'add_incident_resolution_confirmation_fields.sql',
  'add_user_location_columns.sql',
  'add_incident_archival.sql',
  'add_incident_escalations.sql',
  'add_notification_preferences.sql',
  'add_auto_team_assignment.sql',
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
