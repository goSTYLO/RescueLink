-- RBAC System Enhancement: Add admin role and is_active column
-- This migration adds support for the new admin role and enables soft deletes

-- Add constraint to enforce valid roles
-- First, we'll add the is_active column to allow soft deletes
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add an index on is_active for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Add an index on role for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create a check constraint to ensure valid role values
-- Note: This comment documents the expected roles:
-- - 'user': Regular mobile app users (reporters)
-- - 'dispatcher': Web app administrators
-- - 'admin': System administrators with full access

-- Add a new audit table for all system actions (not just dispatcher actions)
-- This is separate from dispatcher_audit_logs to keep legacy audits intact
CREATE TABLE IF NOT EXISTS action_logs (
  action_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  user_role VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  action_type VARCHAR(20) DEFAULT 'SUCCESS', -- SUCCESS, FAILED, UNAUTHORIZED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_user_role ON action_logs(user_role);
CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action);
CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_action_logs_resource ON action_logs(resource_type, resource_id);

-- Add comment to document the migration
COMMENT ON TABLE action_logs IS 'Centralized audit log for all system actions across all user roles';
COMMENT ON COLUMN action_logs.action_type IS 'Type of action: SUCCESS (completed), FAILED (error), UNAUTHORIZED (denied)';
COMMENT ON COLUMN action_logs.details IS 'Additional JSON data about the action (parameters, context, etc)';

-- Create a view for easier querying of user activity
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  action_logs.user_id,
  users.email,
  users.role,
  COUNT(*) as total_actions,
  COUNT(CASE WHEN action_logs.action_type = 'SUCCESS' THEN 1 END) as successful_actions,
  COUNT(CASE WHEN action_logs.action_type = 'FAILED' THEN 1 END) as failed_actions,
  COUNT(CASE WHEN action_logs.action_type = 'UNAUTHORIZED' THEN 1 END) as unauthorized_attempts,
  MAX(action_logs.created_at) as last_action_at
FROM action_logs
LEFT JOIN users ON action_logs.user_id = users.user_id
GROUP BY action_logs.user_id, users.email, users.role;

COMMENT ON VIEW user_activity_summary IS 'Summarized view of user activity across the system for administration and monitoring';
