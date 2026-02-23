# System Design Document: Ember Agent System

**Version:** 1.0
**Date:** February 22, 2026
**Author:** Rich (CEO/Integrator) + Claude AI Strategic Partner

---

## 1. System Overview

The Ember Agent System is a multi-agent AI layer built on top of the existing Ember EOS platform. It provides proactive business intelligence, strategic advisory, and operational support to Caldera's three-partner leadership team through six specialized AI agents.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        INTERACTION LAYER                             │
│                                                                      │
│   Slack (Primary)              Ember UI (Deep Work)    Claude Code   │
│   ├── Partner DMs              ├── EOS Dashboard       (Rich's       │
│   ├── Shared Channels          ├── Agent Activity       personal     │
│   ├── Command Processing       ├── Approval Queue       workbench)  │
│   └── Notifications            ├── Document Review                   │
│                                └── Agent Config                      │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────────────┐
│                          AGENT LAYER                                 │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────┐      │
│   │                    ORCHESTRATOR                           │      │
│   │   Scheduler │ Event Router │ Request Dispatcher           │      │
│   └──────────────────────┬───────────────────────────────────┘      │
│                          │                                           │
│   ┌──────────┬───────────┼───────────┬──────────┬──────────┐       │
│   │          │           │           │          │          │        │
│   │  EA      │ Financial │ Marketing │  BizDev  │   Ops    │ Product│
│   │(per user)│ Strategist│ Strategist│ Strategy │ Architect│ Innov. │
│   │          │           │           │          │          │        │
│   └──────────┴───────────┴───────────┴──────────┴──────────┘       │
│                                                                      │
│   Shared Components:                                                 │
│   ├── Agent Runtime (invocation, context assembly, tool execution)   │
│   ├── Prompt Manager (persona loading, shared directive injection)   │
│   ├── Tool Registry (EOS tools, connector tools, Slack tools)        │
│   └── Command Parser (NL Slack replies → structured actions)         │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────────────┐
│                       DATA LAYER                                     │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                  INGESTION PIPELINE                      │       │
│   │                                                          │       │
│   │  Gmail │ Calendar │ Slack │ HubSpot │ QB │ Gusto │ Grain│       │
│   └──────────────────────┬───────────────────────────────────┘       │
│                          │                                           │
│   ┌──────────────────────┴───────────────────────────────────┐      │
│   │                    SUPABASE                               │      │
│   │                                                           │      │
│   │  EOS Tables (existing)    │  Agent Tables (new)           │      │
│   │  ├── vto                  │  ├── agent_definitions        │      │
│   │  ├── rocks                │  ├── agent_outputs            │      │
│   │  ├── scorecard            │  ├── agent_runs               │      │
│   │  ├── issues               │  ├── ingested_data            │      │
│   │  ├── todos                │  ├── briefings                │      │
│   │  ├── meetings             │  ├── approval_queue           │      │
│   │  └── org_checkup          │  └── partner_preferences      │      │
│   │                           │                               │      │
│   │  pgvector (existing)      │  Supabase Auth (existing)     │      │
│   │  └── embeddings           │  └── RLS policies             │      │
│   └───────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agent Runtime

### 2.1 Agent Invocation Flow

```
Trigger (schedule/event/request)
    │
    ▼
Orchestrator receives trigger
    │
    ▼
Orchestrator determines which agent(s) to invoke
    │
    ▼
Agent Runtime assembles context:
    ├── Load agent persona from agent_definitions table
    ├── Inject shared strategic directive
    ├── Query relevant data from ingested_data + EOS tables
    ├── Include recent agent_outputs for continuity
    └── Attach available tools based on agent's tool set
    │
    ▼
Claude API call with assembled context
    │
    ▼
Agent produces output:
    ├── Structured data (metrics, issues, todos)
    ├── Documents (drafts, analyses, briefs)
    ├── Notifications (alerts, reminders)
    └── Requests for other agents or human approval
    │
    ▼
Agent Runtime processes output:
    ├── Write to agent_outputs table
    ├── Execute Zone 1 actions immediately
    ├── Queue Zone 2 actions for approval
    └── Log execution in agent_runs table
```

### 2.2 Agent Runtime Implementation

```typescript
// /lib/agents/agent-runtime.ts

interface AgentInvocation {
  agentId: string;
  trigger: 'schedule' | 'event' | 'request';
  triggerContext: Record<string, any>;   // What triggered this invocation
  requestingAgent?: string;              // If another agent requested this
  requestingPartner?: string;            // If a partner requested this
}

interface AgentResult {
  outputs: AgentOutput[];                // What the agent produced
  notifications: SlackNotification[];    // Messages to send
  eosActions: EOSAction[];               // Issues, todos, scorecard entries to create
  agentRequests: AgentRequest[];         // Requests for other agents
  errors: AgentError[];
}

async function invokeAgent(invocation: AgentInvocation): Promise<AgentResult> {
  // 1. Load agent definition
  const agentDef = await loadAgentDefinition(invocation.agentId);
  
  // 2. Assemble context
  const context = await assembleContext(agentDef, invocation);
  
  // 3. Build system prompt
  const systemPrompt = buildSystemPrompt(agentDef, context);
  
  // 4. Invoke Claude with tools
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',   // Cost-effective for routine tasks
    max_tokens: 4096,
    system: systemPrompt,
    messages: context.messages,
    tools: agentDef.tools,
  });
  
  // 5. Process response
  const result = processAgentResponse(response, agentDef);
  
  // 6. Execute and log
  await executeResult(result, invocation);
  await logRun(invocation, result);
  
  return result;
}
```

### 2.3 Prompt Manager

Agent personas and the shared strategic directive are stored in the database for runtime tuning:

```typescript
// /lib/agents/prompt-manager.ts

interface AgentPrompt {
  persona: string;           // Agent-specific personality and expertise
  sharedDirective: string;   // Company-wide strategic context
  domainContext: string;      // Domain-specific data and recent history
  taskContext: string;        // What this specific invocation is for
}

function buildSystemPrompt(agentDef: AgentDefinition, context: AgentContext): string {
  return `
${agentDef.persona}

## Strategic Context (Shared Across All Agents)
${SHARED_DIRECTIVE}

## Your Current Domain State
${context.domainSummary}

## Today's Task
${context.taskDescription}

## Available Data
${context.availableData}

## Output Format
Produce structured outputs using the tools available to you. Every actionable insight 
should map to an EOS construct (Issue, To-do, Scorecard metric, or Rock recommendation).
Flag items that require human approval before external action.
  `.trim();
}

const SHARED_DIRECTIVE = `
You are an AI advisor for Caldera, a 14-person software services company implementing 
Traction EOS. The three partners are Rich (CEO/CFO/COO/Integrator), John (Sales), and 
Wade (Engineering/Solutions Architect).

CRITICAL STRATEGIC CONTEXT:
1. Revenue concentration risk: ~73% ($1.8M) from a single anchor client. Diversification 
   is existential. Monitor anchor client health vigilantly while actively supporting new 
   revenue streams.
2. Business model transformation: Shifting from time-based billing to value-based fixed-fee 
   engagements. AI tooling enables faster delivery — margin should improve with speed, not 
   decline. Evaluate all opportunities through this lens.
3. Market positioning shift: From "software development services" to "AI-powered product 
   consultancy delivering outcomes." All client-facing language and strategy should reflect 
   this evolution.
4. EOS is the operating rhythm: All your outputs should map to EOS constructs where 
   appropriate — Issues for IDS, Scorecard metrics, Rock recommendations, To-dos.
5. Team of 14: Small, agile, capable. Resource constraints are real. Recommendations must 
   be actionable at this scale.

GOVERNANCE:
- You operate autonomously for internal analysis, research, and draft creation.
- Any external-facing action requires partner approval.
- You never make financial transactions, change access controls, or take HR actions.
- Frame outputs as recommendations, not decisions.
`;
```

### 2.4 Tool Registry

Agents have access to different tools based on their domain:

```typescript
// /lib/agents/tool-registry.ts

const TOOL_SETS = {
  // Tools available to all agents
  common: [
    'create_issue',           // Create EOS Issue with IDS context
    'create_todo',            // Create EOS To-do
    'query_eos_data',         // Read Rocks, Scorecard, Issues, To-dos, V/TO
    'search_ingested_data',   // Semantic search across all ingested data
    'search_eos_knowledge',   // RAG over Traction methodology
    'post_to_slack',          // Send notification to Slack channel
    'request_approval',       // Queue item for partner approval
    'request_agent',          // Ask another agent for input
  ],
  
  // EA-specific tools
  ea: [
    'generate_briefing',      // Compile morning briefing
    'process_command',        // Parse Slack natural language commands
    'update_calendar',        // Read/propose calendar changes
    'manage_approval_queue',  // Route and track approvals
    'query_all_agents',       // Get status from all advisory agents
  ],
  
  // Financial Strategist tools
  financial: [
    'query_quickbooks',       // Read financial data
    'query_gusto',            // Read payroll data
    'calculate_margin',       // Compute margins by client/engagement
    'forecast_cashflow',      // Generate cash flow projections
    'update_scorecard',       // Write financial metrics to Scorecard
  ],
  
  // Marketing Strategist tools
  marketing: [
    'web_search',             // Search for competitor and market information
    'analyze_competitor',     // Structured competitor analysis
    'search_transcripts',     // Mine meeting transcripts for language patterns
    'draft_content',          // Create content drafts
  ],
  
  // BD Strategist tools
  bizdev: [
    'query_hubspot',          // Read CRM data
    'search_companies',       // Research potential partners
    'analyze_pipeline',       // Pipeline health analysis
    'generate_prospect_brief', // Create pre-call preparation brief
    'draft_proposal',         // Draft proposal from templates + context
  ],
  
  // Operations Architect tools
  operations: [
    'query_drive_documents',  // Access SOW templates and delivery docs
    'draft_sow',              // Generate SOW from templates + call data
    'analyze_scope_variance', // Compare delivered vs. scoped work
    'search_transcripts',     // Mine for client feedback patterns
  ],
  
  // Product Innovation Officer tools
  innovation: [
    'web_search',             // Market research and trend scanning
    'analyze_team_skills',    // Map team capabilities
    'model_revenue',          // Financial modeling for product ideas
    'query_bench_time',       // Analyze utilization and available capacity
  ],
};
```

---

## 3. Orchestrator Design

### 3.1 Scheduler

Uses Vercel Cron for scheduled invocations:

```typescript
// vercel.json (additions to existing config)
{
  "crons": [
    {
      "path": "/api/agents/cron/morning-briefing",
      "schedule": "30 6 * * 1-5"          // 6:30 AM weekdays
    },
    {
      "path": "/api/agents/cron/overnight-analysis",
      "schedule": "0 4 * * *"             // 4:00 AM daily
    },
    {
      "path": "/api/agents/cron/data-ingestion",
      "schedule": "*/15 * * * *"           // Every 15 minutes
    },
    {
      "path": "/api/agents/cron/weekly-reports",
      "schedule": "0 6 * * 1"             // 6:00 AM Mondays
    },
    {
      "path": "/api/agents/cron/eos-nudges",
      "schedule": "0 9 * * 1-5"           // 9:00 AM weekdays
    },
    {
      "path": "/api/agents/cron/l10-prep",
      "schedule": "0 7 * * *"             // 7:00 AM daily (checks if L10 is in 3 days)
    }
  ]
}
```

### 3.2 Overnight Analysis Pipeline

```
4:00 AM — Overnight Analysis Begins
    │
    ├── Data Ingestion (parallel)
    │   ├── QuickBooks daily pull
    │   ├── Gmail overnight emails
    │   ├── HubSpot activity sync
    │   └── Web: industry news scan
    │
    ├── Financial Strategist runs (after QuickBooks data arrives)
    │   ├── Calculate margin-by-client
    │   ├── Update cash flow forecast
    │   ├── Check AR aging
    │   └── Generate alerts if thresholds breached
    │
    ├── BD Strategist runs (after HubSpot data arrives)
    │   ├── Pipeline velocity check
    │   ├── Stalled deal detection
    │   └── Generate pre-call briefs for today's meetings
    │
    ├── Marketing Strategist runs (after web scan completes)
    │   ├── Curate industry news for Tier 3 briefing
    │   ├── Competitor activity check
    │   └── Flag anything requiring attention
    │
    ├── Operations Architect runs
    │   ├── Active engagement health check
    │   ├── Scope variance review
    │   └── Upcoming delivery milestones
    │
    └── Product Innovation Officer runs (weekly, not daily)
        ├── Market opportunity scan
        └── Bench time analysis
    │
    ▼
6:30 AM — EA Briefing Generation
    │
    ├── EA collects outputs from all overnight agents
    ├── EA queries Calendar for today's events
    ├── EA queries EOS data for Rock deadlines, To-dos, upcoming meetings
    ├── EA assembles three-tier briefing per partner
    └── EA formats and pushes to Slack
    │
    ▼
7:00 AM — Briefings delivered to partner Slack DMs
```

### 3.3 Event Router

```typescript
// /app/api/agents/events/route.ts

interface AgentEvent {
  source: string;           // 'slack', 'hubspot', 'grain', etc.
  eventType: string;        // 'message', 'deal_stage_change', 'transcript_ready'
  payload: Record<string, any>;
  timestamp: string;
}

const EVENT_ROUTING: Record<string, string[]> = {
  // Slack events
  'slack:message:partner_dm':      ['ea'],
  'slack:message:leadership':      ['ea', 'marketing', 'bizdev'],
  
  // HubSpot events
  'hubspot:deal_stage_change':     ['bizdev', 'financial', 'ea'],
  'hubspot:deal_closed_won':       ['financial', 'operations', 'ea'],
  'hubspot:deal_closed_lost':      ['bizdev', 'ea'],
  'hubspot:new_contact':           ['bizdev'],
  
  // Grain events
  'grain:transcript_ready':        ['ea', 'operations', 'bizdev', 'marketing'],
  
  // QuickBooks events
  'quickbooks:invoice_overdue':    ['financial', 'ea'],
  'quickbooks:payment_received':   ['financial'],
  
  // Internal events
  'eos:rock_milestone_due':        ['ea'],
  'eos:scorecard_missing':         ['ea'],
  'eos:l10_approaching':           ['ea'],
  'agent:approval_expired':        ['ea'],
};
```

---

## 4. Database Schema (New Tables)

```sql
-- Agent Definitions (persona, tools, triggers stored for runtime modification)
CREATE TABLE agent_definitions (
  id TEXT PRIMARY KEY,                    -- 'ea-rich', 'financial-strategist', etc.
  org_id UUID REFERENCES organizations(id),
  display_name TEXT NOT NULL,
  persona TEXT NOT NULL,                  -- System prompt
  tool_set TEXT[] NOT NULL,               -- References to tool registry
  data_sources TEXT[] NOT NULL,           -- Which connectors this agent reads from
  output_scope TEXT NOT NULL CHECK (output_scope IN ('org', 'user')),
  triggers JSONB NOT NULL DEFAULT '[]',   -- Scheduled and event triggers
  baseline_tasks JSONB NOT NULL DEFAULT '[]', -- Recurring automated tasks
  config JSONB DEFAULT '{}',              -- Agent-specific configuration
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Outputs (all work product with approval tracking)
CREATE TABLE agent_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  agent_id TEXT REFERENCES agent_definitions(id),
  output_type TEXT NOT NULL,              -- 'analysis', 'draft', 'alert', 'issue', 'recommendation', 'briefing'
  title TEXT NOT NULL,
  summary TEXT,                           -- Short description for Slack notifications
  content JSONB NOT NULL,                 -- Full output payload
  trust_zone INTEGER NOT NULL CHECK (trust_zone IN (1, 2)),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'completed',        -- Zone 1: done automatically
    'pending_review',   -- Zone 2: awaiting approval
    'approved',         -- Zone 2: approved by partner
    'rejected',         -- Zone 2: rejected by partner
    'deferred',         -- Zone 2: deferred to later
    'expired'           -- Zone 2: approval window passed
  )),
  target_partner UUID REFERENCES auth.users(id),  -- Who should approve
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  deferred_until TIMESTAMPTZ,
  execution_result JSONB,
  related_eos_item_type TEXT,             -- 'issue', 'todo', 'rock', 'scorecard'
  related_eos_item_id UUID,              -- Link to created EOS item
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Agent Execution Log (debugging and performance tracking)
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  agent_id TEXT REFERENCES agent_definitions(id),
  trigger_type TEXT NOT NULL,             -- 'schedule', 'event', 'request'
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

-- Ingested Data (normalized from all external sources)
CREATE TABLE ingested_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  data_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  raw_payload JSONB,
  entities JSONB DEFAULT '{}',
  relevance_tags TEXT[] DEFAULT '{}',
  embedding VECTOR(1536),
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  source_timestamp TIMESTAMPTZ,
  processed_by TEXT[] DEFAULT '{}',
  UNIQUE(org_id, source, source_id)
);

-- Daily Briefings (generated and delivered)
CREATE TABLE briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  partner_id UUID REFERENCES auth.users(id),
  briefing_date DATE NOT NULL,
  tier1_urgent JSONB NOT NULL DEFAULT '[]',
  tier2_business JSONB NOT NULL DEFAULT '[]',
  tier3_industry JSONB NOT NULL DEFAULT '[]',
  agent_work_queue JSONB NOT NULL DEFAULT '[]',
  slack_message_ts TEXT,                  -- Slack message timestamp for threading
  delivered_at TIMESTAMPTZ,
  commands_processed JSONB DEFAULT '[]',  -- Log of partner replies
  UNIQUE(org_id, partner_id, briefing_date)
);

-- Partner Preferences (EA personalization)
CREATE TABLE partner_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  partner_id UUID REFERENCES auth.users(id),
  briefing_time TIME DEFAULT '07:00',
  briefing_timezone TEXT DEFAULT 'America/New_York',
  slack_channel_id TEXT,                  -- Their private EA channel
  notification_level TEXT DEFAULT 'normal', -- 'minimal', 'normal', 'verbose'
  focus_areas TEXT[] DEFAULT '{}',        -- Priority domains
  config JSONB DEFAULT '{}',             -- Additional preferences
  UNIQUE(org_id, partner_id)
);

-- RLS Policies
ALTER TABLE agent_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_preferences ENABLE ROW LEVEL SECURITY;

-- Shared agent outputs visible to all org members
CREATE POLICY "org_agent_outputs" ON agent_outputs
  FOR ALL USING (org_id = auth.jwt() ->> 'org_id');

-- Briefings only visible to the target partner
CREATE POLICY "personal_briefings" ON briefings
  FOR ALL USING (
    org_id = auth.jwt() ->> 'org_id' 
    AND partner_id = auth.uid()
  );

-- Preferences only visible to the partner
CREATE POLICY "personal_preferences" ON partner_preferences
  FOR ALL USING (
    org_id = auth.jwt() ->> 'org_id'
    AND partner_id = auth.uid()
  );
```

---

## 5. API Route Structure

```
/app/api/agents/
├── orchestrator/
│   └── route.ts                 -- Central dispatch endpoint
│
├── cron/
│   ├── morning-briefing.ts      -- Generates and delivers daily briefings
│   ├── overnight-analysis.ts    -- Triggers all advisory agent overnight runs
│   ├── data-ingestion.ts        -- Runs connector pull cycle
│   ├── weekly-reports.ts        -- Weekly synthesis reports
│   ├── eos-nudges.ts            -- Rock/Todo/Scorecard reminders
│   └── l10-prep.ts              -- L10 meeting preparation
│
├── ea/
│   ├── briefing/route.ts        -- Briefing generation and retrieval
│   ├── command/route.ts         -- Process Slack commands
│   └── approval/route.ts       -- Approval queue management
│
├── financial/
│   ├── analysis/route.ts        -- Financial analysis endpoints
│   └── alerts/route.ts          -- Financial alert management
│
├── marketing/
│   ├── intelligence/route.ts    -- Competitive and market intelligence
│   └── content/route.ts         -- Content strategy and drafts
│
├── bizdev/
│   ├── pipeline/route.ts        -- Pipeline analysis
│   ├── prospects/route.ts       -- Prospect research and briefs
│   └── partnerships/route.ts    -- Partnership strategy
│
├── operations/
│   ├── sow/route.ts             -- SOW drafting and management
│   └── delivery/route.ts        -- Delivery health monitoring
│
├── innovation/
│   ├── opportunities/route.ts   -- Product opportunity identification
│   └── analysis/route.ts        -- Market and technology analysis
│
└── events/
    ├── slack/route.ts           -- Slack Events API handler
    ├── hubspot/route.ts         -- HubSpot webhook handler
    └── grain/route.ts           -- Grain webhook handler

/lib/
├── agents/
│   ├── agent-runtime.ts         -- Core agent invocation logic
│   ├── prompt-manager.ts        -- Persona and directive management
│   ├── tool-registry.ts         -- Tool definitions and access control
│   └── command-parser.ts        -- NL command processing
│
└── connectors/
    ├── gmail-connector.ts
    ├── calendar-connector.ts
    ├── slack-connector.ts
    ├── hubspot-connector.ts
    ├── quickbooks-connector.ts
    ├── gusto-connector.ts
    ├── grain-connector.ts
    └── drive-connector.ts
```

---

## 6. Model Selection Strategy

Not all agent tasks require the most powerful (or expensive) model:

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Strategic analysis, complex reasoning | Claude Opus 4 | Highest quality for nuanced business strategy |
| SOW drafting, report generation | Claude Sonnet 4 | Good quality at lower cost for document generation |
| Data extraction, normalization | Claude Sonnet 4 | Structured output tasks don't need full reasoning |
| Slack command parsing | Claude Haiku 4.5 | Fast, cheap, focused parsing task |
| Embedding generation | OpenAI text-embedding-3-small | Already in Ember's stack |
| Morning briefing synthesis | Claude Sonnet 4 | Balances quality and cost for daily generation |

Estimated daily API cost (steady state): $15-30/day based on 6 agents running daily cycles with ad-hoc invocations. Monitor and optimize as usage patterns emerge.

---

## 7. Error Handling and Resilience

### 7.1 Graceful Degradation

```
If Gmail connector fails:
  → Briefing generates without email data
  → Note in briefing: "⚠️ Email data unavailable — check manually"
  → System alert to Rich

If Claude API is down:
  → Cron jobs queue and retry with exponential backoff
  → Slack notification: "Ember agents are temporarily offline"
  → Manual fallback: partners can still access Ember UI for EOS data

If Slack API fails:
  → Briefings queued for delivery when Slack recovers
  → Email fallback for critical alerts (Phase 2)
  → Agent work continues — just delivery is delayed
```

### 7.2 Agent Error Isolation

Each agent runs independently. A failure in the Financial Strategist does not affect the BD Strategist or EA. The orchestrator logs errors per agent and continues processing other agents in the pipeline.

### 7.3 Monitoring

```typescript
// System health check endpoint
// /app/api/agents/health/route.ts

interface SystemHealth {
  agents: Record<string, {
    lastRun: string;
    lastRunStatus: 'completed' | 'failed';
    averageDuration: number;
    errorRate: number;       // Last 7 days
  }>;
  connectors: Record<string, {
    lastSync: string;
    status: 'healthy' | 'degraded' | 'failed';
    lastError?: string;
  }>;
  briefings: {
    todayDelivered: boolean;
    deliveryTime?: string;
  };
}
```

---

## 8. Security Considerations

### 8.1 API Credential Management

- All external API credentials stored as Vercel environment variables
- OAuth tokens (Google, Slack, HubSpot) refreshed automatically via refresh token flow
- QuickBooks and Gusto tokens managed through their respective OAuth implementations
- No credentials stored in database or logged in agent_runs

### 8.2 Data Access Control

- Supabase RLS enforced on all tables — agents operate within org context
- Financial data (QuickBooks, Gusto) accessible only to Financial Strategist and partner EAs
- Ingested email content encrypted at rest in Supabase
- Agent outputs inherit the access scope of their agent definition (org or user)

### 8.3 Slack Security

- Slack Events API signature verification on all incoming webhooks
- Bot tokens scoped to minimum required permissions
- Partner DM channels are private — only the partner and the Ember bot
- No sensitive financial data in Slack messages — deep links to Ember instead
