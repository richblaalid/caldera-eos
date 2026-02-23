# Integration Documentation: Ember Agent System

**Version:** 1.0
**Date:** February 22, 2026
**Author:** Rich (CEO/Integrator) + Claude AI Strategic Partner

---

## 1. Integration Overview

The Ember Agent System connects to eight external services. This document specifies the integration requirements, authentication methods, data flows, and implementation details for each.

### Integration Priority Order

| Priority | Service | Agent Consumer | Week |
|----------|---------|---------------|------|
| 1 | Gmail (Google API) | EA | Week 1 |
| 2 | Google Calendar (Google API) | EA | Week 1 |
| 3 | Slack (Events API — bidirectional) | EA, All Agents | Week 1 |
| 4 | QuickBooks Online | Financial Strategist | Week 1 |
| 5 | HubSpot CRM | BD Strategist, Financial Strategist | Week 2 |
| 6 | Grain | All Advisors | Week 2 |
| 7 | Google Drive | Operations Architect | Week 2-3 |
| 8 | Gusto | Financial Strategist | Week 3-4 |

---

## 2. Google Workspace Integration (Gmail + Calendar + Drive)

### 2.1 Authentication

Ember already has Google OAuth via Supabase Auth. The agent system requires additional Google API scopes beyond basic authentication.

**Required OAuth Scopes (additions):**
```
https://www.googleapis.com/auth/gmail.readonly        # Read emails
https://www.googleapis.com/auth/gmail.labels           # Manage labels for processed tracking
https://www.googleapis.com/auth/calendar.readonly      # Read calendar events
https://www.googleapis.com/auth/drive.readonly         # Read Drive files
```

**Implementation:**
- Extend existing Google OAuth flow to request additional scopes
- Store refresh tokens securely in Supabase (encrypted)
- Token refresh handled by Google API client library
- Each partner authorizes their own Google account for personalized data access

### 2.2 Gmail Connector

**Purpose:** Ingest emails for EA awareness, action item extraction, and follow-up tracking.

**Data Flow:**
```
Gmail API (polling every 15 min)
    │
    ├── Use history.list() with historyId tracking for incremental sync
    ├── Fetch new message metadata + snippet for triage
    ├── Full message body fetched only for messages classified as actionable
    │
    ▼
Normalization:
    ├── Extract: sender, recipients, subject, date, thread_id
    ├── Classify: client_communication, prospect_inquiry, vendor, internal, newsletter, other
    ├── Extract entities: people, companies, amounts, dates, action items
    ├── Determine relevance: which agents should see this
    │
    ▼
Storage:
    ├── ingested_data table (normalized payload + embedding)
    └── Relevance tags: ['email', 'client', 'financial', 'sales', etc.]
```

**Key Implementation Details:**
```typescript
// /lib/connectors/gmail-connector.ts

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;           // First ~200 chars
  body?: string;             // Full body (fetched selectively)
  date: string;
  labels: string[];
  hasAttachments: boolean;
}

// Polling strategy
async function pullNewEmails(partnerId: string): Promise<GmailMessage[]> {
  // 1. Get last historyId from partner_preferences or connector state
  // 2. Call gmail.users.history.list(historyId) for incremental changes
  // 3. Fetch full message for new messageIds
  // 4. Update stored historyId
  // 5. Return normalized messages
}

// Classification (via Claude Haiku for speed/cost)
async function classifyEmail(message: GmailMessage): Promise<EmailClassification> {
  // Determine: is this actionable? Who should see it? What type?
  // Client emails → EA + relevant advisor
  // Prospect emails → EA + BD Strategist
  // Financial (invoices, payments) → EA + Financial Strategist
  // Newsletters/marketing → filter out unless from tracked competitors
}
```

**Privacy Considerations:**
- Only Rich's email is ingested by default (he's the primary operator)
- John's email ingestion optional (requires his OAuth consent) — valuable for BD Strategist
- Wade's email ingestion optional — less critical for agent system
- Email body content stored encrypted at rest
- Attachments are not downloaded automatically — only metadata

### 2.3 Google Calendar Connector

**Purpose:** Provide EA with daily schedule awareness, meeting prep triggers, and time-sensitive context.

**Data Flow:**
```
Calendar API (polling every 15 min)
    │
    ├── Fetch events for next 7 days
    ├── Detect new, modified, or cancelled events
    ├── Extract attendee information and match to known contacts
    │
    ▼
Processing:
    ├── Identify client/prospect meetings → trigger pre-call brief generation
    ├── Identify internal meetings → check if L10 or EOS ceremony
    ├── Identify 1:1s → surface relevant context for each person
    ├── Time block analysis → flag overbooked days
    │
    ▼
Storage:
    ├── ingested_data table
    └── Trigger events to EA for briefing and prep
```

**Key Implementation Details:**
```typescript
// /lib/connectors/calendar-connector.ts

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;              // ISO datetime
  end: string;
  attendees: Attendee[];
  location?: string;
  meetingLink?: string;       // Zoom/Google Meet link
  isRecurring: boolean;
  eventType: 'client_meeting' | 'internal' | 'l10' | '1on1' | 'external' | 'focus_time';
}

// Attendee matching
async function enrichAttendees(attendees: Attendee[]): Promise<EnrichedAttendee[]> {
  // Match email addresses to:
  // 1. HubSpot contacts (for client/prospect context)
  // 2. Internal team members
  // 3. Unknown → flag for BD Strategist attention
}
```

### 2.4 Google Drive Connector

**Purpose:** Access SOW templates, delivery documents, proposals, and process documentation for Operations Architect and other agents.

**Data Flow:**
```
Drive API (on-demand + daily scan for changes)
    │
    ├── Monitor shared folders for new/modified documents
    ├── Fetch document content when requested by agents
    ├── Index document metadata for search
    │
    ▼
Processing:
    ├── SOW templates → Operations Architect template library
    ├── Proposals → BD Strategist reference material
    ├── Process docs → Operations Architect process knowledge
    ├── Meeting notes → supplement Grain transcripts
    │
    ▼
Storage:
    ├── ingested_data table (metadata + content chunks)
    └── Embeddings for semantic search
```

**Implementation Note:** Google Drive connector is lower priority (Week 2-3) because it's primarily needed for the Operations Architect's SOW drafting capability, not for the EA briefing.

---

## 3. Slack Integration (Extended)

### 3.1 Current State

Ember currently has Slack OAuth with channel posting capability (write-only). The agent system requires bidirectional communication.

### 3.2 Required Slack App Permissions

**Bot Token Scopes (additions to existing):**
```
channels:history          # Read messages in public channels
channels:read             # List channels
chat:write                # Post messages (already have)
groups:history            # Read messages in private channels
groups:read               # List private channels
im:history                # Read DM messages
im:read                   # List DMs
im:write                  # Send DMs
reactions:read            # Read emoji reactions
reactions:write           # Add emoji reactions
users:read                # List users
users:read.email          # Get user emails for matching
```

**Event Subscriptions:**
```
message.im                # DM messages (for command processing)
message.channels          # Channel messages (for context ingestion)
message.groups            # Private channel messages
reaction_added            # Emoji reactions (for quick approvals)
app_mention               # @ember mentions
```

### 3.3 Slack Event Processing

```typescript
// /app/api/agents/events/slack/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  // 1. Verify Slack signature
  const body = await req.text();
  const signature = req.headers.get('x-slack-signature');
  const timestamp = req.headers.get('x-slack-request-timestamp');
  
  if (!verifySlackSignature(body, signature, timestamp)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const event = JSON.parse(body);
  
  // 2. Handle URL verification challenge
  if (event.type === 'url_verification') {
    return NextResponse.json({ challenge: event.challenge });
  }
  
  // 3. Route event to appropriate handler
  const eventType = event.event?.type;
  const channelType = event.event?.channel_type;
  
  if (eventType === 'message' && channelType === 'im') {
    // Partner DM — route to EA command processor
    await processPartnerCommand(event.event);
  } else if (eventType === 'reaction_added') {
    // Check if reaction is on an approval item
    await processReactionApproval(event.event);
  } else if (eventType === 'message') {
    // Channel message — ingest for context
    await ingestSlackMessage(event.event);
  }
  
  return NextResponse.json({ ok: true });
}
```

### 3.4 Slack Block Kit Message Formatting

Morning briefings use Slack Block Kit for structured, interactive messages:

```typescript
// Briefing message structure
function buildBriefingBlocks(briefing: Briefing): SlackBlock[] {
  return [
    // Header
    {
      type: 'header',
      text: { type: 'plain_text', text: `☀️ Good morning, ${briefing.partnerName}` }
    },
    { type: 'divider' },
    
    // Tier 1 - Urgent
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '🔴 *URGENT*' }
    },
    ...briefing.tier1.map((item, i) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: `${i + 1}. ${item.icon} ${item.text}` },
      accessory: item.actionUrl ? {
        type: 'button',
        text: { type: 'plain_text', text: 'View' },
        url: item.actionUrl
      } : undefined
    })),
    
    { type: 'divider' },
    
    // Continue with Tier 2 and 3...
    
    // Footer with interaction hint
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: 'Reply with item numbers: _approve 3, defer 4 to wednesday, dig deeper 5_'
      }]
    }
  ];
}
```

---

## 4. HubSpot CRM Integration

### 4.1 Authentication

**Method:** OAuth 2.0 (HubSpot App)
**Scopes Required:**
```
crm.objects.contacts.read
crm.objects.companies.read
crm.objects.deals.read
crm.objects.deals.write         # For updating deal properties from agent insights
crm.schemas.contacts.read
crm.schemas.companies.read
crm.schemas.deals.read
sales-email-read                # Read sales email activity
```

### 4.2 Data Pull Strategy

```typescript
// /lib/connectors/hubspot-connector.ts

// Polling (every 30 minutes)
async function pullHubSpotUpdates(): Promise<HubSpotUpdate[]> {
  const since = getLastSyncTimestamp('hubspot');
  
  // Pull recently modified deals
  const deals = await hubspot.crm.deals.searchApi.doSearch({
    filterGroups: [{
      filters: [{
        propertyName: 'hs_lastmodifieddate',
        operator: 'GTE',
        value: since.toISOString()
      }]
    }],
    properties: [
      'dealname', 'amount', 'dealstage', 'pipeline',
      'hubspot_owner_id', 'closedate', 'hs_lastmodifieddate',
      'notes_last_updated', 'num_contacted_notes'
    ]
  });
  
  // Pull recent activities (notes, calls, emails, meetings)
  const activities = await hubspot.crm.objects.searchApi.doSearch({
    objectType: 'notes',
    filterGroups: [{
      filters: [{
        propertyName: 'hs_lastmodifieddate',
        operator: 'GTE',
        value: since.toISOString()
      }]
    }]
  });
  
  return normalize(deals, activities);
}
```

### 4.3 Webhook Configuration

Register webhooks for real-time events:

```
POST /api/agents/events/hubspot

Events subscribed:
- deal.propertyChange (dealstage)    → BD Strategist: pipeline movement
- deal.creation                       → BD Strategist: new opportunity
- deal.deletion                       → BD Strategist: lost opportunity cleanup
- contact.creation                    → BD Strategist: new contact
```

### 4.4 Pre-Call Brief Generation

The BD Strategist uses HubSpot data + web research to generate prospect briefs:

```typescript
async function generateProspectBrief(dealId: string, meetingTime: string): Promise<ProspectBrief> {
  // 1. Pull deal and associated contact/company from HubSpot
  const deal = await hubspot.crm.deals.basicApi.getById(dealId, {
    associations: ['contacts', 'companies']
  });
  
  // 2. Pull all activity history on the deal
  const activities = await hubspot.crm.deals.associationsApi.getAll(dealId, 'notes');
  
  // 3. Search for company information online
  const companyIntel = await webSearch(`${deal.company.name} recent news technology`);
  
  // 4. Search Grain transcripts for previous conversations with this contact
  const priorConversations = await searchGrainTranscripts(deal.contact.email);
  
  // 5. Generate brief via BD Strategist agent
  const brief = await invokeAgent({
    agentId: 'bizdev-strategist',
    trigger: 'event',
    triggerContext: {
      task: 'generate_prospect_brief',
      deal,
      activities,
      companyIntel,
      priorConversations,
      meetingTime
    }
  });
  
  return brief;
}
```

---

## 5. QuickBooks Online Integration

### 5.1 Authentication

**Method:** OAuth 2.0
**Required Scopes:** `com.intuit.quickbooks.accounting`

**Implementation Notes:**
- QuickBooks tokens expire every hour — refresh token flow is critical
- Refresh tokens expire after 100 days of non-use — implement keep-alive
- QuickBooks sandbox available for development/testing

### 5.2 Data Pull Strategy

**Batch pull (daily at 4:00 AM):**
```typescript
// /lib/connectors/quickbooks-connector.ts

interface QuickBooksDataPull {
  invoices: Invoice[];           // All invoices (last 90 days)
  payments: Payment[];           // Recent payments
  bills: Bill[];                 // AP items
  profitAndLoss: ProfitAndLoss;  // P&L report
  balanceSheet: BalanceSheet;    // Balance sheet
  accounts: Account[];           // Chart of accounts with balances
}

async function dailyFinancialPull(): Promise<QuickBooksDataPull> {
  const qbo = await getQuickBooksClient();
  
  // Pull invoices with line items
  const invoices = await qbo.findInvoices({
    where: `TxnDate >= '${ninetyDaysAgo()}'`
  });
  
  // Pull payments
  const payments = await qbo.findPayments({
    where: `TxnDate >= '${thirtyDaysAgo()}'`
  });
  
  // Pull P&L report
  const pnl = await qbo.reportProfitAndLoss({
    start_date: quarterStart(),
    end_date: today()
  });
  
  // Pull AR aging
  const arAging = await qbo.reportAgedReceivables({
    aging_period: 30,
    num_periods: 4
  });
  
  return { invoices, payments, pnl, arAging, /* ... */ };
}
```

### 5.3 Financial Metrics Derived

| Metric | Calculation | Frequency | Scorecard? |
|--------|------------|-----------|------------|
| Revenue by client | Sum invoices by customer | Weekly | Yes |
| Effective margin by client | (Revenue - allocated costs) / Revenue | Weekly | Yes |
| AR aging | Days since invoice date for unpaid invoices | Daily | Alert only |
| Cash runway | Current cash / average monthly burn | Weekly | Yes |
| Revenue concentration | Largest client revenue / total revenue | Monthly | Yes |
| Monthly burn rate | Total expenses over trailing 3 months / 3 | Monthly | Yes |
| Payroll-to-revenue ratio | Total payroll / total revenue | Monthly | Yes |

### 5.4 Client Mapping

QuickBooks customer names must be mapped to Caldera's client entities:

```sql
CREATE TABLE client_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  client_name TEXT NOT NULL,             -- Canonical client name
  quickbooks_customer_id TEXT,           -- QBO customer ID
  hubspot_company_id TEXT,               -- HubSpot company ID
  grain_company_name TEXT,               -- How they appear in Grain
  monthly_rate DECIMAL,                  -- For retainer clients
  engagement_type TEXT,                  -- 'retainer', 'fixed_fee', 'time_materials'
  is_anchor_client BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Grain Integration

### 6.1 Current State

Grain is currently available only as a Claude Code MCP tool. The agent system needs programmatic access to meeting transcripts, highlights, and AI-generated notes.

### 6.2 Integration Approach

**Option A — Grain API (if available):**
Use Grain's REST API to pull transcripts automatically after meetings.

**Option B — Grain MCP via Ember (if API is limited):**
The existing MCP integration is dev-only. Extend it to be callable from the agent runtime.

**Option C — Manual Upload (fallback):**
The existing transcript upload pipeline in Ember continues to work. Agents process transcripts regardless of how they arrive.

### 6.3 Transcript Processing Pipeline (Enhanced)

The existing pipeline processes transcripts → chunks → embeddings → extraction. The agent system enhances this:

```
Transcript arrives (API/upload)
    │
    ▼
Chunking + Speaker Detection (existing)
    │
    ▼
Embedding Generation (existing, OpenAI)
    │
    ▼
Multi-Agent Extraction (NEW):
    │
    ├── EA: Action items, follow-ups, decisions, commitments
    ├── BD Strategist: Client needs, objections, competitor mentions, deal signals
    ├── Operations Architect: Scope discussions, delivery concerns, client feedback
    ├── Marketing Strategist: Client language patterns, pain point vocabulary
    ├── Financial Strategist: Budget discussions, pricing conversations, payment mentions
    └── Product Innovation: Feature requests, unmet needs, product opportunity signals
    │
    ▼
Each agent's extractions → agent_outputs table
    │
    ▼
EA synthesizes cross-agent extractions into actionable summary
    │
    ▼
Relevant items → EOS constructs (Issues, To-dos)
    │
    ▼
Notification to partners via Slack
```

---

## 7. Gusto Integration

### 7.1 Authentication

**Method:** OAuth 2.0 (Gusto Partner API)
**Required Scopes:** Read access to payroll, employees, and company data

**Note:** Gusto API access may require Gusto Partner Program enrollment. If API access is limited, fallback to CSV export processing.

### 7.2 Data Pull Strategy

**Weekly batch (Sunday overnight):**
```typescript
async function weeklyGustoPull(): Promise<GustoData> {
  // Employee data
  const employees = await gusto.getEmployees(companyId);
  
  // Recent payrolls
  const payrolls = await gusto.getPayrolls(companyId, {
    start_date: thirtyDaysAgo(),
    end_date: today()
  });
  
  // Benefits enrollment (quarterly)
  const benefits = await gusto.getBenefits(companyId);
  
  return { employees, payrolls, benefits };
}
```

### 7.3 Metrics Derived

| Metric | Use |
|--------|-----|
| Total payroll cost | Financial Strategist: burn rate calculation |
| Cost per employee | Financial Strategist: margin analysis |
| Contractor costs | Financial Strategist: variable cost tracking |
| Headcount | EA: team size for briefings |
| Benefits costs | Financial Strategist: total comp analysis |

### 7.4 Fallback: CSV Import

If Gusto API access is unavailable or delayed:
```
1. Rich exports payroll summary CSV from Gusto monthly
2. Upload to Ember via existing file upload UI
3. CSV connector parses and normalizes
4. Financial Strategist processes as batch data
```

---

## 8. Cross-Integration Data Flows

### 8.1 Client 360 View

Multiple integrations combine to create a holistic client picture:

```
CLIENT: [Anchor Client]
    │
    ├── HubSpot: Deal status, contact history, recent activities
    ├── QuickBooks: Revenue ($1.8M/yr), invoicing status, payment history
    ├── Grain: Meeting transcripts, sentiment, discussion topics
    ├── Gmail: Communication frequency, response times, open threads
    ├── Calendar: Meeting frequency, upcoming meetings, attendee patterns
    └── Ember EOS: Related Rocks, Issues, Scorecard metrics
    │
    ▼
Financial Strategist:  Margin analysis, revenue trend, AR status
BD Strategist:         Relationship health, expansion opportunities
Operations Architect:  Delivery quality, scope adherence
EA:                    Synthesized client health score for briefing
```

### 8.2 Sales Pipeline to Delivery Handoff

```
HubSpot: Deal moves to "Closed Won"
    │
    ├── BD Strategist: Logs win, updates pipeline metrics
    ├── Financial Strategist: Adds expected revenue to forecast
    ├── Operations Architect: Triggers SOW finalization workflow
    │   ├── Pulls deal data from HubSpot
    │   ├── Pulls call transcripts from Grain
    │   ├── Pulls SOW template from Google Drive
    │   └── Generates draft SOW for review
    └── EA: Notifies Wade about incoming project, adds onboarding to-dos
```

### 8.3 Meeting Intelligence Flow

```
Calendar: Upcoming meeting with [Prospect] detected
    │
    ├── Calendar Connector: Extracts attendees, matches to HubSpot contacts
    ├── HubSpot Connector: Pulls deal context, activity history
    ├── Grain: Searches for prior meeting transcripts with same contact
    ├── Web: Researches company recent news
    │
    ▼
BD Strategist: Generates pre-call brief
    │
    ▼
EA: Pushes brief to John's Slack DM 30 min before meeting
    │
    ▼
[Meeting happens — Grain records]
    │
    ▼
Grain Connector: Transcript available
    │
    ▼
Multi-agent transcript processing
    │
    ▼
EA: Pushes post-meeting summary with action items
Operations Architect: Drafts SOW if engagement discussed
BD Strategist: Updates HubSpot deal stage recommendation
```

---

## 9. API Rate Limits and Throttling

| Service | Rate Limit | Strategy |
|---------|-----------|----------|
| Gmail API | 250 quota units/second | History-based incremental sync minimizes calls |
| Google Calendar | 500 requests/100 seconds | 15-min polling is well within limits |
| Google Drive | 12,000 requests/minute | On-demand access, not bulk scanning |
| Slack Events API | No rate limit on receiving | N/A |
| Slack Web API | Tier 2-4 depending on method | Batch messages, respect retry-after headers |
| HubSpot API | 100 calls/10 seconds | Batch reads, webhook-driven where possible |
| QuickBooks API | 500 calls/minute | Daily batch only — well within limits |
| Gusto API | Varies by endpoint | Weekly batch only — well within limits |
| Claude API | Based on tier | Monitor token usage, use appropriate model per task |

---

## 10. Environment Variables Required

```bash
# Existing (already in Ember)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# New (agent system additions)
GOOGLE_CLIENT_ID=                    # May already exist for auth
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
HUBSPOT_APP_ID=

QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REALM_ID=                 # Company ID
QUICKBOOKS_ENVIRONMENT=              # 'sandbox' or 'production'

GUSTO_CLIENT_ID=
GUSTO_CLIENT_SECRET=

GRAIN_API_KEY=                       # If API access available

# Agent system config
AGENT_BRIEFING_TIMEZONE=America/New_York
AGENT_BRIEFING_TIME=07:00
AGENT_OVERNIGHT_START=04:00
AGENT_DEFAULT_MODEL=claude-sonnet-4-20250514
AGENT_PREMIUM_MODEL=claude-opus-4-20250514
AGENT_FAST_MODEL=claude-haiku-4-5-20251001
```

---

## 11. Testing Strategy

### 11.1 Connector Testing

Each connector has integration tests against sandbox/test accounts:
- QuickBooks Sandbox for financial data
- HubSpot Developer Test Account for CRM data
- Gmail test account with seeded emails
- Slack test workspace (existing in Ember)

### 11.2 Agent Testing

- Agent prompts tested with representative scenarios before deployment
- Agent outputs validated against expected EOS construct format
- Briefing generation tested with mock data across all tiers
- Command parser tested with corpus of natural language variations

### 11.3 End-to-End Testing

- Full overnight pipeline: data pull → agent analysis → briefing generation → Slack delivery
- Full approval flow: briefing item → Slack reply → state update → action execution
- Full transcript flow: Grain upload → multi-agent extraction → EOS item creation → partner notification
