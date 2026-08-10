-- Migration: Add Responder Specialization and Per-Field Proof Paths

ALTER TABLE responder_applications
  ADD COLUMN IF NOT EXISTS specialization_fields TEXT[] DEFAULT '{}';

ALTER TABLE responder_applications
  ADD COLUMN IF NOT EXISTS field_proof_paths JSONB DEFAULT '{}'::jsonb;
