# ADR-002: Data Ingestion Architecture
## Architecture Decision Record

**Status:** Accepted  
**Date:** January 30, 2025  
**Decision Makers:** Rich (Caldera)

---

## Context

Ember needs to ingest data from multiple sources to maintain context about Caldera's operations, track EOS components, and surface insights. Sources include meeting transcripts, Slack conversations, HubSpot pipeline data, and financial information.

Key considerations:
- Transcripts may come from multiple sources (Grain, manual upload, future self-recording)
- Real-time ingestion is desired for live meeting participation
- Data must be searchable for context retrieval
- Privacy boundaries must be maintained

---

## Decision

**Implement a flexible, multi-source ingestion architecture with both real-time and batch processing capabilities.**

### Data Sources & Methods

| Source | MVP Method | Future Method | Frequency |
|--------|------------|---------------|-----------|
| Meeting Transcripts | Folder watch / upload | Grain API + self-recording | Per meeting |
| Slack | API polling | Real-time events | Continuous |
| HubSpot | API polling | Webhook events | Hourly |
| Financial Data | CSV upload | API integration | Weekly |
| Historical Context | One-time import | N/A | Once |

### Processing Pipeline

```
[Source] → [Ingestion Layer] → [Processing] → [Storage]
                                    ↓
                              [Vector Embeddings]
                                    ↓
                              [Insight Generation]
```

### Storage Strategy

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| Structured EOS data (Rocks, Issues, etc.) | PostgreSQL (Supabase) | Relational queries, real-time sync |
| Transcripts (full text) | PostgreSQL | Source of truth |
| Transcript chunks (searchable) | pgvector | Semantic search for context retrieval |
| Conversation memory | pgvector | Long-term context for AI |

---

## Rationale

### Why Multi-Source Instead of Single Transcript Focus?
1. **Caldera's context lives across systems:** Sales data in HubSpot, operations in Slack, finances in spreadsheets
2. **Pattern detection requires cross-source correlation:** "Pipeline is down" + "team morale low" might be connected
3. **Scorecard metrics need direct data access:** Can't rely on manual entry for accuracy

### Why Flexible Transcript Ingestion?
1. **Grain is not guaranteed:** User indicated Grain is optional, not required
2. **Manual upload is simplest MVP:** Drop a file, get analysis
3. **Future-proofing:** Architecture should support real-time streaming when ready

### Why Vector Storage for Transcripts?
1. **Semantic search is critical:** "What did we decide about positioning?" requires meaning-based retrieval
2. **Context windows are limited:** Can't stuff every transcript into every prompt
3. **Pattern detection:** Embedding similarity helps find related discussions across time

### Why PostgreSQL + pgvector Over Dedicated Vector DB?
1. **Supabase includes pgvector:** No additional service to manage
2. **Caldera scale is small:** Won't hit limitations of pgvector for years
3. **Simplicity:** One database for everything reduces operational complexity

---

## Consequences

### Positive
- Flexible source support allows iteration on what works
- Vector storage enables powerful context retrieval
- Single database simplifies operations
- Batch + real-time covers all use cases

### Negative
- Multiple integrations increase maintenance burden
- Vector embeddings add processing cost (API calls)
- Data freshness varies by source
- pgvector may need upgrade path if scale increases dramatically

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Integration failures break insights | Each source is independent; partial data still useful |
| Embedding costs scale with transcript volume | Chunk strategically; only embed what's needed |
| Data staleness affects accuracy | Clear timestamps; proactive refresh indicators |

---

## Implementation Details

### Transcript Processing Flow
1. **Receive:** File upload or API fetch
2. **Parse:** Extract text, speaker labels, timestamps
3. **Chunk:** Split into ~500 token chunks with overlap
4. **Embed:** Generate embeddings via Claude/OpenAI API
5. **Store:** Full transcript + chunks + embeddings in Supabase
6. **Index:** Update meeting metadata and relationships

### Slack Ingestion
1. **Initial:** Fetch last N days of leadership channel
2. **Ongoing:** Poll every 5 minutes for new messages
3. **Future:** Real-time with Slack Events API

### HubSpot Ingestion
1. **Deals:** Fetch open deals, amounts, stages
2. **Activities:** Fetch recent meetings, calls, emails
3. **Map:** Link to Caldera's Scorecard metrics

### Financial Data
1. **MVP:** Manual CSV upload with standardized format
2. **Parse:** Extract revenue, utilization, cash flow
3. **Store:** Time-series table for trend analysis

---

## API Requirements

### Slack API
- Scopes: `channels:history`, `channels:read`, `chat:write`, `im:write`
- Endpoints: `conversations.history`, `chat.postMessage`

### HubSpot API
- Scopes: `crm.objects.deals.read`, `crm.objects.contacts.read`
- Endpoints: Deals, Activities

### Grain API (Future)
- Endpoints: Recordings list, transcript fetch
- Webhook: Real-time transcript streaming

---

## Schema Outline

```sql
-- Transcripts
CREATE TABLE transcripts (
  id UUID PRIMARY KEY,
  source TEXT, -- 'grain', 'upload', 'manual'
  meeting_date TIMESTAMP,
  title TEXT,
  participants TEXT[],
  full_text TEXT,
  created_at TIMESTAMP
);

-- Transcript chunks for vector search
CREATE TABLE transcript_chunks (
  id UUID PRIMARY KEY,
  transcript_id UUID REFERENCES transcripts(id),
  chunk_index INT,
  content TEXT,
  speaker TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMP
);

-- Slack messages
CREATE TABLE slack_messages (
  id UUID PRIMARY KEY,
  channel TEXT,
  user_id TEXT,
  user_name TEXT,
  content TEXT,
  timestamp TIMESTAMP,
  embedding VECTOR(1536)
);

-- HubSpot deals (snapshot)
CREATE TABLE hubspot_deals (
  id UUID PRIMARY KEY,
  deal_id TEXT,
  name TEXT,
  amount DECIMAL,
  stage TEXT,
  close_date DATE,
  snapshot_date DATE
);
```

---

## Alternatives Considered

### Alternative 1: Grain-Only Integration
- **Description:** Rely solely on Grain for all meeting data
- **Rejected because:** User indicated Grain is not guaranteed; need flexibility

### Alternative 2: Dedicated Vector Database (Pinecone)
- **Description:** Use Pinecone for all vector storage
- **Rejected because:** Additional service complexity; pgvector sufficient at Caldera scale

### Alternative 3: Real-Time Everything
- **Description:** All integrations via webhooks/events from day 1
- **Rejected because:** Increases complexity; polling is fine for MVP

### Alternative 4: Manual Entry Only
- **Description:** All data entered by users, no integrations
- **Rejected because:** Creates friction; users already have data in other systems

---

## References

- PRD: Ember AI Integrator
- Supabase pgvector documentation
- Slack API documentation
- HubSpot API documentation
