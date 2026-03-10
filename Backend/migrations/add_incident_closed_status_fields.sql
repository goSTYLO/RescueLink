ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP NULL;

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS closed_by_user_id INTEGER NULL REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS closure_method VARCHAR(80) NULL;

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS closure_notes TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_incident_reports_closed_at
  ON incident_reports(closed_at);

CREATE INDEX IF NOT EXISTS idx_incident_reports_closed_by_user_id
  ON incident_reports(closed_by_user_id);
