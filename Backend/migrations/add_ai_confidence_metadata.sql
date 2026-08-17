-- AI classification metadata: STT confidence + fallback flags
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS stt_confidence DOUBLE PRECISION;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS keyword_promoted BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_classifications ADD COLUMN IF NOT EXISTS max_confidence_score DOUBLE PRECISION;

ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS stt_confidence DOUBLE PRECISION;
