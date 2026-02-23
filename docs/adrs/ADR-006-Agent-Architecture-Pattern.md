# ADR-006: Agent Architecture Pattern

**Status:** Accepted
**Date:** February 22, 2026
**Decision Makers:** Rich (CEO/Integrator)
**Context:** Ember Agent System — foundational architecture decision

---

## Context

Ember needs to support six AI agents (1 personal EA per partner + 5 shared advisory agents) that operate proactively, process data from multiple sources, and coordinate their outputs. We need to decide the fundamental architecture pattern for how these agents are structured, how they communicate, and how they're orchestrated.

### Options Considered

**Option A: Monolithic Agent with Role Switching**
A single Claude instance with a massive system prompt that contains all six agent personas. It switches roles based on context. Simple to build, but creates a context window bottleneck, makes it impossible to run agents in parallel, and produces a fragile mega-prompt.

**Option B: Independent Agent Microservices**
Each agent runs as an independent service with its own API, data access, and scheduling. Maximum isolation but heavy infrastructure overhead, complex inter-agent communication, and expensive to maintain for a small team.

**Option C: Orchestrated Agent Pool (Selected)**
A lightweight orchestration layer manages agent invocations. Each agent is defined by its persona prompt, tool set, and data access scope. Agents are invoked by the orchestrator based on schedules, triggers, or requests from other agents. They share a common database (Supabase) but have scoped access.

## Decision

**Option C — Orchestrated Agent Pool** with the following structure:

```
                    ┌─────────────────────┐
                    │    ORCHESTRATOR     │
                    │  (Scheduler +       │
                    │   Event Router)     │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
    ┌─────┴─────┐       ┌─────┴─────┐        ┌─────┴─────┐
    │    EA     │       │  Advisory  │        │  Advisory  │
    │  (per     │       │  Agent 1   │        │  Agent N   │
    │  partner) │       │            │        │            │
    └─────┬─────┘       └─────┬─────┘        └─────┬─────┘
          │                    │                     │
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   SHARED DATA LAYER │
                    │   (Supabase +       │
                    │    pgvector)        │
                    └─────────────────────┘
```

### Orchestration Model

**Scheduled Invocations:**
- Cron-based triggers for recurring tasks (morning briefings, overnight data processing, weekly reports)
- Uses Vercel Cron (already in Ember's stack)

**Event-Driven Invocations:**
- Webhook receivers for real-time events (new Slack message, HubSpot deal update, Grain transcript available)
- Event router determines which agent(s) should process the event

**Request-Driven Invocations:**
- Partner asks a question in Ember chat → orchestrator routes to the appropriate agent
- EA needs input from an advisory agent → orchestrator invokes the advisor
- One agent's output triggers another agent's workflow

### Agent Definition Structure

Each agent is defined by:

```typescript
interface AgentDefinition {
  id: string;                          // e.g., "financial-strategist"
  persona: string;                     // System prompt defining personality and expertise
  sharedDirective: string;             // The company-wide strategic context all agents share
  tools: AgentTool[];                  // Functions the agent can call (DB writes, API calls, Slack posts)
  dataSources: DataSourceConfig[];     // What data the agent can read
  outputScope: 'org' | 'user';        // Whether outputs are shared or personal
  triggers: TriggerConfig[];           // Scheduled and event-based activation rules
  baselineTasks: BaselineTask[];       // Recurring work the agent does automatically
}
```

## Consequences

**Positive:**
- Agents can run in parallel (overnight processing of all advisors simultaneously)
- Each agent has a focused context window (no mega-prompt)
- New agents can be added without modifying existing ones
- Agent definitions stored in database enable runtime tuning without redeployment
- Fits naturally into Ember's existing Vercel + Supabase architecture

**Negative:**
- Orchestrator is a single point of failure (mitigated by robust error handling and alerting)
- Inter-agent communication adds latency compared to monolithic approach
- More complex to debug multi-agent workflows than single-agent flows

**Risks:**
- Agent context windows may still be large for advisors that need broad data access — mitigate with focused data retrieval per invocation
- Cost management: six agents running daily = significant Claude API usage — monitor and optimize prompt efficiency

---

## Implementation Notes

- The orchestrator is a Next.js API route (or set of routes) that acts as the central dispatcher
- Agent personas are stored in a `agent_definitions` table in Supabase, enabling prompt iteration without code changes
- Agent invocations are logged in an `agent_runs` table for debugging and performance tracking
- The shared directive is injected into every agent's system prompt to ensure strategic alignment
- Vercel Cron handles scheduled invocations; Supabase realtime or webhook endpoints handle event-driven invocations
