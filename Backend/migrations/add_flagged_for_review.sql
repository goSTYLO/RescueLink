-- Add flagged_for_review column to incident_reports
-- Marks incidents that were flagged as possible duplicates/spam during real-time detection
-- but not auto-linked (confidence between flagThreshold and autoLinkThreshold)
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT FALSE;
