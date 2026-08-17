-- Multi-label AI incident types (ranked by confidence; primary remains incident_type)
ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS incident_types TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_incident_reports_incident_types
  ON incident_reports USING GIN (incident_types);
