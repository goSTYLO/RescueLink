-- Migration: Add revoked status and revoke audit columns for volunteer responder applications

ALTER TABLE responder_applications
  ADD COLUMN IF NOT EXISTS revoke_reason VARCHAR(50);

ALTER TABLE responder_applications
  ADD COLUMN IF NOT EXISTS revoke_reason_other TEXT;

ALTER TABLE responder_applications
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE responder_applications
  ADD COLUMN IF NOT EXISTS revoked_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL;

-- Extend status check constraint to include 'revoked'
ALTER TABLE responder_applications DROP CONSTRAINT IF EXISTS chk_responder_app_status;

ALTER TABLE responder_applications
  ADD CONSTRAINT chk_responder_app_status
  CHECK (status IN ('pending', 'approved', 'rejected', 'revoked'));
