-- Dispatcher MFA: OTP for email verification at login
CREATE TABLE IF NOT EXISTS dispatcher_login_otp (
  session_token VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  otp_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dispatcher_login_otp_expires ON dispatcher_login_otp(expires_at);
