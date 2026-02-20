-- Migration: Change dispatcher_audit_logs.details from JSONB to TEXT
-- Purpose: Support encrypted data storage (encrypted JSON stored as hex string)
-- Date: 2026-02-19

BEGIN;

-- Change details column from JSONB to TEXT for encrypted storage
ALTER TABLE dispatcher_audit_logs 
ALTER COLUMN details TYPE TEXT 
USING CASE 
  WHEN details IS NULL THEN NULL
  ELSE details::TEXT 
END;

-- Add comment explaining the column stores encrypted data
COMMENT ON COLUMN dispatcher_audit_logs.details IS 'Encrypted JSON string (AES-256-GCM). Decrypted and parsed at application layer.';

-- Verify the change
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'dispatcher_audit_logs' 
      AND column_name = 'details' 
      AND data_type = 'text'
  ) THEN
    RAISE NOTICE '✅ Migration successful: details column changed to TEXT';
  ELSE
    RAISE EXCEPTION '❌ Migration failed: details column is not TEXT';
  END IF;
END $$;

COMMIT;
