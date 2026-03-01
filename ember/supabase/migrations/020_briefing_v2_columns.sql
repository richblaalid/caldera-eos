-- Phase 17: Briefing v2 — Tactical Daily + Strategic Monday
-- Adds new columns alongside existing tier1/tier2/tier3 for zero-downtime migration.
-- Existing columns and data are preserved.

ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS briefing_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_monday BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tactical_items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS strategic_items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS fyi_item JSONB;

CREATE INDEX IF NOT EXISTS idx_briefings_version ON public.briefings(briefing_version);

COMMENT ON COLUMN public.briefings.briefing_version IS 'v1 = tier1/tier2/tier3, v2 = tactical/strategic/fyi';
COMMENT ON COLUMN public.briefings.is_monday IS 'True when strategic_items are populated (Monday briefings)';
