ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS reporter_confirmed_at TIMESTAMP NULL;

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS reporter_confirmed_by_user_id INTEGER NULL REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS resolved_by_user_id INTEGER NULL REFERENCES users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incident_reports_reporter_confirmed_at
  ON incident_reports(reporter_confirmed_at);

CREATE INDEX IF NOT EXISTS idx_incident_reports_resolved_by_user_id
  ON incident_reports(resolved_by_user_id);
