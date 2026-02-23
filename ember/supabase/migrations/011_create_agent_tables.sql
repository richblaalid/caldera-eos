-- ============================================
-- Migration 011: Agent System Tables
-- Creates tables for the AI agent system:
--   agent_definitions, agent_outputs, agent_runs,
--   ingested_data, briefings, partner_preferences
-- ============================================

-- ============================================
-- 1. Agent Definitions
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_definitions (
  id TEXT PRIMARY KEY,                          -- e.g. 'ea-rich', 'financial-strategist'
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  persona TEXT NOT NULL,                        -- Full system prompt / persona
  tool_set TEXT[] NOT NULL DEFAULT '{}',        -- References to tool registry keys
  data_sources TEXT[] NOT NULL DEFAULT '{}',    -- Which connectors this agent reads from
  output_scope TEXT NOT NULL DEFAULT 'org' CHECK (output_scope IN ('org', 'user')),
  triggers JSONB NOT NULL DEFAULT '[]',         -- Scheduled and event triggers
  baseline_tasks JSONB NOT NULL DEFAULT '[]',   -- Recurring automated tasks
  config JSONB DEFAULT '{}',                    -- Agent-specific configuration
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Agent Outputs
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES public.agent_definitions(id),
  output_type TEXT NOT NULL,                    -- 'analysis', 'draft', 'alert', 'issue', 'recommendation', 'briefing'
  title TEXT NOT NULL,
  summary TEXT,                                -- Short description for Slack notifications
  content JSONB NOT NULL,                      -- Full output payload
  trust_zone INTEGER NOT NULL DEFAULT 1 CHECK (trust_zone IN (1, 2)),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'completed',        -- Zone 1: done automatically
    'pending_review',   -- Zone 2: awaiting approval
    'approved',         -- Zone 2: approved by partner
    'rejected',         -- Zone 2: rejected by partner
    'deferred',         -- Zone 2: deferred to later
    'expired'           -- Zone 2: approval window passed
  )),
  target_partner UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  deferred_until TIMESTAMPTZ,
  execution_result JSONB,
  related_eos_item_type TEXT,                  -- 'issue', 'todo', 'rock', 'scorecard'
  related_eos_item_id UUID,                    -- Link to created EOS item
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ============================================
-- 3. Agent Runs (execution log)
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES public.agent_definitions(id),
  trigger_type TEXT NOT NULL,                  -- 'schedule', 'event', 'request'
  trigger_context JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  model TEXT,
  outputs_created INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

-- ============================================
-- 4. Ingested Data (normalized external data)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ingested_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                        -- 'gmail', 'calendar', 'quickbooks', 'slack', 'hubspot'
  source_id TEXT NOT NULL,                     -- External system's unique ID
  data_type TEXT NOT NULL,                     -- 'email', 'calendar_event', 'invoice', 'message', etc.
  payload JSONB NOT NULL,                      -- Normalized data
  raw_payload JSONB,                           -- Original data for debugging
  entities JSONB DEFAULT '{}',                 -- Extracted entities (people, companies, etc.)
  relevance_tags TEXT[] DEFAULT '{}',          -- Classification tags
  embedding VECTOR(1536),                      -- For semantic search
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  source_timestamp TIMESTAMPTZ,                -- When the item was created in the source system
  processed_by TEXT[] DEFAULT '{}',            -- Which agents have processed this item
  UNIQUE(organization_id, source, source_id)
);

-- ============================================
-- 5. Briefings (daily partner briefings)
-- ============================================
CREATE TABLE IF NOT EXISTS public.briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.profiles(id),
  briefing_date DATE NOT NULL,
  tier1_urgent JSONB NOT NULL DEFAULT '[]',
  tier2_business JSONB NOT NULL DEFAULT '[]',
  tier3_industry JSONB NOT NULL DEFAULT '[]',
  agent_work_queue JSONB NOT NULL DEFAULT '[]',
  slack_message_ts TEXT,                       -- For threading replies
  slack_channel_id TEXT,                       -- Partner's DM channel
  delivered_at TIMESTAMPTZ,
  commands_processed JSONB DEFAULT '[]',       -- Log of partner replies
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, partner_id, briefing_date)
);

-- ============================================
-- 6. Partner Preferences (EA personalization)
-- ============================================
CREATE TABLE IF NOT EXISTS public.partner_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.profiles(id),
  briefing_time TIME DEFAULT '07:00',
  briefing_timezone TEXT DEFAULT 'America/New_York',
  slack_channel_id TEXT,                       -- Their private EA DM channel
  notification_level TEXT DEFAULT 'normal' CHECK (notification_level IN ('minimal', 'normal', 'verbose')),
  focus_areas TEXT[] DEFAULT '{}',             -- Priority domains
  google_refresh_token TEXT,                   -- Google OAuth refresh token for Gmail/Calendar
  google_history_id TEXT,                      -- Gmail incremental sync marker
  quickbooks_refresh_token TEXT,               -- QuickBooks OAuth refresh token
  quickbooks_realm_id TEXT,                    -- QuickBooks company ID
  config JSONB DEFAULT '{}',                   -- Additional preferences
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, partner_id)
);

-- ============================================
-- Indexes
-- ============================================

-- Agent outputs: query by agent, status, org
CREATE INDEX IF NOT EXISTS idx_agent_outputs_agent_id ON public.agent_outputs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_outputs_status ON public.agent_outputs(status);
CREATE INDEX IF NOT EXISTS idx_agent_outputs_org_id ON public.agent_outputs(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_outputs_created_at ON public.agent_outputs(created_at DESC);

-- Agent runs: query by agent, status
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON public.agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON public.agent_runs(started_at DESC);

-- Ingested data: query by source, type, timestamp
CREATE INDEX IF NOT EXISTS idx_ingested_data_source ON public.ingested_data(source);
CREATE INDEX IF NOT EXISTS idx_ingested_data_type ON public.ingested_data(data_type);
CREATE INDEX IF NOT EXISTS idx_ingested_data_org_source ON public.ingested_data(organization_id, source);
CREATE INDEX IF NOT EXISTS idx_ingested_data_ingested_at ON public.ingested_data(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingested_data_source_timestamp ON public.ingested_data(source_timestamp DESC);

-- Briefings: query by partner and date
CREATE INDEX IF NOT EXISTS idx_briefings_partner_date ON public.briefings(partner_id, briefing_date DESC);

-- Ingested data: HNSW index for semantic search
CREATE INDEX IF NOT EXISTS idx_ingested_data_embedding ON public.ingested_data
  USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE public.agent_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingested_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_preferences ENABLE ROW LEVEL SECURITY;

-- Agent definitions: readable by all org members, writable by service_role only
CREATE POLICY "Agent definitions viewable by org members"
  ON public.agent_definitions FOR SELECT TO authenticated
  USING (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
  );

CREATE POLICY "Agent definitions managed by service role"
  ON public.agent_definitions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Agent outputs: org-scoped, all members can read/interact
CREATE POLICY "Agent outputs viewable by org members"
  ON public.agent_outputs FOR SELECT TO authenticated
  USING (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
  );

CREATE POLICY "Agent outputs updatable by org members"
  ON public.agent_outputs FOR UPDATE TO authenticated
  USING (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
  )
  WITH CHECK (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
  );

CREATE POLICY "Agent outputs managed by service role"
  ON public.agent_outputs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Agent runs: org-scoped read-only for authenticated, full access for service_role
CREATE POLICY "Agent runs viewable by org members"
  ON public.agent_runs FOR SELECT TO authenticated
  USING (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
  );

CREATE POLICY "Agent runs managed by service role"
  ON public.agent_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Ingested data: org-scoped read-only, service_role writes
CREATE POLICY "Ingested data viewable by org members"
  ON public.ingested_data FOR SELECT TO authenticated
  USING (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
  );

CREATE POLICY "Ingested data managed by service role"
  ON public.ingested_data FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Briefings: partner-scoped (only the target partner can see their briefings)
CREATE POLICY "Briefings viewable by target partner"
  ON public.briefings FOR SELECT TO authenticated
  USING (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
    AND partner_id = (SELECT auth.uid())
  );

CREATE POLICY "Briefings managed by service role"
  ON public.briefings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Partner preferences: partner-scoped (only the partner can see/edit their prefs)
CREATE POLICY "Partner preferences viewable by partner"
  ON public.partner_preferences FOR SELECT TO authenticated
  USING (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
    AND partner_id = (SELECT auth.uid())
  );

CREATE POLICY "Partner preferences updatable by partner"
  ON public.partner_preferences FOR UPDATE TO authenticated
  USING (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
    AND partner_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_user_allowed()
    AND organization_id = public.get_user_organization_id()
    AND partner_id = (SELECT auth.uid())
  );

CREATE POLICY "Partner preferences managed by service role"
  ON public.partner_preferences FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- Seed Data: Agent Definitions
-- ============================================

INSERT INTO public.agent_definitions (id, organization_id, display_name, persona, tool_set, data_sources, output_scope, triggers, baseline_tasks, config)
VALUES
  (
    'ea',
    '00000000-0000-0000-0000-000000000001',
    'Executive Assistant',
    E'You are Ember EA, the personal Executive Assistant for a partner at Caldera.\n\nYour role:\n- Synthesize overnight agent outputs into a clear morning briefing\n- Triage incoming communications by urgency\n- Track EOS commitments (Rocks, To-dos, Scorecard) and surface what needs attention\n- Process natural language commands from your partner via Slack\n- Coordinate with other advisory agents on your partner''s behalf\n\nCommunication style:\n- Direct, concise, no filler\n- Lead with what matters most\n- Use EOS terminology naturally\n- Proactive about deadlines and commitments\n- Flag risks early, suggest solutions',
    ARRAY['generate_briefing', 'process_command', 'query_eos_data', 'search_ingested_data', 'post_to_slack', 'create_issue', 'create_todo', 'request_agent'],
    ARRAY['gmail', 'calendar', 'slack'],
    'user',
    '[{"type": "schedule", "cron": "30 11 * * 1-5", "task": "morning_briefing"}]'::jsonb,
    '[{"task": "morning_briefing", "description": "Generate and deliver three-tier morning briefing"}]'::jsonb,
    '{}'::jsonb
  ),
  (
    'financial-strategist',
    '00000000-0000-0000-0000-000000000001',
    'Financial Strategist',
    E'You are Ember''s Financial Strategist for Caldera, a 14-person software services company.\n\nYour role:\n- Monitor financial health: cash flow, margins, AR aging\n- Analyze client profitability and revenue concentration risk\n- Support the T&M to fixed-fee business model transformation\n- Generate actionable financial insights mapped to EOS constructs\n- Alert on threshold breaches: margin < 30%, AR > 45 days, concentration > 60%\n\nKey context:\n- ~73% revenue from single anchor client ($1.8M). Diversification is existential.\n- Shifting from time-based billing to value-based fixed-fee engagements\n- AI tooling enables faster delivery — margin should improve with speed\n- Three partners: Rich (CEO/CFO), John (Sales), Wade (Ops/Engineering)\n\nOutput requirements:\n- Every insight must map to an EOS construct (Issue, Scorecard metric, Rock recommendation)\n- Include specific numbers and trends, not vague observations\n- Flag anything requiring partner discussion as an Issue for the next L10',
    ARRAY['query_quickbooks', 'calculate_margin', 'forecast_cashflow', 'update_scorecard', 'query_eos_data', 'create_issue', 'create_todo', 'post_to_slack'],
    ARRAY['quickbooks'],
    'org',
    '[{"type": "schedule", "cron": "0 9 * * *", "task": "overnight_analysis"}]'::jsonb,
    '[{"task": "overnight_analysis", "description": "Run daily financial analysis from QuickBooks data"}]'::jsonb,
    '{"thresholds": {"min_margin_pct": 30, "max_ar_days": 45, "max_concentration_pct": 60}}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
