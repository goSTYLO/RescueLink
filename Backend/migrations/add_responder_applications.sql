-- Responder Applications Table Migration (Phase 2 Upgrade)

CREATE TABLE IF NOT EXISTS responder_applications (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  gov_id_path       VARCHAR(500),
  certificate_paths JSONB DEFAULT '[]'::jsonb,
  other_doc_paths   JSONB DEFAULT '[]'::jsonb,
  personal_details  JSONB DEFAULT '{}'::jsonb,
  notes             TEXT,
  submitted_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at       TIMESTAMP WITH TIME ZONE,
  reviewed_by       INTEGER REFERENCES users(user_id) ON DELETE SET NULL
);

-- Upgrade existing Phase 1 placeholder table columns if present
ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS gov_id_path VARCHAR(500);
ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS certificate_paths JSONB DEFAULT '[]'::jsonb;
ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS other_doc_paths JSONB DEFAULT '[]'::jsonb;
ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS personal_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE responder_applications ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'responder_applications' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE responder_applications ALTER COLUMN full_name DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_responder_apps_user_id ON responder_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_responder_apps_status ON responder_applications(status);
