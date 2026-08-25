-- Add archival columns to incident_reports
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS archived_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS archive_notes TEXT;

-- Partial index: fast active-dashboard scans (excludes archived rows entirely)
CREATE INDEX IF NOT EXISTS idx_incident_reports_active
  ON incident_reports (status, created_at DESC)
  WHERE is_archived = FALSE;

-- Index for archived tab queries
CREATE INDEX IF NOT EXISTS idx_incident_reports_archived
  ON incident_reports (archived_at DESC)
  WHERE is_archived = TRUE;

-- Composite for filtered-archive queries (status + archived)
CREATE INDEX IF NOT EXISTS idx_incident_reports_archived_status
  ON incident_reports (status, archived_at DESC)
  WHERE is_archived = TRUE;
