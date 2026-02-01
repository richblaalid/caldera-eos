-- =============================================
-- Fix: Organization members RLS policies
-- =============================================

-- Create a SECURITY DEFINER function to get user's organization IDs
-- This bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their org memberships" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view members in their organization" ON public.organization_members;

-- Allow users to see all members in their organization (using SECURITY DEFINER function)
CREATE POLICY "Users can view members in their organization"
  ON public.organization_members FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- Allow authenticated users to insert themselves into organizations
-- (only if their email is in allowed_emails with auto_assign = true)
DROP POLICY IF EXISTS "Users can auto-assign to allowed organizations" ON public.organization_members;
CREATE POLICY "Users can auto-assign to allowed organizations"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      JOIN auth.users u ON u.email = ae.email
      WHERE u.id = auth.uid()
      AND ae.organization_id = organization_members.organization_id
      AND ae.auto_assign = true
    )
  );
