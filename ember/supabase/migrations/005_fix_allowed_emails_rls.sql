-- =============================================
-- Fix: Allow authenticated users to check allowed_emails
-- =============================================

-- Enable RLS on allowed_emails
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to check if their email is in the allowed list
-- This is needed for the dashboard authorization check
CREATE POLICY "Users can check their own email"
  ON public.allowed_emails FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Allow admins to manage allowed_emails (using service role, no policy needed)
