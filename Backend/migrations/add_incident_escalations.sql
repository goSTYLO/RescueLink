-- Migration: add_incident_escalations
-- Creates the incident_escalations table for inter-department assistance tracking.

CREATE TABLE IF NOT EXISTS incident_escalations (
  id                     SERIAL PRIMARY KEY,
  report_id              INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
  from_department_id     INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
  to_department_id       INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
  requested_by_user_id   INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  urgency                VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  justification_notes    TEXT NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'resolved', 'cancelled')),
  response_notes         TEXT,
  responded_by_user_id   INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  responded_at           TIMESTAMP,
  resolved_at            TIMESTAMP,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_escalations_report_id
  ON incident_escalations(report_id);

CREATE INDEX IF NOT EXISTS idx_incident_escalations_to_dept
  ON incident_escalations(to_department_id);

CREATE INDEX IF NOT EXISTS idx_incident_escalations_status
  ON incident_escalations(status);

CREATE INDEX IF NOT EXISTS idx_incident_escalations_report_created
  ON incident_escalations(report_id, created_at DESC);
