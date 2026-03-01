-- Hybrid Work Queue: Add agent_insights column for per-agent insight summaries.
-- Separates informational zone-1 insights from actionable zone-2 decisions in agent_work_queue.

ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS agent_insights JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS agent_work_queue_overflow INTEGER DEFAULT 0;

COMMENT ON COLUMN public.briefings.agent_insights IS 'Zone-1 completed agent insights, one per agent, for informational display in briefings';
COMMENT ON COLUMN public.briefings.agent_work_queue_overflow IS 'Count of decision items beyond the displayed top-10, for overflow hint in Slack';
