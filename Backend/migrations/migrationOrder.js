/** Single ordered migration list for setup-db and npm run migrate */
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
  'add_volunteer_role.sql',
  'add_user_profile_image.sql',
  'add_analytics_created_at_index.sql',
];

module.exports = { MIGRATION_ORDER };

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const dir = __dirname;
  for (const filename of MIGRATION_ORDER) {
    const file = path.join(dir, filename);
    if (!fs.existsSync(file)) {
      console.error('Missing migration file:', filename);
      process.exit(1);
    }
  }
  console.log(`migrationOrder OK (${MIGRATION_ORDER.length} files)`);
}
