-- =============================================
-- Organization-based Access Control
-- =============================================

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  is_test BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Caldera (production) and Test organizations
INSERT INTO public.organizations (id, name, is_test) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Caldera', false),
  ('00000000-0000-0000-0000-000000000002', 'Test', true)
ON CONFLICT (name) DO NOTHING;

-- Create organization members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Members can see their own memberships
CREATE POLICY "Users can view their org memberships"
  ON public.organization_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- Allowed emails for Caldera organization
-- Add the 3 partner emails here
-- =============================================
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  auto_assign BOOLEAN DEFAULT TRUE, -- Auto-assign to org on first login
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert allowed Caldera emails (UPDATE THESE WITH REAL EMAILS)
INSERT INTO public.allowed_emails (email, organization_id) VALUES
  ('richard.blaalid@withcaldera.com', '00000000-0000-0000-0000-000000000001'),
  ('john.oneill@withcaldera.com', '00000000-0000-0000-0000-000000000001'),
  ('wade.evanhoff@withcaldera.com', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (email) DO NOTHING;

-- Test account (add your test email)
INSERT INTO public.allowed_emails (email, organization_id) VALUES
  ('richblaalid@gmail.com', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- Add organization_id to EOS tables
-- =============================================

-- Add org_id to VTO
ALTER TABLE public.vto ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Add org_id to rocks
ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Add org_id to issues
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Add org_id to todos
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Add org_id to scorecard_metrics
ALTER TABLE public.scorecard_metrics ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Add org_id to meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Add org_id to transcripts
ALTER TABLE public.transcripts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Add org_id to insights
ALTER TABLE public.insights ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- =============================================
-- Helper function to get user's organization
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
  SELECT ae.organization_id INTO org_id
  FROM public.allowed_emails ae
  JOIN auth.users u ON u.email = ae.email
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
-- Helper function to check if user is allowed
-- =============================================
CREATE OR REPLACE FUNCTION public.is_user_allowed()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_emails ae
    JOIN auth.users u ON u.email = ae.email
    WHERE u.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Update RLS policies to use organization
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "VTO viewable by authenticated users" ON public.vto;
DROP POLICY IF EXISTS "VTO editable by authenticated users" ON public.vto;
DROP POLICY IF EXISTS "Rocks viewable by authenticated users" ON public.rocks;
DROP POLICY IF EXISTS "Rocks editable by authenticated users" ON public.rocks;
DROP POLICY IF EXISTS "Issues viewable by authenticated users" ON public.issues;
DROP POLICY IF EXISTS "Issues editable by authenticated users" ON public.issues;
DROP POLICY IF EXISTS "Todos viewable by authenticated users" ON public.todos;
DROP POLICY IF EXISTS "Todos editable by authenticated users" ON public.todos;
DROP POLICY IF EXISTS "Scorecard metrics viewable by authenticated users" ON public.scorecard_metrics;
DROP POLICY IF EXISTS "Scorecard metrics editable by authenticated users" ON public.scorecard_metrics;
DROP POLICY IF EXISTS "Scorecard entries viewable by authenticated users" ON public.scorecard_entries;
DROP POLICY IF EXISTS "Scorecard entries editable by authenticated users" ON public.scorecard_entries;
DROP POLICY IF EXISTS "Meetings viewable by authenticated users" ON public.meetings;
DROP POLICY IF EXISTS "Meetings editable by authenticated users" ON public.meetings;
DROP POLICY IF EXISTS "Transcripts viewable by authenticated users" ON public.transcripts;
DROP POLICY IF EXISTS "Transcripts editable by authenticated users" ON public.transcripts;
DROP POLICY IF EXISTS "Transcript chunks viewable by authenticated users" ON public.transcript_chunks;
DROP POLICY IF EXISTS "Transcript chunks editable by authenticated users" ON public.transcript_chunks;
DROP POLICY IF EXISTS "Insights viewable by authenticated users" ON public.insights;
DROP POLICY IF EXISTS "Insights editable by authenticated users" ON public.insights;

-- VTO: Users can only see/edit their organization's VTO
CREATE POLICY "VTO viewable by org members"
  ON public.vto FOR SELECT TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

CREATE POLICY "VTO editable by org members"
  ON public.vto FOR ALL TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

-- Rocks
CREATE POLICY "Rocks viewable by org members"
  ON public.rocks FOR SELECT TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

CREATE POLICY "Rocks editable by org members"
  ON public.rocks FOR ALL TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

-- Issues
CREATE POLICY "Issues viewable by org members"
  ON public.issues FOR SELECT TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

CREATE POLICY "Issues editable by org members"
  ON public.issues FOR ALL TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

-- Todos
CREATE POLICY "Todos viewable by org members"
  ON public.todos FOR SELECT TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

CREATE POLICY "Todos editable by org members"
  ON public.todos FOR ALL TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

-- Scorecard metrics
CREATE POLICY "Scorecard metrics viewable by org members"
  ON public.scorecard_metrics FOR SELECT TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

CREATE POLICY "Scorecard metrics editable by org members"
  ON public.scorecard_metrics FOR ALL TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

-- Scorecard entries (join through metrics)
CREATE POLICY "Scorecard entries viewable by org members"
  ON public.scorecard_entries FOR SELECT TO authenticated
  USING (
    public.is_user_allowed() AND
    EXISTS (
      SELECT 1 FROM public.scorecard_metrics m
      WHERE m.id = scorecard_entries.metric_id
      AND m.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "Scorecard entries editable by org members"
  ON public.scorecard_entries FOR ALL TO authenticated
  USING (
    public.is_user_allowed() AND
    EXISTS (
      SELECT 1 FROM public.scorecard_metrics m
      WHERE m.id = scorecard_entries.metric_id
      AND m.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    public.is_user_allowed() AND
    EXISTS (
      SELECT 1 FROM public.scorecard_metrics m
      WHERE m.id = scorecard_entries.metric_id
      AND m.organization_id = public.get_user_organization_id()
    )
  );

-- Meetings
CREATE POLICY "Meetings viewable by org members"
  ON public.meetings FOR SELECT TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

CREATE POLICY "Meetings editable by org members"
  ON public.meetings FOR ALL TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

-- Transcripts
CREATE POLICY "Transcripts viewable by org members"
  ON public.transcripts FOR SELECT TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

CREATE POLICY "Transcripts editable by org members"
  ON public.transcripts FOR ALL TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

-- Transcript chunks (join through transcripts)
CREATE POLICY "Transcript chunks viewable by org members"
  ON public.transcript_chunks FOR SELECT TO authenticated
  USING (
    public.is_user_allowed() AND
    EXISTS (
      SELECT 1 FROM public.transcripts t
      WHERE t.id = transcript_chunks.transcript_id
      AND t.organization_id = public.get_user_organization_id()
    )
  );

CREATE POLICY "Transcript chunks editable by org members"
  ON public.transcript_chunks FOR ALL TO authenticated
  USING (
    public.is_user_allowed() AND
    EXISTS (
      SELECT 1 FROM public.transcripts t
      WHERE t.id = transcript_chunks.transcript_id
      AND t.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    public.is_user_allowed() AND
    EXISTS (
      SELECT 1 FROM public.transcripts t
      WHERE t.id = transcript_chunks.transcript_id
      AND t.organization_id = public.get_user_organization_id()
    )
  );

-- Insights
CREATE POLICY "Insights viewable by org members"
  ON public.insights FOR SELECT TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

CREATE POLICY "Insights editable by org members"
  ON public.insights FOR ALL TO authenticated
  USING (public.is_user_allowed() AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.is_user_allowed() AND organization_id = public.get_user_organization_id());

-- =============================================
-- Indexes for organization queries
-- =============================================
CREATE INDEX IF NOT EXISTS vto_org_idx ON public.vto(organization_id);
CREATE INDEX IF NOT EXISTS rocks_org_idx ON public.rocks(organization_id);
CREATE INDEX IF NOT EXISTS issues_org_idx ON public.issues(organization_id);
CREATE INDEX IF NOT EXISTS todos_org_idx ON public.todos(organization_id);
CREATE INDEX IF NOT EXISTS scorecard_metrics_org_idx ON public.scorecard_metrics(organization_id);
CREATE INDEX IF NOT EXISTS meetings_org_idx ON public.meetings(organization_id);
CREATE INDEX IF NOT EXISTS transcripts_org_idx ON public.transcripts(organization_id);
CREATE INDEX IF NOT EXISTS insights_org_idx ON public.insights(organization_id);

-- =============================================
-- Add accountability_chart column if missing
-- =============================================
ALTER TABLE public.vto ADD COLUMN IF NOT EXISTS accountability_chart JSONB DEFAULT '[]'::jsonb;
