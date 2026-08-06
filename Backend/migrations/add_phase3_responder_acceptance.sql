-- Phase 3: Incident Acceptance Workflow
-- All changes are additive (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) — safe on live DB.

-- 1. Link responders table to users table
ALTER TABLE responders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_responders_user_id ON responders(user_id);

-- 2. Responder online/offline toggle on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_online BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_responder_online ON users(responder_online) WHERE responder_online = TRUE;

-- 3. Incident acceptance fields on incident_reports
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS accepted_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS responder_status VARCHAR(50);
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_incident_reports_accepted_by ON incident_reports(accepted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_responder_status ON incident_reports(responder_status);

-- 4. Responder status history (audit trail for status transitions)
CREATE TABLE IF NOT EXISTS responder_status_history (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
  updated_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_resp_status_hist_report ON responder_status_history(report_id);
CREATE INDEX IF NOT EXISTS idx_resp_status_hist_user ON responder_status_history(updated_by_user_id);

-- 5. Backup requests table
CREATE TABLE IF NOT EXISTS backup_requests (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
  requested_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
  target VARCHAR(50) NOT NULL CHECK (target IN ('nearby_responders', 'cdrrmo', 'both')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_backup_requests_report ON backup_requests(report_id);
CREATE INDEX IF NOT EXISTS idx_backup_requests_requester ON backup_requests(requested_by_user_id);

-- 6. Notification category column (for expanded notification types)
-- Values: 'incident' | 'application' | 'responder_alert' | 'backup_request' | 'system'
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'incident';
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category, user_id);
