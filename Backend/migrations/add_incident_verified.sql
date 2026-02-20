-- Add verified column to incident_reports for blockchain-verified incidents
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
