-- Hybrid auto team assignment: incident suggestion/apply state + department type map.

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS auto_assignment_status VARCHAR(40) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS suggested_department_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS suggested_team_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS auto_assignment_reason TEXT,
  ADD COLUMN IF NOT EXISTS auto_assignment_mismatch BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_incident_reports_auto_assignment_status
  ON incident_reports(auto_assignment_status);

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS supported_incident_types TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_departments_supported_incident_types
  ON departments USING GIN (supported_incident_types);

UPDATE departments
   SET supported_incident_types = ARRAY['police']::TEXT[]
 WHERE LOWER(code) = 'pnp'
   AND COALESCE(array_length(supported_incident_types, 1), 0) = 0;

UPDATE departments
   SET supported_incident_types = ARRAY['fire', 'medical', 'disaster', 'accident']::TEXT[]
 WHERE LOWER(code) IN ('drrmo', 'cdrmmo')
   AND COALESCE(array_length(supported_incident_types, 1), 0) = 0;
