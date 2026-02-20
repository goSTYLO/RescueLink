-- Migration: Change latitude/longitude from DOUBLE PRECISION to TEXT
-- Purpose: Support encrypted coordinate storage (encrypted as hex strings, decrypted as numbers)
-- Date: 2026-02-19
-- Reason: Transparent encryption at REST requires storing coordinates as hex strings in database

-- This migration is idempotent and safe to run multiple times
BEGIN;

-- Add temporary columns to hold data during migration
ALTER TABLE IF EXISTS incident_reports ADD COLUMN IF NOT EXISTS latitude_temp TEXT;
ALTER TABLE IF EXISTS incident_reports ADD COLUMN IF NOT EXISTS longitude_temp TEXT;

-- Copy existing data (if any) to temp columns as TEXT
UPDATE incident_reports 
SET latitude_temp = latitude::TEXT 
WHERE latitude IS NOT NULL AND latitude_temp IS NULL;

UPDATE incident_reports 
SET longitude_temp = longitude::TEXT 
WHERE longitude IS NOT NULL AND longitude_temp IS NULL;

-- Drop old numeric columns and recreate as TEXT
ALTER TABLE incident_reports DROP COLUMN IF EXISTS latitude CASCADE;
ALTER TABLE incident_reports DROP COLUMN IF EXISTS longitude CASCADE;

-- Rename temp columns to original names
ALTER TABLE incident_reports RENAME COLUMN latitude_temp TO latitude;
ALTER TABLE incident_reports RENAME COLUMN longitude_temp TO longitude;

-- Add constraints back
ALTER TABLE incident_reports 
ALTER COLUMN latitude SET NOT NULL,
ALTER COLUMN longitude SET NOT NULL;

-- Recreate index for queries (TEXT columns are still indexable)
DROP INDEX IF EXISTS idx_incident_reports_location;
CREATE INDEX idx_incident_reports_location ON incident_reports(latitude, longitude);

COMMIT;
