-- Add event_type column to notifications for richer display (created, dispatched, status_updated, etc.)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_type VARCHAR(50);
