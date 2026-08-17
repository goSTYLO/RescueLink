-- Responder/volunteer last-known location for nearby incident filtering and alerts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
