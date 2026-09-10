-- User profile photo (filesystem path; never exposed in API responses)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);
