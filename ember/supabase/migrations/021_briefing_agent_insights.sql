-- Hybrid Work Queue: Add agent_insights column for per-agent insight summaries.
-- Separates informational zone-1 insights from actionable zone-2 decisions in agent_work_queue.

ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS agent_insights JSONB DEFAULT '[]';

COMMENT ON COLUMN public.briefings.agent_insights IS 'Zone-1 completed agent insights, one per agent, for informational display in briefings';
