-- Add responder/team specialization and status fields for assignment v3

ALTER TABLE responders
  ADD COLUMN IF NOT EXISTS supported_incident_types TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE responder_teams
  ADD COLUMN IF NOT EXISTS team_status VARCHAR(50) NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS supported_incident_types TEXT[] NOT NULL DEFAULT '{}';

-- Backfill basic team specialization by department code where empty
UPDATE responder_teams
SET supported_incident_types = CASE
  WHEN LOWER(COALESCE(department_code, '')) IN ('pnp', 'police') THEN ARRAY['police']
  ELSE ARRAY['fire', 'medical', 'disaster']
END
WHERE COALESCE(array_length(supported_incident_types, 1), 0) = 0;

CREATE INDEX IF NOT EXISTS idx_responder_teams_team_status ON responder_teams(team_status);
CREATE INDEX IF NOT EXISTS idx_responders_supported_incident_types ON responders USING GIN (supported_incident_types);
CREATE INDEX IF NOT EXISTS idx_responder_teams_supported_incident_types ON responder_teams USING GIN (supported_incident_types);
