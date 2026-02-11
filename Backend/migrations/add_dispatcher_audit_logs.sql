-- Dispatcher audit logs: trail of dispatcher actions for authenticity and reference
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
