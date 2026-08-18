-- Backup request acknowledge lifecycle (Phase 3 extension)
ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS acknowledged_by_user_id INTEGER REFERENCES users(user_id);
ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE;

UPDATE backup_requests SET status = 'pending' WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backup_requests_status_check'
  ) THEN
    ALTER TABLE backup_requests
      ADD CONSTRAINT backup_requests_status_check
      CHECK (status IN ('pending', 'acknowledged'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_backup_requests_pending
  ON backup_requests(report_id, status)
  WHERE status = 'pending';
