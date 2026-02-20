-- Add barangay column to incident_reports (resolved from incident location via dagupan_barangays.geojson)
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS barangay VARCHAR(150);

-- Optional: index for filtering by barangay
CREATE INDEX IF NOT EXISTS idx_incident_reports_barangay ON incident_reports(barangay);
