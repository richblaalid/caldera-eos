-- Migration 017: Add Grain OAuth token columns to partner_preferences
-- Enables persistent Grain token management via OAuth flow (same pattern as Google/QuickBooks)

ALTER TABLE public.partner_preferences
ADD COLUMN IF NOT EXISTS grain_refresh_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS grain_client_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.partner_preferences.grain_refresh_token IS 'Grain OAuth refresh token for automated transcript ingestion';
COMMENT ON COLUMN public.partner_preferences.grain_client_id IS 'Grain OAuth client ID (from MCP dynamic registration)';
