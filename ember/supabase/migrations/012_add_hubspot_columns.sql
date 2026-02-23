-- ============================================
-- Migration 012: Add HubSpot OAuth columns
-- ============================================

ALTER TABLE public.partner_preferences
  ADD COLUMN IF NOT EXISTS hubspot_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_portal_id TEXT;
