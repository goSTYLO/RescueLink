-- ============================================
-- RescueLink AI Integration - Database Migration
-- Created: 2026-01-28
-- Description: Adds AI-related fields to existing tables
-- ============================================

-- Add AI-related columns to incident_reports table
ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS transcription TEXT,
  ADD COLUMN IF NOT EXISTS audio_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS media_paths JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_pending BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_attempted BOOLEAN DEFAULT FALSE;

-- Add AI confidence and override tracking to ai_classifications table
ALTER TABLE ai_classifications
  ADD COLUMN IF NOT EXISTS low_confidence_flag BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Create index for AI pending incidents (for retry job performance)
CREATE INDEX IF NOT EXISTS idx_incident_reports_ai_pending 
  ON incident_reports(ai_pending, ai_attempted) 
  WHERE ai_pending = TRUE;

-- Create index for low confidence classifications (for human review)
CREATE INDEX IF NOT EXISTS idx_ai_classifications_low_confidence 
  ON ai_classifications(low_confidence_flag) 
  WHERE low_confidence_flag = TRUE;

-- Create table for detailed confidence scores (optional, for analytics)
CREATE TABLE IF NOT EXISTS ai_confidence_details (
  detail_id SERIAL PRIMARY KEY,
  classification_id INTEGER NOT NULL REFERENCES ai_classifications(classification_id) ON DELETE CASCADE,
  incident_type VARCHAR(100) NOT NULL,
  confidence_value DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on classification_id for faster joins
CREATE INDEX IF NOT EXISTS idx_ai_confidence_details_classification 
  ON ai_confidence_details(classification_id);

-- Add comments for documentation
COMMENT ON COLUMN incident_reports.transcription IS 'Transcribed text from audio recording (from Whisper AI)';
COMMENT ON COLUMN incident_reports.audio_path IS 'File path to stored audio recording (e.g., uploads/incidents/incident_123_audio.wav)';
COMMENT ON COLUMN incident_reports.media_paths IS 'JSON array of file paths to photos/videos (e.g., ["incident_123_photo_1.jpg", "incident_123_video_1.mp4"])';
COMMENT ON COLUMN incident_reports.ai_pending IS 'TRUE if AI classification failed and needs retry';
COMMENT ON COLUMN incident_reports.ai_attempted IS 'TRUE if AI classification has been attempted at least once';

COMMENT ON COLUMN ai_classifications.low_confidence_flag IS 'TRUE if max confidence score < 0.7, requires human review';
COMMENT ON COLUMN ai_classifications.is_override IS 'TRUE if human manually changed AI prediction';
COMMENT ON COLUMN ai_classifications.retry_count IS 'Number of retry attempts for failed classifications (max 3)';

COMMENT ON TABLE ai_confidence_details IS 'Stores individual confidence scores for each incident type (for detailed analytics)';

-- Grant permissions to rescuelink_user
GRANT ALL ON TABLE ai_confidence_details TO rescuelink_user;
GRANT USAGE, SELECT ON SEQUENCE ai_confidence_details_detail_id_seq TO rescuelink_user;

-- Display migration completion message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ AI integration migration completed successfully!';
  RAISE NOTICE '   - Added 5 columns to incident_reports';
  RAISE NOTICE '   - Added 3 columns to ai_classifications';
  RAISE NOTICE '   - Created ai_confidence_details table';
  RAISE NOTICE '   - Created 3 performance indexes';
END $$;
