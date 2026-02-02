-- =============================================
-- Fix: Case-insensitive email matching for RLS
-- =============================================
-- Google OAuth and other providers may return emails in different cases
-- than what's stored in allowed_emails. This migration fixes the
-- is_user_allowed() and get_user_organization_id() functions to use
-- case-insensitive email comparison.

-- =============================================
-- Fix is_user_allowed() function
-- =============================================
CREATE OR REPLACE FUNCTION public.is_user_allowed()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_emails ae
    JOIN auth.users u ON LOWER(u.email) = LOWER(ae.email)
    WHERE u.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Fix get_user_organization_id() function
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  -- First check if user is already a member of an org
  SELECT organization_id INTO org_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF org_id IS NOT NULL THEN
    RETURN org_id;
  END IF;

  -- Check if user's email is in allowed list and auto-assign
  -- Using LOWER() for case-insensitive comparison
  SELECT ae.organization_id INTO org_id
  FROM public.allowed_emails ae
  JOIN auth.users u ON LOWER(u.email) = LOWER(ae.email)
  WHERE u.id = auth.uid() AND ae.auto_assign = true
  LIMIT 1;

  IF org_id IS NOT NULL THEN
    -- Auto-assign user to organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, auth.uid(), 'member')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    RETURN org_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Normalize existing allowed_emails to lowercase
-- This ensures consistency going forward
-- =============================================
UPDATE public.allowed_emails
SET email = LOWER(email)
WHERE email != LOWER(email);

-- Add unique index on lowercased email to prevent duplicates
-- First drop any existing unique constraint if it exists
ALTER TABLE public.allowed_emails DROP CONSTRAINT IF EXISTS allowed_emails_email_key;

-- Create a unique index on lowercase email
CREATE UNIQUE INDEX IF NOT EXISTS allowed_emails_email_lower_idx
ON public.allowed_emails (LOWER(email));
