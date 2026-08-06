-- ============================================
-- RescueLink Upload Security Fields Migration
-- Created: 2026-02-23
-- Description: Adds malware scan and quarantine fields for incident uploads
-- ============================================

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS scan_status VARCHAR(30) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scan_engine VARCHAR(120),
  ADD COLUMN IF NOT EXISTS scan_error TEXT,
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS quarantined BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_incident_reports_scan_status
  ON incident_reports(scan_status);

CREATE INDEX IF NOT EXISTS idx_incident_reports_quarantined
  ON incident_reports(quarantined)
  WHERE quarantined = TRUE;

COMMENT ON COLUMN incident_reports.scan_status IS 'Upload scan status: pending, clean, unscanned, quarantined, error';
COMMENT ON COLUMN incident_reports.scan_engine IS 'Scanner engine used for latest deep scan (e.g., clamav, stub)';
COMMENT ON COLUMN incident_reports.scan_error IS 'Last scanner error detail for troubleshooting';
COMMENT ON COLUMN incident_reports.scanned_at IS 'Timestamp when latest deep scan completed';
COMMENT ON COLUMN incident_reports.quarantined IS 'TRUE when upload files are quarantined due to scan findings';
COMMENT ON COLUMN incident_reports.quarantine_reason IS 'Reason for quarantine action';

DO $$
BEGIN
  RAISE NOTICE '✅ Upload scan migration completed successfully!';
END $$;
