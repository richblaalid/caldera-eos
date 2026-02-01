-- =============================================
-- EOS Organizational Checkup Tables
-- =============================================

-- =============================================
-- Checkup Periods (Assessment Windows)
-- =============================================
CREATE TABLE IF NOT EXISTS public.checkup_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- e.g., "Q1 2025 Baseline", "Q2 2025 Assessment"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.checkup_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checkup periods viewable by org members"
  ON public.checkup_periods FOR SELECT TO authenticated
  USING (
    public.is_user_allowed() AND
    organization_id = public.get_user_organization_id()
  );

CREATE POLICY "Checkup periods editable by org members"
  ON public.checkup_periods FOR ALL TO authenticated
  USING (
    public.is_user_allowed() AND
    organization_id = public.get_user_organization_id()
  )
  WITH CHECK (
    public.is_user_allowed() AND
    organization_id = public.get_user_organization_id()
  );

CREATE INDEX IF NOT EXISTS checkup_periods_org_idx ON public.checkup_periods(organization_id);
CREATE INDEX IF NOT EXISTS checkup_periods_active_idx ON public.checkup_periods(organization_id, is_active) WHERE is_active = true;

-- =============================================
-- Checkup Questions (Static EOS Questions)
-- =============================================
CREATE TYPE eos_component AS ENUM ('vision', 'people', 'data', 'issues', 'process', 'traction');

CREATE TABLE IF NOT EXISTS public.checkup_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component eos_component NOT NULL,
  question_order INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions are global, no RLS needed but restrict to authenticated users
ALTER TABLE public.checkup_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checkup questions viewable by authenticated"
  ON public.checkup_questions FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS checkup_questions_component_idx ON public.checkup_questions(component);
CREATE INDEX IF NOT EXISTS checkup_questions_order_idx ON public.checkup_questions(question_order);

-- =============================================
-- Checkup Responses (User Answers)
-- =============================================
CREATE TABLE IF NOT EXISTS public.checkup_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID REFERENCES public.checkup_periods(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.checkup_questions(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, user_id, question_id)
);

ALTER TABLE public.checkup_responses ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own responses
CREATE POLICY "Users can view own checkup responses"
  ON public.checkup_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own checkup responses"
  ON public.checkup_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkup responses"
  ON public.checkup_responses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS checkup_responses_period_idx ON public.checkup_responses(period_id);
CREATE INDEX IF NOT EXISTS checkup_responses_user_idx ON public.checkup_responses(user_id);
CREATE INDEX IF NOT EXISTS checkup_responses_period_user_idx ON public.checkup_responses(period_id, user_id);

-- =============================================
-- Checkup Completions (Tracking & Scores)
-- =============================================
CREATE TABLE IF NOT EXISTS public.checkup_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID REFERENCES public.checkup_periods(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_score INTEGER NOT NULL,
  vision_score INTEGER NOT NULL,
  people_score INTEGER NOT NULL,
  data_score INTEGER NOT NULL,
  issues_score INTEGER NOT NULL,
  process_score INTEGER NOT NULL,
  traction_score INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, user_id)
);

ALTER TABLE public.checkup_completions ENABLE ROW LEVEL SECURITY;

-- Users can see all completions in their org (for team averages)
CREATE POLICY "Completions viewable by org members"
  ON public.checkup_completions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.checkup_periods p
      WHERE p.id = checkup_completions.period_id
      AND p.organization_id = public.get_user_organization_id()
    )
  );

-- Users can only create/update their own completions
CREATE POLICY "Users can create own completions"
  ON public.checkup_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own completions"
  ON public.checkup_completions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS checkup_completions_period_idx ON public.checkup_completions(period_id);
CREATE INDEX IF NOT EXISTS checkup_completions_user_idx ON public.checkup_completions(user_id);

-- =============================================
-- Slack Settings (Per Organization)
-- =============================================
CREATE TABLE IF NOT EXISTS public.slack_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  bot_token TEXT, -- Encrypted OAuth access token
  channel_id TEXT, -- Leadership channel for reminders
  channel_name TEXT, -- Display name for UI
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.slack_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Slack settings viewable by org members"
  ON public.slack_settings FOR SELECT TO authenticated
  USING (
    public.is_user_allowed() AND
    organization_id = public.get_user_organization_id()
  );

CREATE POLICY "Slack settings editable by org members"
  ON public.slack_settings FOR ALL TO authenticated
  USING (
    public.is_user_allowed() AND
    organization_id = public.get_user_organization_id()
  )
  WITH CHECK (
    public.is_user_allowed() AND
    organization_id = public.get_user_organization_id()
  );

-- =============================================
-- Add slack_user_id to profiles
-- =============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- =============================================
-- Seed 20 EOS Organizational Checkup Questions
-- =============================================
INSERT INTO public.checkup_questions (component, question_order, question_text) VALUES
  -- Vision (3 questions, max 15)
  ('vision', 1, 'We have a clear vision in writing that has been properly communicated and is shared by everyone in the company.'),
  ('vision', 2, 'Our Core Values are clear and we are hiring, reviewing, rewarding, and releasing based on them.'),
  ('vision', 3, 'Our Core Focus (purpose/cause/passion and niche) is clear and guides all of our decision making.'),

  -- People (4 questions, max 20)
  ('people', 4, 'We have the Right People in the Right Seats throughout the organization.'),
  ('people', 5, 'Our Accountability Chart (organizational structure) is clear, and everyone has accountability and understands what they own.'),
  ('people', 6, 'Everyone in the organization understands our Rocks (3-7 90-day priorities).'),
  ('people', 7, 'Everyone has a Scorecard metric for which they are accountable.'),

  -- Data (3 questions, max 15)
  ('data', 8, 'We use a Scorecard to keep our finger on the pulse of the business.'),
  ('data', 9, 'Everyone in the organization has at least one measurable.'),
  ('data', 10, 'We have the data we need to make decisions.'),

  -- Issues (3 questions, max 15)
  ('issues', 11, 'We are good at identifying issues, discussing them in a healthy manner, and solving them permanently.'),
  ('issues', 12, 'Issues are identified and solved on a regular basis.'),
  ('issues', 13, 'Communication is open and honest.'),

  -- Process (3 questions, max 15)
  ('process', 14, 'Our Core Processes have been identified and documented.'),
  ('process', 15, 'Everyone follows our Core Processes as documented.'),
  ('process', 16, 'We use a Scorecard and our Core Processes to identify inefficiencies.'),

  -- Traction (4 questions, max 20)
  ('traction', 17, 'A 90-day World exists with Rocks, To-Dos, and measurables.'),
  ('traction', 18, 'Everyone in the organization meets weekly with their team (Level 10 Meeting).'),
  ('traction', 19, 'We use the IDS process (Identify, Discuss, Solve) for problem solving.'),
  ('traction', 20, 'We complete all To-Dos within 7 days.')
ON CONFLICT DO NOTHING;

-- =============================================
-- Helper function to calculate component scores
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_checkup_scores(p_period_id UUID, p_user_id UUID)
RETURNS TABLE (
  total_score INTEGER,
  vision_score INTEGER,
  people_score INTEGER,
  data_score INTEGER,
  issues_score INTEGER,
  process_score INTEGER,
  traction_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(r.score), 0)::INTEGER as total_score,
    COALESCE(SUM(CASE WHEN q.component = 'vision' THEN r.score ELSE 0 END), 0)::INTEGER as vision_score,
    COALESCE(SUM(CASE WHEN q.component = 'people' THEN r.score ELSE 0 END), 0)::INTEGER as people_score,
    COALESCE(SUM(CASE WHEN q.component = 'data' THEN r.score ELSE 0 END), 0)::INTEGER as data_score,
    COALESCE(SUM(CASE WHEN q.component = 'issues' THEN r.score ELSE 0 END), 0)::INTEGER as issues_score,
    COALESCE(SUM(CASE WHEN q.component = 'process' THEN r.score ELSE 0 END), 0)::INTEGER as process_score,
    COALESCE(SUM(CASE WHEN q.component = 'traction' THEN r.score ELSE 0 END), 0)::INTEGER as traction_score
  FROM public.checkup_responses r
  JOIN public.checkup_questions q ON q.id = r.question_id
  WHERE r.period_id = p_period_id AND r.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
