-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- EOS: V/TO (Vision/Traction Organizer)
-- =============================================
CREATE TABLE IF NOT EXISTS public.vto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version INT DEFAULT 1,
  core_values JSONB DEFAULT '[]'::jsonb,
  core_focus JSONB DEFAULT '{}'::jsonb,
  ten_year_target JSONB DEFAULT '{}'::jsonb,
  marketing_strategy JSONB DEFAULT '{}'::jsonb,
  three_year_picture JSONB DEFAULT '{}'::jsonb,
  one_year_plan JSONB DEFAULT '{}'::jsonb,
  quarterly_rocks JSONB DEFAULT '[]'::jsonb,
  issues_list JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VTO viewable by authenticated users"
  ON public.vto FOR SELECT TO authenticated USING (true);

CREATE POLICY "VTO editable by authenticated users"
  ON public.vto FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- EOS: Rocks (Quarterly Priorities)
-- =============================================
CREATE TABLE IF NOT EXISTS public.rocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  quarter TEXT NOT NULL, -- e.g., 'Q1 2025'
  status TEXT DEFAULT 'on_track' CHECK (status IN ('on_track', 'off_track', 'at_risk', 'complete')),
  milestones JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rocks viewable by authenticated users"
  ON public.rocks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Rocks editable by authenticated users"
  ON public.rocks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- EOS: Issues (IDS Workflow)
-- =============================================
CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  priority INT DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'identified', 'discussed', 'solved', 'dropped')),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'transcript', 'insight', 'chat')),
  source_id UUID,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issues viewable by authenticated users"
  ON public.issues FOR SELECT TO authenticated USING (true);

CREATE POLICY "Issues editable by authenticated users"
  ON public.issues FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- EOS: To-dos (7-day action items)
-- =============================================
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  meeting_id UUID,
  rock_id UUID REFERENCES public.rocks(id) ON DELETE SET NULL,
  issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos viewable by authenticated users"
  ON public.todos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Todos editable by authenticated users"
  ON public.todos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- EOS: Scorecard Metrics
-- =============================================
CREATE TABLE IF NOT EXISTS public.scorecard_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target DECIMAL,
  unit TEXT, -- e.g., '$', '%', 'count'
  frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'monthly')),
  goal_direction TEXT DEFAULT 'above' CHECK (goal_direction IN ('above', 'below', 'equal')),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.scorecard_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scorecard metrics viewable by authenticated users"
  ON public.scorecard_metrics FOR SELECT TO authenticated USING (true);

CREATE POLICY "Scorecard metrics editable by authenticated users"
  ON public.scorecard_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- EOS: Scorecard Entries (Weekly values)
-- =============================================
CREATE TABLE IF NOT EXISTS public.scorecard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_id UUID REFERENCES public.scorecard_metrics(id) ON DELETE CASCADE NOT NULL,
  value DECIMAL,
  week_of DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_id, week_of)
);

ALTER TABLE public.scorecard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scorecard entries viewable by authenticated users"
  ON public.scorecard_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Scorecard entries editable by authenticated users"
  ON public.scorecard_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Meetings (L10 and other meetings)
-- =============================================
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  meeting_type TEXT DEFAULT 'l10' CHECK (meeting_type IN ('l10', 'quarterly', 'annual', 'other')),
  meeting_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  attendees UUID[] DEFAULT '{}',
  agenda JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  prep_content JSONB,
  prep_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meetings viewable by authenticated users"
  ON public.meetings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Meetings editable by authenticated users"
  ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Transcripts
-- =============================================
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  meeting_date TIMESTAMPTZ,
  participants TEXT[],
  full_text TEXT,
  summary TEXT,
  source TEXT, -- 'grain', 'upload', 'manual'
  file_path TEXT,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transcripts viewable by authenticated users"
  ON public.transcripts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Transcripts editable by authenticated users"
  ON public.transcripts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Transcript Chunks (for RAG)
-- =============================================
CREATE TABLE IF NOT EXISTS public.transcript_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcript_id UUID REFERENCES public.transcripts(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  speaker TEXT,
  timestamp_start INT, -- seconds from start
  timestamp_end INT,
  chunk_index INT,
  embedding VECTOR(1536), -- OpenAI/Anthropic embedding dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_idx
  ON public.transcript_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.transcript_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transcript chunks viewable by authenticated users"
  ON public.transcript_chunks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Transcript chunks editable by authenticated users"
  ON public.transcript_chunks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Chat Messages (Private coaching)
-- =============================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat messages are private - users can only see their own
CREATE POLICY "Users can view their own chat messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- Insights (AI-generated observations)
-- =============================================
CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('pattern', 'suggestion', 'warning', 'observation', 'reminder')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INT DEFAULT 0,
  sources JSONB DEFAULT '[]'::jsonb, -- References to source data
  related_entities JSONB DEFAULT '{}'::jsonb, -- Links to rocks, issues, etc.
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insights viewable by authenticated users"
  ON public.insights FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insights editable by authenticated users"
  ON public.insights FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Triggers for updated_at timestamps
-- =============================================

-- Reuse the update_updated_at function from 001_create_profiles.sql
-- Apply it to all new tables

CREATE TRIGGER update_vto_updated_at
  BEFORE UPDATE ON public.vto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_rocks_updated_at
  BEFORE UPDATE ON public.rocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_scorecard_metrics_updated_at
  BEFORE UPDATE ON public.scorecard_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_scorecard_entries_updated_at
  BEFORE UPDATE ON public.scorecard_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_transcripts_updated_at
  BEFORE UPDATE ON public.transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- Indexes for common queries
-- =============================================

CREATE INDEX IF NOT EXISTS rocks_owner_idx ON public.rocks(owner_id);
CREATE INDEX IF NOT EXISTS rocks_quarter_idx ON public.rocks(quarter);
CREATE INDEX IF NOT EXISTS rocks_status_idx ON public.rocks(status);

CREATE INDEX IF NOT EXISTS issues_status_idx ON public.issues(status);
CREATE INDEX IF NOT EXISTS issues_priority_idx ON public.issues(priority);
CREATE INDEX IF NOT EXISTS issues_owner_idx ON public.issues(owner_id);

CREATE INDEX IF NOT EXISTS todos_owner_idx ON public.todos(owner_id);
CREATE INDEX IF NOT EXISTS todos_due_date_idx ON public.todos(due_date);
CREATE INDEX IF NOT EXISTS todos_completed_idx ON public.todos(completed);

CREATE INDEX IF NOT EXISTS scorecard_entries_week_idx ON public.scorecard_entries(week_of);

CREATE INDEX IF NOT EXISTS meetings_date_idx ON public.meetings(meeting_date);

CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON public.chat_messages(conversation_id);

CREATE INDEX IF NOT EXISTS insights_type_idx ON public.insights(type);
CREATE INDEX IF NOT EXISTS insights_acknowledged_idx ON public.insights(acknowledged);
