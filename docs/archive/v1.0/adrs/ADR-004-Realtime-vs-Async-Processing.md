# ADR-004: Real-time vs Async Processing
## Architecture Decision Record

**Status:** Accepted  
**Date:** January 30, 2025  
**Decision Makers:** Rich (Caldera)

---

## Context

Ember needs to process meeting transcripts, generate insights, and support real-time interactions. The architecture must balance responsiveness with processing complexity.

Key tension:
- User wants: "AI in the room, not reviewing the tape afterwards"
- Reality: Real-time transcript processing is significantly more complex
- MVP timeline: Need to ship quickly and iterate

---

## Decision

**Phased approach: Start with async processing, architect for real-time expansion.**

### Processing Model by Feature

| Feature | MVP (Phase 1) | Target (Phase 2) | Future (Phase 3) |
|---------|---------------|------------------|------------------|
| Transcript Analysis | Post-meeting batch | Near-real-time | Live streaming |
| Chat Responses | Real-time | Real-time | Real-time |
| Insights Generation | Async (hourly) | Async (on change) | Real-time triggers |
| Slack Notifications | Scheduled | Event-driven | Real-time |
| Meeting Participation | None | Listen + respond | Active facilitation |

### MVP Architecture (Async-First)

```
[Meeting Ends] 
    → [Transcript Uploaded] 
    → [Background Job: Process]
    → [Background Job: Generate Insights]
    → [Update Dashboard]
    → [Notify via Slack]
```

### Target Architecture (Hybrid)

```
[Meeting Live]
    → [Grain/Tool streams transcript]
    → [Real-time buffer (30s chunks)]
    → [Quick analysis: topics, decisions]
    → [Available for queries]
    
[Meeting Ends]
    → [Full transcript assembled]
    → [Deep analysis: patterns, issues]
    → [Generate comprehensive insights]
```

---

## Rationale

### Why Async First?
1. **Speed to market:** Can ship tracking features in days, not weeks
2. **Technical simplicity:** No websocket infrastructure, streaming pipelines
3. **Cost efficiency:** Batch processing uses API calls more efficiently
4. **User value still delivered:** Prep materials and insights don't need to be instant

### Why Architect for Real-time?
1. **User stated goal:** "AI in the room" is the vision
2. **Competitive advantage:** Most EOS tools are purely async
3. **Avoid rework:** Building async-only would require significant refactoring later

### Why Hybrid Rather Than Full Real-time?
1. **Deep insights need full context:** Can't fully analyze a meeting until it's complete
2. **Resource constraints:** Real-time processing of every word is expensive
3. **Practical balance:** Quick awareness during meeting + deep analysis after

---

## Consequences

### Positive
- Fast MVP delivery
- Lower initial complexity
- Clear upgrade path
- Cost-controlled

### Negative
- MVP won't have "live" feel during meetings
- Insights delayed until post-meeting processing
- Real-time features require additional development later

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Users disappointed by async MVP | Set clear expectations; deliver prep value early |
| Architecture doesn't support real-time | Design data models and APIs with real-time in mind |
| Async processing is too slow | Parallelize; prioritize critical paths |

---

## Implementation Details

### MVP: Background Job System

```typescript
// Job Queue (using Supabase Edge Functions + pg_cron or similar)

// Job: Process Transcript
async function processTranscript(transcriptId: string) {
  const transcript = await getTranscript(transcriptId);
  const chunks = chunkTranscript(transcript.text);
  const embeddings = await generateEmbeddings(chunks);
  await storeChunks(transcriptId, chunks, embeddings);
  await extractDecisions(transcriptId);
  await detectIssues(transcriptId);
  await updateMeetingSummary(transcriptId);
}

// Job: Generate Insights
async function generateInsights() {
  const recentData = await getRecentActivity();
  const insights = await analyzePatterns(recentData);
  await storeInsights(insights);
  await notifyIfUrgent(insights);
}

// Scheduled: Every hour
scheduleJob('generate-insights', '0 * * * *', generateInsights);
```

### Target: Real-time Transcript Buffer

```typescript
// WebSocket connection to Grain or recording service

interface TranscriptChunk {
  timestamp: number;
  speaker: string;
  text: string;
}

class MeetingSession {
  private buffer: TranscriptChunk[] = [];
  private analysisInterval: NodeJS.Timer;
  
  onChunk(chunk: TranscriptChunk) {
    this.buffer.push(chunk);
    
    // Quick analysis every 30 seconds
    if (this.buffer.length % 10 === 0) {
      this.quickAnalyze();
    }
  }
  
  async quickAnalyze() {
    // Fast: topic detection, decision flagging
    // Not deep pattern analysis
  }
  
  async onMeetingEnd() {
    // Full analysis with complete context
  }
}
```

### API Design for Future Real-time

```typescript
// Design APIs to support both sync and async

// POST /api/transcript - works for both upload and stream
interface TranscriptInput {
  meetingId: string;
  content: string | ReadableStream;
  isComplete: boolean;
}

// GET /api/meetings/:id/status - works during and after
interface MeetingStatus {
  state: 'live' | 'processing' | 'complete';
  topics: string[];
  decisions: Decision[];
  insights: Insight[];
  lastUpdated: Date;
}
```

---

## Processing Priorities

When resources are constrained, prioritize:

1. **Real-time chat responses** — Users waiting for answer
2. **Meeting prep generation** — Time-sensitive for upcoming meetings
3. **Insight generation** — Important but can be slightly delayed
4. **Historical analysis** — Background, no urgency

---

## Estimated Timeline

| Phase | Features | Timeline |
|-------|----------|----------|
| MVP | Upload transcript, async processing, dashboard | Week 1-2 |
| Hybrid | Near-real-time transcript availability | Week 3-4 |
| Real-time | Live meeting queries, streaming insights | Month 2+ |

---

## Alternatives Considered

### Alternative 1: Real-time Only
- **Description:** Build for live participation from day 1
- **Rejected because:** Too complex for MVP timeline; delays value delivery

### Alternative 2: Async Only (No Real-time Path)
- **Description:** Commit to post-meeting processing only
- **Rejected because:** Doesn't match user vision; limits product potential

### Alternative 3: Third-party Real-time Service
- **Description:** Use specialized service for real-time processing
- **Rejected because:** Added cost and complexity; Caldera scale doesn't justify

---

## References

- PRD: Ember AI Integrator
- Caldera Partner Interview (January 30, 2025)
- Supabase Edge Functions documentation
- Grain API documentation
