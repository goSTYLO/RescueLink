-- Allow department_units to track which incident (report) they are assigned to.
ALTER TABLE department_units
  ADD COLUMN IF NOT EXISTS assigned_report_id INTEGER REFERENCES incident_reports(report_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_department_units_assigned_report_id ON department_units(assigned_report_id);
