-- Phase 1 placeholder tables for the Responder Module (Phase 2)
-- These tables are created empty now so Phase 2 can build on top without a schema migration gap.

-- Citizen applications to become volunteer first responders
CREATE TABLE IF NOT EXISTS responder_applications (
  application_id     SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  full_name          VARCHAR(150) NOT NULL,
  contact_number     VARCHAR(20),
  skills             TEXT[] DEFAULT ARRAY[]::TEXT[],
  certifications     JSONB DEFAULT '[]'::jsonb,
  -- status: pending | approved | rejected
  status             VARCHAR(50) NOT NULL DEFAULT 'pending',
  reviewed_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMP,
  notes              TEXT,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_responder_applications_user_id
  ON responder_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_responder_applications_status
  ON responder_applications(status);

-- Links approved citizen responders to specific incidents they have accepted
CREATE TABLE IF NOT EXISTS incident_responder_assignments (
  assignment_id  SERIAL PRIMARY KEY,
  report_id      INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  accepted_at    TIMESTAMP,
  -- status: pending | accepted | declined | completed
  status         VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_responder_assignments_report_id
  ON incident_responder_assignments(report_id);
CREATE INDEX IF NOT EXISTS idx_incident_responder_assignments_user_id
  ON incident_responder_assignments(user_id);
