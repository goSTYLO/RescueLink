-- Per-user push notification opt-in/out per event type
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_type  VARCHAR(80) NOT NULL,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, event_type)
);

-- OneSignal player ID for server-side subscription confirmation
ALTER TABLE users ADD COLUMN IF NOT EXISTS onesignal_player_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_users_onesignal_player_id ON users(onesignal_player_id) WHERE onesignal_player_id IS NOT NULL;
