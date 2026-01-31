# ADR-005: Technology Stack
## Architecture Decision Record

**Status:** Accepted  
**Date:** January 30, 2025  
**Decision Makers:** Rich (Caldera)

---

## Context

Ember needs a technology stack that enables rapid development, supports AI-powered features, and can scale with the product's evolution. Caldera's team is familiar with React/Next.js and has strong engineering capability.

Key requirements:
- Fast development (2-week MVP target)
- AI/LLM integration
- Real-time capabilities (future)
- Vector storage for semantic search
- Auth with Google OAuth
- Slack and HubSpot integrations

---

## Decision

**Next.js full-stack with Supabase, Claude API, and Vercel hosting.**

### Core Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14 (React) | Team familiarity, SSR, API routes |
| Styling | Tailwind CSS | Rapid UI development |
| Backend | Next.js API Routes | Unified codebase, serverless |
| Database | Supabase (PostgreSQL) | Auth + DB + Real-time + pgvector |
| Vector Storage | pgvector (via Supabase) | Semantic search, simplicity |
| AI | Claude API (Anthropic) | Best reasoning, long context |
| Auth | Supabase Auth (Google OAuth) | Simple, integrated |
| Hosting | Vercel | Next.js native, edge functions |
| Background Jobs | Vercel Cron + Supabase Functions | Scheduled and triggered processing |

### Supporting Services

| Need | Service | Notes |
|------|---------|-------|
| Slack Integration | Slack API (Bolt) | Direct API, no middleware needed |
| HubSpot Integration | HubSpot API | Direct REST calls |
| File Storage | Supabase Storage | Transcript uploads |
| Email (if needed) | Resend | Transactional emails |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           VERCEL                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Next.js App   │  │   API Routes    │  │  Cron Functions │ │
│  │   (Frontend)    │  │   (Backend)     │  │  (Background)   │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼─────────────────────┼─────────────────────┼─────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │PostgreSQL│  │ pgvector │  │   Auth   │  │ Realtime (future)││
│  │   (DB)   │  │ (Vectors)│  │  (OAuth) │  │   Subscriptions  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
            │                     │
            ▼                     ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│    Claude API     │  │    Slack API      │  │   HubSpot API     │
│    (Anthropic)    │  │                   │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

---

## Rationale

### Why Next.js?
1. **Team familiarity:** Caldera knows React/Next.js
2. **Full-stack in one:** Frontend + API routes = faster development
3. **Vercel optimization:** Deployment, edge functions, caching
4. **React ecosystem:** Rich component libraries available

### Why Supabase Over Alternatives?
| Alternative | Why Not |
|-------------|---------|
| Firebase | Less SQL-friendly, Google lock-in |
| PlanetScale | No vector support, separate auth needed |
| Raw PostgreSQL | More setup, no real-time OOB |
| MongoDB | Less suitable for relational EOS data |

Supabase provides: PostgreSQL + pgvector + Auth + Real-time + Storage in one platform.

### Why Claude API?
1. **Best reasoning:** For coaching, insight generation, complex analysis
2. **Long context:** Can process full transcripts (200K tokens)
3. **Consistency:** Anthropic alignment for professional advice
4. **Team preference:** Caldera building with Claude Code

### Why pgvector Over Pinecone/Weaviate?
1. **Simplicity:** One database for everything
2. **Cost:** Included in Supabase, no separate service
3. **Scale:** Caldera's transcript volume is modest
4. **Flexibility:** Can migrate later if needed

### Why Vercel?
1. **Next.js native:** Best DX for Next.js apps
2. **Serverless:** No server management
3. **Edge functions:** Fast global response
4. **Team familiarity:** Likely already using

---

## Consequences

### Positive
- Rapid development with familiar stack
- Single database for all data types
- Serverless reduces ops burden
- Good DX with Vercel/Supabase integration

### Negative
- Supabase lock-in for auth and real-time
- Vercel costs scale with usage
- pgvector may need migration at extreme scale
- API route cold starts possible (mitigated by Vercel)

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Supabase outage | Data is PostgreSQL—can export/migrate |
| Vercel costs grow | Monitor usage; can self-host Next.js if needed |
| pgvector performance | Index optimization; can migrate to dedicated vector DB |
| Claude API costs | Cache responses; batch where possible |

---

## Implementation Details

### Project Structure

```
/ember
├── /app                    # Next.js App Router
│   ├── /api               # API routes
│   │   ├── /chat          # Chat endpoints
│   │   ├── /transcripts   # Transcript processing
│   │   ├── /eos           # Rocks, Issues, Scorecard
│   │   └── /integrations  # Slack, HubSpot
│   ├── /dashboard         # Main dashboard pages
│   ├── /chat              # Chat interface
│   └── layout.tsx         # Root layout with auth
├── /components            # React components
├── /lib                   # Shared utilities
│   ├── supabase.ts       # Supabase client
│   ├── claude.ts         # Claude API wrapper
│   ├── embeddings.ts     # Vector operations
│   └── eos.ts            # EOS data operations
├── /types                 # TypeScript types
└── /supabase             # Supabase config
    └── /migrations       # Database migrations
```

### Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "@anthropic-ai/sdk": "^0.10.0",
    "@slack/bolt": "^3.0.0",
    "tailwindcss": "^3.0.0",
    "zod": "^3.0.0",
    "date-fns": "^2.0.0"
  }
}
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude
ANTHROPIC_API_KEY=

# Slack
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# HubSpot
HUBSPOT_API_KEY=

# App
NEXTAUTH_SECRET=
```

---

## Database Schema (Core Tables)

```sql
-- Users (managed by Supabase Auth)
-- Extended with profile

CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  role TEXT, -- 'partner'
  created_at TIMESTAMP DEFAULT NOW()
);

-- EOS: V/TO
CREATE TABLE vto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version INT,
  core_values JSONB,
  core_focus JSONB,
  ten_year_target JSONB,
  marketing_strategy JSONB,
  three_year_picture JSONB,
  one_year_plan JSONB,
  issues JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- EOS: Rocks
CREATE TABLE rocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  quarter TEXT, -- 'Q1 2025'
  status TEXT, -- 'on_track', 'off_track', 'complete'
  milestones JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- EOS: Issues
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  priority INT,
  status TEXT, -- 'open', 'discussed', 'solved'
  source TEXT, -- 'manual', 'transcript', 'insight'
  source_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- EOS: To-dos
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  meeting_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- EOS: Scorecard
CREATE TABLE scorecard_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  target DECIMAL,
  frequency TEXT -- 'weekly', 'monthly'
);

CREATE TABLE scorecard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_id UUID REFERENCES scorecard_metrics(id),
  value DECIMAL,
  week_of DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transcripts
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  meeting_date TIMESTAMP,
  participants TEXT[],
  full_text TEXT,
  summary TEXT,
  source TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transcript_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcript_id UUID REFERENCES transcripts(id),
  content TEXT,
  speaker TEXT,
  timestamp_start INT,
  embedding VECTOR(1536)
);

-- Chat
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  role TEXT, -- 'user', 'assistant'
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insights
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT, -- 'pattern', 'suggestion', 'warning'
  title TEXT,
  content TEXT,
  sources JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Alternatives Considered

### Alternative 1: Python Backend (FastAPI)
- **Description:** Separate Python backend for AI processing
- **Rejected because:** Adds complexity; Next.js API routes sufficient for scale

### Alternative 2: Self-hosted PostgreSQL + Dedicated Vector DB
- **Description:** More control over infrastructure
- **Rejected because:** Ops overhead; Supabase provides unified solution

### Alternative 3: OpenAI Instead of Claude
- **Description:** Use GPT-4 for AI capabilities
- **Rejected because:** Team preference for Claude; better long-context handling

### Alternative 4: Railway/Fly.io Hosting
- **Description:** Alternative serverless platforms
- **Rejected because:** Vercel has better Next.js integration; team may already use it

---

## References

- PRD: Ember AI Integrator
- Next.js documentation
- Supabase documentation
- Anthropic Claude API documentation
- Vercel documentation
