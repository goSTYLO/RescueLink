-- Coordination notes for incidents: persistent cross-department communication
CREATE TABLE IF NOT EXISTS incident_coordination_notes (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  author_name VARCHAR(150) NOT NULL,
  author_role VARCHAR(80) NOT NULL,
  department VARCHAR(150) NOT NULL,
  note TEXT NOT NULL,
  source VARCHAR(80) DEFAULT 'Dispatcher UI',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups by report
CREATE INDEX IF NOT EXISTS idx_incident_coordination_notes_report_id ON incident_coordination_notes(report_id);

-- Index for ordering by created_at (newest first)
CREATE INDEX IF NOT EXISTS idx_incident_coordination_notes_report_created ON incident_coordination_notes(report_id, created_at DESC);

-- Index for user lookups (e.g., "notes by this user")
CREATE INDEX IF NOT EXISTS idx_incident_coordination_notes_user_id ON incident_coordination_notes(user_id);
