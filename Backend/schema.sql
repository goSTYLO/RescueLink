CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone_number VARCHAR(20) UNIQUE,
  address VARCHAR(255),
  password VARCHAR(255),
  phone_verified BOOLEAN DEFAULT FALSE,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on phone_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create incident reports table
CREATE TABLE IF NOT EXISTS incident_reports (
  report_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  incident_type VARCHAR(100),
  severity_level VARCHAR(50),
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  media_url VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups by user
CREATE INDEX IF NOT EXISTS idx_incident_reports_user_id ON incident_reports(user_id);

-- Index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_incident_reports_location ON incident_reports(latitude, longitude);

-- Index for filtering by severity level
CREATE INDEX IF NOT EXISTS idx_incident_reports_severity ON incident_reports(severity_level);

-- Migration SQL for existing databases (run these if table already exists)
-- Make incident_type nullable
-- ALTER TABLE incident_reports ALTER COLUMN incident_type DROP NOT NULL;

-- Make latitude and longitude required
-- ALTER TABLE incident_reports ALTER COLUMN latitude SET NOT NULL;
-- ALTER TABLE incident_reports ALTER COLUMN longitude SET NOT NULL;

-- Create responders table
CREATE TABLE IF NOT EXISTS responders (
  responder_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  organization VARCHAR(150),
  contact_number VARCHAR(20),
  availability_status VARCHAR(50)
);

-- Create AI classifications table
CREATE TABLE IF NOT EXISTS ai_classifications (
  classification_id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id),
  predicted_type VARCHAR(100),
  predicted_severity VARCHAR(50),
  confidence_score DOUBLE PRECISION,
  is_duplicate BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups by report
CREATE INDEX IF NOT EXISTS idx_ai_classifications_report_id ON ai_classifications(report_id);

-- Create blockchain records table
CREATE TABLE IF NOT EXISTS blockchain_records (
  blockchain_id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id),
  hash_value VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  network_reference VARCHAR(255)
);

-- Index for quick lookups by report
CREATE INDEX IF NOT EXISTS idx_blockchain_records_report_id ON blockchain_records(report_id);

-- Create dispatch table
CREATE TABLE IF NOT EXISTS dispatches (
  dispatch_id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id),
  responder_id INTEGER NOT NULL REFERENCES responders(responder_id),
  dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  response_status VARCHAR(50)
);

-- Index for quick lookups by report
CREATE INDEX IF NOT EXISTS idx_dispatches_report_id ON dispatches(report_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  report_id INTEGER REFERENCES incident_reports(report_id),
  message VARCHAR(500) NOT NULL,
  sent_via VARCHAR(50),
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_report_id ON notifications(report_id);
