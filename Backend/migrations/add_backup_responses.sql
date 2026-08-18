-- Nearby volunteer backup join/decline responses (Phase 3 extension)
CREATE TABLE IF NOT EXISTS backup_responses (
  id SERIAL PRIMARY KEY,
  backup_request_id INTEGER NOT NULL REFERENCES backup_requests(id) ON DELETE CASCADE,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'joined'
    CHECK (status IN ('joined', 'declined', 'withdrawn')),
  responder_status VARCHAR(50) DEFAULT 'Assigned'
    CHECK (responder_status IN ('Assigned', 'En Route', 'On Scene', 'Resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (backup_request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_backup_responses_report_joined
  ON backup_responses(report_id, status)
  WHERE status = 'joined';

CREATE INDEX IF NOT EXISTS idx_backup_responses_user_joined
  ON backup_responses(user_id, status)
  WHERE status = 'joined';

ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS broadcast_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS broadcast_count INTEGER DEFAULT 0;
