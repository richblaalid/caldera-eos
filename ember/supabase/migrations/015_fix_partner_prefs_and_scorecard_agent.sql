-- Migration 015: Fix partner preferences (wrong emails in 014) + add scorecard-automation agent
--
-- Issues fixed:
-- 1. Migration 014 used john@withcaldera.com / wade@withcaldera.com but actual emails are
--    john.oneill@withcaldera.com / wade.evanhoff@withcaldera.com — so no rows were inserted
-- 2. scorecard-automation agent_id missing from agent_definitions — causes FK violation in agent_runs

-- =============================================
-- 1. Insert partner preferences for John (Sales)
-- =============================================
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

-- =============================================
-- 2. Insert partner preferences for Wade (Operations/Engineering)
-- =============================================
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

-- =============================================
-- 3. Add scorecard-automation agent definition
-- =============================================
INSERT INTO public.agent_definitions (id, organization_id, display_name, persona, tool_set, data_sources, output_scope, triggers, baseline_tasks, config)
VALUES (
  'scorecard-automation',
  '00000000-0000-0000-0000-000000000001',
  'Scorecard Automation',
  'Automated weekly scorecard metric computation. Computes metrics from HubSpot deals (weighted pipeline, weekly leads), QuickBooks reports (cash flow runway, net margin), and engagement data (BD outreach activities). Prompts owners via Slack for manual metrics (billable utilization, bench utilization, thought leadership).',
  ARRAY['query_hubspot', 'query_quickbooks', 'query_ingested_data', 'post_to_slack'],
  ARRAY['hubspot', 'quickbooks', 'gmail'],
  'org',
  '[{"type": "schedule", "cron": "0 10 * * 0", "task": "weekly_scorecard"}]'::jsonb,
  '[{"task": "weekly_scorecard", "description": "Compute automated scorecard metrics and prompt owners for manual entries"}]'::jsonb,
  '{"automated_metrics": ["Weighted Pipeline", "Weekly Sales Leads", "Cash Flow Runway", "Net Margin %", "BD Outreach Activities"], "manual_metrics": ["Billable Utilization", "Monthly Thought Leadership Articles", "Bench Utilization Rate"]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
