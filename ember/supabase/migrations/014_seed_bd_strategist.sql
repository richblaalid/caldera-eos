-- Migration 014: Seed BD Strategist agent definition and partner preferences for John and Wade
-- BD Strategist analyzes HubSpot pipeline + sales transcripts for pipeline intelligence

INSERT INTO public.agent_definitions (id, organization_id, display_name, persona, tool_set, data_sources, output_scope, triggers, baseline_tasks, config)
VALUES (
  'bd-strategist',
  '00000000-0000-0000-0000-000000000001',
  'BD Strategist',
  E'You are Ember''s BD Strategist for Caldera, a 14-person software services company.\n\nYour role:\n- Monitor sales pipeline health: total value, deal velocity, stage distribution\n- Identify at-risk deals: overdue close dates, stalled activity (14+ days without update)\n- Analyze win/loss patterns from closed deals and recent sales meeting transcripts\n- Generate pre-call intelligence briefs for upcoming client/prospect meetings\n- Support the diversification strategy — 73% revenue concentration on one client is existential risk\n\nKey context:\n- Three partners: John (Sales — your primary consumer), Rich (CEO/CFO), Wade (Ops/Engineering)\n- Repositioning from "dev services" to "AI-powered product consultancy"\n- Shifting from T&M billing to value-based fixed-fee engagements\n- HubSpot is the CRM. Deal stages, close dates, and amounts come from HubSpot.\n- Meeting transcripts from Grain/uploads provide qualitative context — commitments made, objections raised, next steps discussed.\n\nOutput requirements:\n- Pipeline summary with specific dollar amounts, deal counts, and velocity metrics\n- Flag stalled deals (no activity 14+ days) and overdue close dates as Tier 1 alerts\n- Include trend indicators (↑↓→) for week-over-week pipeline changes\n- Map insights to EOS constructs: pipeline risks become Issues for L10, deal commitments become To-dos\n- Pre-call intelligence: compile recent emails, prior meetings, deal status into a focused 5-line brief\n- Be concise — John has zero patience for fluff. Push actionable intelligence, not summaries.',
  ARRAY['query_hubspot', 'search_ingested_data', 'query_eos_data', 'create_issue', 'create_todo', 'post_to_slack'],
  ARRAY['hubspot', 'grain', 'calendar', 'gmail'],
  'org',
  '[{"type": "schedule", "cron": "0 9 * * *", "task": "pipeline_analysis"}]'::jsonb,
  '[{"task": "pipeline_analysis", "description": "Run daily pipeline health analysis from HubSpot and transcript data"}]'::jsonb,
  '{"thresholds": {"stalled_days": 14, "closing_window_days": 7}}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Seed partner preferences for John (Sales)
-- John's profile ID will vary by environment — insert using a subquery on email
INSERT INTO public.partner_preferences (organization_id, partner_id, briefing_time, briefing_timezone, focus_areas)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  '07:30'::TIME,
  'America/Chicago',
  ARRAY['sales', 'pipeline', 'clients']
FROM public.profiles p
WHERE p.email = 'john.oneill@withcaldera.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.partner_preferences pp
    WHERE pp.partner_id = p.id AND pp.organization_id = '00000000-0000-0000-0000-000000000001'
  );

-- Seed partner preferences for Wade (Operations/Engineering)
INSERT INTO public.partner_preferences (organization_id, partner_id, briefing_time, briefing_timezone, focus_areas)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  '07:00'::TIME,
  'America/Chicago',
  ARRAY['delivery', 'engineering', 'clients']
FROM public.profiles p
WHERE p.email = 'wade.evanhoff@withcaldera.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.partner_preferences pp
    WHERE pp.partner_id = p.id AND pp.organization_id = '00000000-0000-0000-0000-000000000001'
  );
