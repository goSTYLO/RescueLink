-- ============================================
-- RescueLink Duplicate Detection - Database Migration
-- Created: 2026-03-14
-- Description: Adds duplicate detection fields to incident_reports and duplicate_clusters table
-- ============================================

-- Add columns to incident_reports
ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS parent_report_id INTEGER REFERENCES incident_reports(report_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_confidence_score DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duplicate_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duplicate_detection_method VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;

-- Create indexes for faster duplicate lookups
CREATE INDEX IF NOT EXISTS idx_incident_reports_parent_id ON incident_reports(parent_report_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_is_duplicate ON incident_reports(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_incident_reports_duplicate_detected ON incident_reports(duplicate_detected_at);

-- Create duplicate_clusters table
CREATE TABLE IF NOT EXISTS duplicate_clusters (
    cluster_id SERIAL PRIMARY KEY,
    primary_report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cluster_size INTEGER DEFAULT 1,
    confidence_score DOUBLE PRECISION DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_duplicate_clusters_primary ON duplicate_clusters(primary_report_id);

-- Add trigger to update updated_at on duplicate_clusters
CREATE OR REPLACE FUNCTION update_duplicate_clusters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_duplicate_clusters_updated_at ON duplicate_clusters;
CREATE TRIGGER trigger_duplicate_clusters_updated_at
    BEFORE UPDATE ON duplicate_clusters
    FOR EACH ROW
    EXECUTE PROCEDURE update_duplicate_clusters_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN incident_reports.is_duplicate IS 'Flag indicating if this report is a duplicate of another';
COMMENT ON COLUMN incident_reports.parent_report_id IS 'Reference to the original report if this is a duplicate';
COMMENT ON COLUMN incident_reports.duplicate_confidence_score IS 'Confidence score (0-1) for duplicate detection';
COMMENT ON COLUMN incident_reports.duplicate_detection_method IS 'How duplicate was detected: geospatial_time, manual, background_analysis';
COMMENT ON TABLE duplicate_clusters IS 'Groups of duplicate incident reports for dispatcher view';

-- Display migration completion message
DO $$
BEGIN
  RAISE NOTICE 'Duplicate detection migration completed successfully!';
  RAISE NOTICE '   - Added 5 columns to incident_reports';
  RAISE NOTICE '   - Created duplicate_clusters table';
  RAISE NOTICE '   - Created 4 performance indexes';
END $$;
