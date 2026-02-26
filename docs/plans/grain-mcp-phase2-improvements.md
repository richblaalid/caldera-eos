# Plan: Grain MCP Phase 2 — Leveraging Untapped Capabilities

## Context

The Grain MCP server provides 15+ tools. After Phase 10 implementation, we now use **4 of them** in production via the `grain-mcp-client.ts` wrapper (through the Anthropic MCP Connector API):

| Tool | Used in Production? | Used in `/sync-grain`? |
|------|:-------------------:|:----------------------:|
| `list_meetings` | Yes (cron) | Yes |
| `list_attended_meetings` | No | Yes |
| `fetch_meeting` | No | Yes |
| `fetch_meeting_notes` | Yes (cron) | Yes |
| `fetch_meeting_transcript` | Yes (cron) | Yes |
| `search_meetings` | No | Yes |
| `search_persons` | No | Yes |
| `search_companies` | No | No |
| `list_coaching_feedback` | No | No |
| `fetch_meeting_coaching_feedback` | No (client exists) | No |
| `list_workspace_users` | No | No |
| `list_open_deals` | No | No |
| `list_all_deals` | No | No |
| `fetch_deal` | No | No |
| `myself` | No | No |

**Summary:** We use 4/15 tools in production. 11 tools represent untapped intelligence.

---

## Current Architecture

### What Works Well

1. **Automated transcript ingestion** — `ingest/transcripts/route.ts` runs every 6 hours via Vercel cron:
   - Phase 1: Calls `listMeetings(since)` → `fetchTranscript(id)` → `fetchNotes(id)` via `grain-mcp-client.ts`
   - Phase 2: Runs `transcript-connector.ts` to transform processed transcripts → `ingested_data` for agent pipeline
   - Deduplicates by `title::meeting_date` key

2. **Grain notes parser** — `grain-notes-parser.ts` does deterministic (no-LLM) extraction:
   - Parses section headers, action items, issues, decisions, metrics
   - Pre-populates `extractions` JSONB → skips expensive LLM extraction in processing pipeline
   - Saves ~$0.10-0.50 per transcript in API costs

3. **Meeting classification** — `transcript-connector.ts` classifies meetings as `l10 | sales_call | client_delivery | 1on1 | internal` and tags with relevance tags

4. **Agent consumption** — All 5 agents query `ingested_data` (source: `grain`, data_type: `transcript_summary`) with appropriate filters:
   - EA Briefing: last 48h transcripts
   - BD Strategist: sales-tagged transcripts, last 30 days
   - Operations Architect: delivery-tagged transcripts, last 30 days
   - Meeting Prep: client-matched transcripts, last 90 days
   - L10 Prep: most recent L10 transcript

5. **Grain MCP client** — `grain-mcp-client.ts` handles OAuth token refresh, MCP Connector API calls via Haiku, response parsing

### Architecture Diagram

```
Grain Platform → Grain MCP Server
                      ↓
         [Anthropic MCP Connector API]
                      ↓
            grain-mcp-client.ts (Haiku)
                      ↓
    ┌─────────────────┼──────────────────┐
    ↓                 ↓                  ↓
listMeetings   fetchTranscript    fetchNotes
    ↓                 ↓                  ↓
    └─────→ transcripts table ←──────────┘
                      ↓
         [Processing Pipeline]
         (embeddings + optional LLM)
                      ↓
         transcript-connector.ts
                      ↓
            ingested_data table
                      ↓
    ┌──────┬──────┬──────┬──────┬──────┐
    ↓      ↓      ↓      ↓      ↓      ↓
   EA    BD    Ops   Meeting  L10   Chat
 Brief  Strat  Arch   Prep   Prep   RAG
```

---

## Gap Analysis: Untapped Grain MCP Capabilities

### Gap 1: Sales Coaching Intelligence (HIGH VALUE)

**Tools:** `list_coaching_feedback`, `fetch_meeting_coaching_feedback`

**What Grain offers:** AI-generated sales coaching scorecards for every external/sales meeting. Includes:
- Overall performance score
- Category scores (discovery, objection handling, next steps, etc.)
- Specific coaching recommendations with transcript citations
- Coaching opportunities flagged for manager review

**Current state:** The `grain-mcp-client.ts` has a `fetchCoaching()` method but it's never called by any cron or agent. The coaching data never enters Ember.

**Value for Caldera:**
- John (Sales) gets AI coaching on every client call — directly relevant to his development
- Wade gets visibility into client-facing delivery meetings
- BD Strategist could factor coaching scores into pipeline health assessment
- Morning briefing could surface coaching opportunities ("John had 3 calls yesterday — coaching flags on Acme call")
- Scorecard could track coaching scores as a weekly metric

**Effort:** Low — client method exists, need to add to ingestion cron + wire into agents

### Gap 2: Semantic Meeting Search (MEDIUM VALUE)

**Tool:** `search_meetings`

**What Grain offers:** Semantic search across ALL transcript content. Returns matched sentences with surrounding context. Supports filtering by date, participants, companies, scope (internal/external).

**Current state:** Only used in the manual `/sync-grain search` command. The automated chat RAG system uses local `transcript_chunks` vector search instead.

**Value for Caldera:**
- Chat agent could use Grain search as a secondary search source (broader coverage, no embedding cost)
- Meeting prep could search "all conversations about [client]" semantically rather than relying on title/tag matching
- Operations Architect could search for scope-related discussions without needing exact keywords

**Effort:** Medium — need to integrate as a search backend alongside existing vector search

### Gap 3: Company & Person Intelligence (MEDIUM VALUE)

**Tools:** `search_companies`, `search_persons`

**What Grain offers:** Cross-meeting tracking of companies and people. Can find all meetings where a specific company or person appeared, with filters.

**Current state:** `search_persons` is listed in the sync-grain command but not used programmatically. `search_companies` is completely unused.

**Value for Caldera:**
- Meeting prep: "Show me all prior meetings with Shields" — pulls every interaction across all partners
- BD Strategist: Track engagement frequency per prospect company
- Operations Architect: Track client meeting frequency as a satisfaction proxy
- Relationship intelligence: "We haven't met with MDD in 3 weeks"

**Effort:** Medium — need new data model for relationship tracking or integrate into existing agent queries

### Gap 4: Grain-HubSpot Deal Activity (LOW-MEDIUM VALUE)

**Tools:** `list_open_deals`, `list_all_deals`, `fetch_deal`

**What Grain offers:** HubSpot deals synced into Grain with meeting activity. Shows which meetings are linked to which deals, deal stage, deal risk status.

**Current state:** We pull HubSpot deals directly via the HubSpot connector (`hubspot-connector.ts`). Grain's deal view adds meeting linkage that HubSpot alone doesn't provide.

**Value for Caldera:**
- BD Strategist could correlate deal progress with meeting frequency
- "Deal X has been in stage Y for 3 weeks with only 1 meeting" → risk signal
- Grain flags "at risk" deals based on meeting patterns

**Effort:** Medium — overlaps with existing HubSpot connector, need to merge data

### Gap 5: Workspace User Mapping (LOW VALUE)

**Tool:** `list_workspace_users`

**What Grain offers:** All workspace users with person IDs. Can be used to map Grain users to Ember profiles.

**Current state:** We use name/email matching heuristics in `transcript-connector.ts` and `grain-mcp-client.ts`.

**Value:** Accurate user mapping. Low effort, one-time import.

---

## Recommended Improvements (Prioritized)

### Phase 2A: Sales Coaching Integration (HIGH PRIORITY)

**Goal:** Ingest Grain coaching data and surface in briefings + BD Strategist analysis.

#### Tasks:

1. **Add coaching fetch to transcript ingestion cron**
   - After ingesting transcript + notes, also call `fetchCoaching(meetingId)`
   - Store as separate `ingested_data` record: `source: 'grain', data_type: 'coaching_feedback'`
   - Payload: `{ meeting_title, score, categories, coaching_opportunities, recommendations }`
   - Graceful skip if no coaching data available (not all meetings have it)
   - **File:** `ember/src/app/api/agents/cron/ingest/transcripts/route.ts`

2. **Surface coaching in morning briefing**
   - Add `getRecentCoaching(organizationId)` to ea-briefing data assembly
   - If coaching flags exist from yesterday's meetings, include in Tier 2
   - Personalized: John sees his own coaching, Rich sees all coaching
   - **File:** `ember/src/lib/agents/ea-briefing.ts`

3. **Feed coaching into BD Strategist**
   - When analyzing pipeline health, include coaching data for recent sales calls
   - "John's discovery quality scored 7/10 on the Acme call — follow-up opportunity"
   - **File:** `ember/src/lib/agents/bd-strategist.ts`

4. **Optional: Coaching scorecard metric**
   - Track average coaching score as a weekly Scorecard metric
   - **File:** `ember/src/lib/agents/scorecard-automation.ts`

**Estimated effort:** 3-4 hours
**Estimated value:** High — John gets AI coaching on every call, Rich gets visibility

### Phase 2B: Company/Person-Enriched Meeting Prep (MEDIUM PRIORITY)

**Goal:** Use Grain's cross-meeting company/person search to build richer pre-call briefs.

#### Tasks:

1. **Add Grain search to meeting prep**
   - Before an external meeting, search Grain for all prior meetings with that company
   - Use `search_companies` or `search_meetings` with company name filter
   - Compare against existing `ingested_data` match — Grain search may find meetings we missed in tagging
   - **File:** `ember/src/lib/agents/meeting-prep.ts`

2. **Build relationship frequency tracking**
   - For each active deal/client, track meeting frequency via Grain's company search
   - Flag relationships with declining frequency ("No meetings with ClientX in 21+ days")
   - Feed into Operations Architect for client satisfaction signals
   - **Files:** `ember/src/lib/agents/operations-architect.ts`, `ember/src/lib/agents/bd-strategist.ts`

**Estimated effort:** 4-5 hours
**Estimated value:** Medium — better meeting prep, relationship visibility

### Phase 2C: Grain Semantic Search in Chat RAG (LOWER PRIORITY)

**Goal:** Use Grain's semantic search as a secondary search backend for the chat agent.

#### Tasks:

1. **Add Grain search to hybrid search**
   - In `context.ts` or `hybrid-search.ts`, add Grain `search_meetings` as a third search source
   - Combine with existing vector search (transcript_chunks) and keyword search
   - Useful for questions like "What did John discuss about pricing with Shields?"
   - **File:** `ember/src/lib/context.ts` or `ember/src/lib/hybrid-search.ts`

2. **Rate limit and cache**
   - Grain MCP calls cost per-API-call (Haiku token usage)
   - Cache recent Grain search results
   - Only invoke for questions that clearly reference meetings/conversations

**Estimated effort:** 5-6 hours
**Estimated value:** Medium — better chat answers for meeting-related queries

### Phase 2D: Deal-Meeting Correlation (FUTURE)

**Goal:** Use Grain's deal activity data to correlate HubSpot deals with meeting patterns.

Not recommended for immediate implementation — we already have HubSpot connector providing deal data. Grain's deal activity would be a nice enrichment but overlaps significantly. Consider when we need deeper "which meetings moved this deal forward" analysis.

---

## Architecture Considerations

### MCP Connector API Costs

Each Grain MCP call goes through the Anthropic MCP Connector API with Claude Haiku:
- **Input cost:** ~$0.80/MTok
- **Output cost:** ~$4/MTok
- **Per meeting sync:** ~$0.01-0.05 (list + transcript + notes + coaching = 4 MCP calls)
- **Monthly estimate:** 2-3 meetings/day × 30 days × $0.03 = ~$2-3/month

Adding coaching fetch: +$0.01/meeting = negligible increase.
Adding company search for meeting prep: +$0.01/prep = ~$0.10-0.30/month.

### Token Refresh Reliability

The `grain-mcp-client.ts` implements OAuth token refresh via `GRAIN_MCP_REFRESH_TOKEN`. Monitor for:
- Token refresh failures in production logs
- Grain MCP server URL changes
- Beta API (`mcp-client-2025-11-20`) stability

### Data Freshness

Current 6-hour cron interval is appropriate for transcript ingestion. For coaching data, same interval works — coaching is generated by Grain asynchronously after meetings end.

For meeting prep enrichment (Phase 2B), the search is done in real-time during briefing generation, so freshness is not a concern.

---

## Verification Criteria

### Phase 2A (Coaching)
- [ ] Coaching data appears in `ingested_data` with `data_type: 'coaching_feedback'` after cron runs
- [ ] Morning briefing includes coaching highlights when available
- [ ] BD Strategist analysis references coaching scores for recent sales calls
- [ ] No errors when meetings lack coaching data

### Phase 2B (Company/Person)
- [ ] Meeting prep includes prior meetings found via Grain company search
- [ ] Relationship frequency tracking identifies declining engagement
- [ ] Operations Architect uses meeting frequency as satisfaction proxy

### Phase 2C (Search)
- [ ] Chat agent can answer meeting-related questions using Grain semantic search
- [ ] Grain search results combined with vector search without duplication

---

## Summary

| Phase | Gap | Tools | Priority | Effort | Value |
|-------|-----|-------|----------|--------|-------|
| 2A | Sales coaching | `fetch_meeting_coaching_feedback`, `list_coaching_feedback` | High | 3-4h | High |
| 2B | Company/person intelligence | `search_companies`, `search_persons`, `search_meetings` | Medium | 4-5h | Medium |
| 2C | Chat RAG enhancement | `search_meetings` | Lower | 5-6h | Medium |
| 2D | Deal-meeting correlation | `list_open_deals`, `fetch_deal` | Future | 4-5h | Low-Medium |

**Recommendation:** Start with Phase 2A (coaching). It's highest value, lowest effort, and the client method already exists in `grain-mcp-client.ts`.
