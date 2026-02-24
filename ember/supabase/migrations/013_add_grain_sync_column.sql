-- Migration 013: Add grain_last_sync column to partner_preferences
-- Tracks last successful transcript connector sync to enable incremental ingestion

ALTER TABLE public.partner_preferences
ADD COLUMN IF NOT EXISTS grain_last_sync TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.partner_preferences.grain_last_sync IS 'Last successful transcript/Grain sync timestamp for incremental polling';
