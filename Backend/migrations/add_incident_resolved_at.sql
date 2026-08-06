-- Add resolved_at column to incident_reports to track when incident was marked as resolved/done
ALTER TABLE incident_reports 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP NULL;

-- Index for filtering by resolution time
CREATE INDEX IF NOT EXISTS idx_incident_reports_resolved_at 
ON incident_reports(resolved_at);
