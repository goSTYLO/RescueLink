-- Add geospatial coordinates for departments and ETA fields for dispatch records

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS address VARCHAR(255),
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_departments_location ON departments(latitude, longitude);

ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS estimated_eta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS actual_arrival_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_dispatches_estimated_arrival_at ON dispatches(estimated_arrival_at);
