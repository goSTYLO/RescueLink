-- ============================================
-- RescueLink Assignment v2 + Secondary AI Classification
-- Created: 2026-03-06
-- Description:
--   1) Adds dispatch grouping/team/sector metadata for assignment v2
--   2) Adds responder source typing for hybrid account+directory selection
--   3) Adds explicit primary/secondary AI classification fields on incidents
-- ============================================

-- Responders: support hybrid source tagging and optional team metadata
ALTER TABLE responders
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'account',
  ADD COLUMN IF NOT EXISTS team_name VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_responders_source_type ON responders(source_type);
CREATE INDEX IF NOT EXISTS idx_responders_org_team ON responders(organization, team_name);

-- Dispatches: assignment v2 metadata while keeping legacy columns
ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS assignment_group_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS department_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS department_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS team_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS default_department_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS was_default_department BOOLEAN,
  ADD COLUMN IF NOT EXISTS responder_source VARCHAR(20) NOT NULL DEFAULT 'account',
  ADD COLUMN IF NOT EXISTS responder_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS assigned_by_user_id INTEGER REFERENCES users(user_id);

CREATE INDEX IF NOT EXISTS idx_dispatches_assignment_group_id ON dispatches(assignment_group_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_department_code ON dispatches(department_code);

-- Incident reports: explicit top-2 AI classification fields
ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS primary_classification VARCHAR(100),
  ADD COLUMN IF NOT EXISTS primary_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS secondary_classification VARCHAR(100),
  ADD COLUMN IF NOT EXISTS secondary_confidence DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_incident_reports_primary_classification ON incident_reports(primary_classification);

-- AI classification history: store second-best prediction explicitly
ALTER TABLE ai_classifications
  ADD COLUMN IF NOT EXISTS secondary_predicted_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS secondary_confidence_score DOUBLE PRECISION;
