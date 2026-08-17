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

-- Department management domain
CREATE TABLE IF NOT EXISTS departments (
  department_id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  color VARCHAR(30) DEFAULT 'gray',
  address VARCHAR(255),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS department_units (
  unit_id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Available',
  maintenance_status VARCHAR(50) DEFAULT 'Operational',
  last_maintenance DATE,
  next_maintenance DATE,
  maintenance_notes TEXT,
  active_task_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS department_personnel (
  personnel_id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  unit_id INTEGER REFERENCES department_units(unit_id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Available',
  special_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  certifications JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_type ON departments(type);
CREATE INDEX IF NOT EXISTS idx_departments_location ON departments(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_department_units_department_id ON department_units(department_id);
CREATE INDEX IF NOT EXISTS idx_department_personnel_department_id ON department_personnel(department_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);

ALTER TABLE departments ADD COLUMN IF NOT EXISTS address VARCHAR(255);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Create incident reports table
CREATE TABLE IF NOT EXISTS incident_reports (
  report_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  incident_type VARCHAR(100),
  severity_level VARCHAR(50),
  primary_classification VARCHAR(100),
  primary_confidence DOUBLE PRECISION,
  secondary_classification VARCHAR(100),
  secondary_confidence DOUBLE PRECISION,
  incident_types TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  barangay VARCHAR(150),
  media_url VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  transcription TEXT,
  audio_path VARCHAR(500),
  media_paths JSONB,
  ai_pending BOOLEAN DEFAULT FALSE,
  ai_attempted BOOLEAN DEFAULT FALSE,
  scan_status VARCHAR(30) DEFAULT 'pending',
  scan_engine VARCHAR(120),
  scan_error TEXT,
  scanned_at TIMESTAMP,
  quarantined BOOLEAN DEFAULT FALSE,
  quarantine_reason TEXT,
  reporter_confirmed_at TIMESTAMP,
  reporter_confirmed_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  resolved_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  closed_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  closure_method VARCHAR(80),
  closure_notes TEXT,
  parent_report_id INTEGER REFERENCES incident_reports(report_id) ON DELETE SET NULL,
  duplicate_confidence_score DOUBLE PRECISION,
  duplicate_detected_at TIMESTAMP WITH TIME ZONE,
  duplicate_detection_method VARCHAR(50),
  flagged_for_review BOOLEAN DEFAULT FALSE,
  is_duplicate BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups by user
CREATE INDEX IF NOT EXISTS idx_incident_reports_user_id ON incident_reports(user_id);

-- Index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_incident_reports_location ON incident_reports(latitude, longitude);

-- Index for filtering by severity level
CREATE INDEX IF NOT EXISTS idx_incident_reports_severity ON incident_reports(severity_level);

-- Migration SQL for existing databases (run these if table already exists)
-- Add AI/audio columns to incident_reports
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS transcription TEXT;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS audio_path VARCHAR(500);
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS media_paths JSONB;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS ai_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS ai_attempted BOOLEAN DEFAULT FALSE;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS primary_classification VARCHAR(100);
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS primary_confidence DOUBLE PRECISION;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS stt_confidence DOUBLE PRECISION;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS secondary_classification VARCHAR(100);
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS secondary_confidence DOUBLE PRECISION;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS incident_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS barangay VARCHAR(150);
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS scan_status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS scan_engine VARCHAR(120);
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS scan_error TEXT;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS quarantined BOOLEAN DEFAULT FALSE;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS reporter_confirmed_at TIMESTAMP;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS reporter_confirmed_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS resolved_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS closed_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS closure_method VARCHAR(80);
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS closure_notes TEXT;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS parent_report_id INTEGER REFERENCES incident_reports(report_id) ON DELETE SET NULL;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS duplicate_confidence_score DOUBLE PRECISION;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS duplicate_detected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS duplicate_detection_method VARCHAR(50);
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT FALSE;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_incident_reports_scan_status ON incident_reports(scan_status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_parent_id ON incident_reports(parent_report_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_is_duplicate ON incident_reports(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_incident_reports_reporter_confirmed_at ON incident_reports(reporter_confirmed_at);
CREATE INDEX IF NOT EXISTS idx_incident_reports_resolved_by_user_id ON incident_reports(resolved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_resolved_at ON incident_reports(resolved_at);
CREATE INDEX IF NOT EXISTS idx_incident_reports_closed_at ON incident_reports(closed_at);
CREATE INDEX IF NOT EXISTS idx_incident_reports_closed_by_user_id ON incident_reports(closed_by_user_id);

-- Create duplicate_clusters table for grouping duplicate incident reports
CREATE TABLE IF NOT EXISTS duplicate_clusters (
    cluster_id SERIAL PRIMARY KEY,
    primary_report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cluster_size INTEGER DEFAULT 1,
    confidence_score DOUBLE PRECISION DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_duplicate_clusters_primary ON duplicate_clusters(primary_report_id);

-- Create responders table
CREATE TABLE IF NOT EXISTS responders (
  responder_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  organization VARCHAR(150),
  contact_number VARCHAR(20),
  availability_status VARCHAR(50),
  source_type VARCHAR(20) NOT NULL DEFAULT 'account',
  team_name VARCHAR(150),
  supported_incident_types TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS responder_teams (
  team_id SERIAL PRIMARY KEY,
  department_code VARCHAR(40) NOT NULL,
  team_name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  team_status VARCHAR(50) NOT NULL DEFAULT 'available',
  supported_incident_types TEXT[] NOT NULL DEFAULT '{}',
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

-- Ensure new responder/team columns also exist on older databases
ALTER TABLE responders ADD COLUMN IF NOT EXISTS supported_incident_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE responder_teams ADD COLUMN IF NOT EXISTS team_status VARCHAR(50) NOT NULL DEFAULT 'available';
ALTER TABLE responder_teams ADD COLUMN IF NOT EXISTS supported_incident_types TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_responder_teams_department_code ON responder_teams(department_code);
CREATE INDEX IF NOT EXISTS idx_responder_teams_team_name ON responder_teams(team_name);
CREATE INDEX IF NOT EXISTS idx_responder_teams_team_status ON responder_teams(team_status);
CREATE INDEX IF NOT EXISTS idx_responder_team_members_team_id ON responder_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_responder_team_members_responder_id ON responder_team_members(responder_id);
CREATE INDEX IF NOT EXISTS idx_responders_supported_incident_types ON responders USING GIN (supported_incident_types);
CREATE INDEX IF NOT EXISTS idx_responder_teams_supported_incident_types ON responder_teams USING GIN (supported_incident_types);

-- Create AI classifications table
CREATE TABLE IF NOT EXISTS ai_classifications (
  classification_id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id),
  predicted_type VARCHAR(100),
  predicted_severity VARCHAR(50),
  confidence_score DOUBLE PRECISION,
  secondary_predicted_type VARCHAR(100),
  secondary_confidence_score DOUBLE PRECISION,
  low_confidence_flag BOOLEAN DEFAULT FALSE,
  is_duplicate BOOLEAN DEFAULT FALSE,
  is_override BOOLEAN DEFAULT FALSE,
  retry_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration SQL for existing databases (run these if table already exists)
-- Add AI classification columns to ai_classifications
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS low_confidence_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS secondary_predicted_type VARCHAR(100);
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS secondary_confidence_score DOUBLE PRECISION;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS stt_confidence DOUBLE PRECISION;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS keyword_promoted BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS max_confidence_score DOUBLE PRECISION;

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
  assignment_group_id VARCHAR(64),
  department_code VARCHAR(40),
  department_name VARCHAR(150),
  team_name VARCHAR(150),
  default_department_code VARCHAR(40),
  was_default_department BOOLEAN,
  responder_source VARCHAR(20) NOT NULL DEFAULT 'account',
  responder_name VARCHAR(150),
  assigned_by_user_id INTEGER REFERENCES users(user_id),
  estimated_eta_minutes INTEGER,
  estimated_arrival_at TIMESTAMP,
  actual_arrival_at TIMESTAMP,
  dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  response_status VARCHAR(50)
);

-- Index for quick lookups by report
CREATE INDEX IF NOT EXISTS idx_dispatches_report_id ON dispatches(report_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_assignment_group_id ON dispatches(assignment_group_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_department_code ON dispatches(department_code);
CREATE INDEX IF NOT EXISTS idx_dispatches_estimated_arrival_at ON dispatches(estimated_arrival_at);

ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS estimated_eta_minutes INTEGER;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMP;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS actual_arrival_at TIMESTAMP;

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

-- Dispatcher audit logs (trail of dispatcher actions for authenticity and reference)
CREATE TABLE IF NOT EXISTS dispatcher_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispatcher_audit_logs_user_created ON dispatcher_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatcher_audit_logs_action_created ON dispatcher_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatcher_audit_logs_resource ON dispatcher_audit_logs(resource_type, resource_id);

-- Token blacklist for logout invalidation (revoked JWTs)
CREATE TABLE IF NOT EXISTS token_blacklist (
  token_hash VARCHAR(64) PRIMARY KEY,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- Dispatcher MFA: OTP for email verification at login
CREATE TABLE IF NOT EXISTS dispatcher_login_otp (
  session_token VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  otp_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dispatcher_login_otp_expires ON dispatcher_login_otp(expires_at);

-- Responder Applications Table
CREATE TABLE IF NOT EXISTS responder_applications (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  gov_id_path       VARCHAR(500),
  certificate_paths JSONB DEFAULT '[]'::jsonb,
  other_doc_paths   JSONB DEFAULT '[]'::jsonb,
  personal_details  JSONB DEFAULT '{}'::jsonb,
  notes             TEXT,
  submitted_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at       TIMESTAMP WITH TIME ZONE,
  reviewed_by       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  revoke_reason     VARCHAR(50),
  revoke_reason_other TEXT,
  revoked_at        TIMESTAMP WITH TIME ZONE,
  revoked_by        INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT chk_responder_app_status CHECK (status IN ('pending', 'approved', 'rejected', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_responder_apps_user_id ON responder_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_responder_apps_status ON responder_applications(status);

-- ─── Phase 3: Incident Acceptance Workflow ────────────────────────────────────

-- Link responders directory entry back to the user account
ALTER TABLE responders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_responders_user_id ON responders(user_id);

-- Responder online/offline toggle (persisted server-side)
ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_online BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_users_responder_online ON users(responder_online) WHERE responder_online = TRUE;

-- Acceptance fields on incident_reports
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS accepted_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS responder_status VARCHAR(50);
-- responder_status values: Assigned | En Route | On Scene | Resolved
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_incident_reports_accepted_by ON incident_reports(accepted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_responder_status ON incident_reports(responder_status);

-- Audit trail for responder status transitions
CREATE TABLE IF NOT EXISTS responder_status_history (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
  updated_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_resp_status_hist_report ON responder_status_history(report_id);
CREATE INDEX IF NOT EXISTS idx_resp_status_hist_user ON responder_status_history(updated_by_user_id);

-- Backup requests from field responders
CREATE TABLE IF NOT EXISTS backup_requests (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES incident_reports(report_id) ON DELETE CASCADE,
  requested_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
  target VARCHAR(50) NOT NULL CHECK (target IN ('nearby_responders', 'cdrrmo', 'both')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_backup_requests_report ON backup_requests(report_id);
CREATE INDEX IF NOT EXISTS idx_backup_requests_requester ON backup_requests(requested_by_user_id);

-- Notification category (incident | application | responder_alert | backup_request | system)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'incident';
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category, user_id);
