-- Record which vehicles (units) were used for an incident (monitoring only). Units are not tied to incidents.
CREATE TABLE IF NOT EXISTS incident_unit_usage (
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES department_units(unit_id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_unit_usage_report_id ON incident_unit_usage(report_id);
