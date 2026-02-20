-- Migration: Fix all encrypted fields to TEXT type
-- Date: 2026-02-19
-- Purpose: Encrypted hex strings (200+ chars) don't fit in VARCHAR(20/100/255)
--          All encrypted fields must be TEXT to store AES-256-GCM output

-- ========================================
-- USERS TABLE (5 encrypted fields)
-- ========================================

-- phone_number: VARCHAR(20) → TEXT
ALTER TABLE users 
ALTER COLUMN phone_number TYPE TEXT 
USING CASE 
  WHEN phone_number IS NULL THEN NULL
  ELSE phone_number::TEXT 
END;

COMMENT ON COLUMN users.phone_number IS 'Encrypted with AES-256-GCM, stored as hex string';

-- email: VARCHAR(255) → TEXT  
ALTER TABLE users 
ALTER COLUMN email TYPE TEXT 
USING CASE 
  WHEN email IS NULL THEN NULL
  ELSE email::TEXT 
END;

COMMENT ON COLUMN users.email IS 'Encrypted with AES-256-GCM, stored as hex string';

-- first_name: VARCHAR(100) → TEXT
ALTER TABLE users 
ALTER COLUMN first_name TYPE TEXT 
USING CASE 
  WHEN first_name IS NULL THEN NULL
  ELSE first_name::TEXT 
END;

COMMENT ON COLUMN users.first_name IS 'Encrypted with AES-256-GCM, stored as hex string';

-- last_name: VARCHAR(100) → TEXT
ALTER TABLE users 
ALTER COLUMN last_name TYPE TEXT 
USING CASE 
  WHEN last_name IS NULL THEN NULL
  ELSE last_name::TEXT 
END;

COMMENT ON COLUMN users.last_name IS 'Encrypted with AES-256-GCM, stored as hex string';

-- address: VARCHAR(255) → TEXT
ALTER TABLE users 
ALTER COLUMN address TYPE TEXT 
USING CASE 
  WHEN address IS NULL THEN NULL
  ELSE address::TEXT 
END;

COMMENT ON COLUMN users.address IS 'Encrypted with AES-256-GCM, stored as hex string';

-- ========================================
-- RESPONDERS TABLE (2 encrypted fields)
-- ========================================

-- contact_number: VARCHAR(20) → TEXT
ALTER TABLE responders 
ALTER COLUMN contact_number TYPE TEXT 
USING CASE 
  WHEN contact_number IS NULL THEN NULL
  ELSE contact_number::TEXT 
END;

COMMENT ON COLUMN responders.contact_number IS 'Encrypted with AES-256-GCM, stored as hex string';

-- name: VARCHAR(150) → TEXT
ALTER TABLE responders 
ALTER COLUMN name TYPE TEXT 
USING CASE 
  WHEN name IS NULL THEN NULL
  ELSE name::TEXT 
END;

COMMENT ON COLUMN responders.name IS 'Encrypted with AES-256-GCM, stored as hex string';

-- ========================================
-- INCIDENT_REPORTS TABLE (3 fields)
-- ========================================

-- audio_path: VARCHAR(500) → TEXT
ALTER TABLE incident_reports 
ALTER COLUMN audio_path TYPE TEXT 
USING CASE 
  WHEN audio_path IS NULL THEN NULL
  ELSE audio_path::TEXT 
END;

COMMENT ON COLUMN incident_reports.audio_path IS 'Encrypted with AES-256-GCM, stored as hex string';

-- media_url: VARCHAR(500) → TEXT
ALTER TABLE incident_reports 
ALTER COLUMN media_url TYPE TEXT 
USING CASE 
  WHEN media_url IS NULL THEN NULL
  ELSE media_url::TEXT 
END;

COMMENT ON COLUMN incident_reports.media_url IS 'Encrypted with AES-256-GCM, stored as hex string';

-- media_paths: JSONB → TEXT (needs to store encrypted JSON as hex string)
ALTER TABLE incident_reports 
ALTER COLUMN media_paths TYPE TEXT 
USING CASE 
  WHEN media_paths IS NULL THEN NULL
  ELSE media_paths::TEXT 
END;

COMMENT ON COLUMN incident_reports.media_paths IS 'Encrypted with AES-256-GCM, stored as hex string (JSON stringified before encryption)';

-- ========================================
-- DISPATCHER_AUDIT_LOGS (1 field)
-- ========================================

-- ip_address: VARCHAR(45) → TEXT
ALTER TABLE dispatcher_audit_logs 
ALTER COLUMN ip_address TYPE TEXT 
USING CASE 
  WHEN ip_address IS NULL THEN NULL
  ELSE ip_address::TEXT 
END;

COMMENT ON COLUMN dispatcher_audit_logs.ip_address IS 'Encrypted with AES-256-GCM, stored as hex string';

-- ========================================
-- VERIFICATION
-- ========================================

DO $$
DECLARE
  users_phone_type TEXT;
  users_email_type TEXT;
  users_first_name_type TEXT;
  users_last_name_type TEXT;
  users_address_type TEXT;
  responders_contact_type TEXT;
  responders_name_type TEXT;
  incidents_audio_type TEXT;
  incidents_media_url_type TEXT;
  incidents_media_paths_type TEXT;
  audit_ip_type TEXT;
BEGIN
  -- Check all column types
  SELECT data_type INTO users_phone_type FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'phone_number';
  
  SELECT data_type INTO users_email_type FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'email';
  
  SELECT data_type INTO users_first_name_type FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'first_name';
  
  SELECT data_type INTO users_last_name_type FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'last_name';
  
  SELECT data_type INTO users_address_type FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'address';
  
  SELECT data_type INTO responders_contact_type FROM information_schema.columns 
  WHERE table_name = 'responders' AND column_name = 'contact_number';
  
  SELECT data_type INTO responders_name_type FROM information_schema.columns 
  WHERE table_name = 'responders' AND column_name = 'name';
  
  SELECT data_type INTO incidents_audio_type FROM information_schema.columns 
  WHERE table_name = 'incident_reports' AND column_name = 'audio_path';
  
  SELECT data_type INTO incidents_media_url_type FROM information_schema.columns 
  WHERE table_name = 'incident_reports' AND column_name = 'media_url';
  
  SELECT data_type INTO incidents_media_paths_type FROM information_schema.columns 
  WHERE table_name = 'incident_reports' AND column_name = 'media_paths';
  
  SELECT data_type INTO audit_ip_type FROM information_schema.columns 
  WHERE table_name = 'dispatcher_audit_logs' AND column_name = 'ip_address';

  -- Verify all are TEXT
  IF users_phone_type = 'text' AND users_email_type = 'text' AND 
     users_first_name_type = 'text' AND users_last_name_type = 'text' AND 
     users_address_type = 'text' AND responders_contact_type = 'text' AND 
     responders_name_type = 'text' AND incidents_audio_type = 'text' AND 
     incidents_media_url_type = 'text' AND incidents_media_paths_type = 'text' AND
     audit_ip_type = 'text' THEN
    RAISE NOTICE '✅ All encrypted fields successfully migrated to TEXT';
  ELSE
    RAISE EXCEPTION '❌ Migration verification failed - not all columns are TEXT type';
  END IF;
END $$;
