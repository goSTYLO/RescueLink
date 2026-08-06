-- Team/member schema for backend-driven assignment
CREATE TABLE IF NOT EXISTS responder_teams (
  team_id SERIAL PRIMARY KEY,
  department_code VARCHAR(40) NOT NULL,
  team_name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(department_code, team_name)
);

CREATE TABLE IF NOT EXISTS responder_team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES responder_teams(team_id) ON DELETE CASCADE,
  responder_id INTEGER NOT NULL REFERENCES responders(responder_id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, responder_id)
);

CREATE INDEX IF NOT EXISTS idx_responder_teams_department_code ON responder_teams(department_code);
CREATE INDEX IF NOT EXISTS idx_responder_teams_team_name ON responder_teams(team_name);
CREATE INDEX IF NOT EXISTS idx_responder_team_members_team_id ON responder_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_responder_team_members_responder_id ON responder_team_members(responder_id);

-- Best-effort backfill from existing responders.team_name
INSERT INTO responder_teams (department_code, team_name)
SELECT DISTINCT
  CASE
    WHEN LOWER(COALESCE(organization, '')) ~ '(police|pnp|crime)' THEN 'pnp'
    ELSE 'drrmo'
  END AS department_code,
  team_name
FROM responders
WHERE team_name IS NOT NULL
  AND LENGTH(TRIM(team_name)) > 0
ON CONFLICT (department_code, team_name) DO NOTHING;

INSERT INTO responder_team_members (team_id, responder_id)
SELECT rt.team_id, r.responder_id
FROM responders r
INNER JOIN responder_teams rt
  ON LOWER(rt.team_name) = LOWER(r.team_name)
 AND LOWER(rt.department_code) = LOWER(
   CASE
     WHEN LOWER(COALESCE(r.organization, '')) ~ '(police|pnp|crime)' THEN 'pnp'
     ELSE 'drrmo'
   END
 )
WHERE r.team_name IS NOT NULL
  AND LENGTH(TRIM(r.team_name)) > 0
ON CONFLICT (team_id, responder_id) DO NOTHING;
