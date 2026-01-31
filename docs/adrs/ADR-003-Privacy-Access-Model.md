# ADR-003: Privacy & Access Model
## Architecture Decision Record

**Status:** Accepted  
**Date:** January 30, 2025  
**Decision Makers:** Rich (Caldera)

---

## Context

Ember will have access to sensitive leadership conversations, financial data, and interpersonal dynamics. Clear boundaries around who can access what, and what actions Ember can take autonomously, are critical for trust and adoption.

Key considerations:
- Three partners with equal ownership
- Desire for transparency as default
- Need for private space to think before sharing
- Strict boundary: nothing customer-facing or beyond leadership

---

## Decision

**Transparency as default with private chat space. Ember is strictly internal to leadership. No autonomous external actions.**

### Access Model

| Data/Feature | Rich | John | Wade | Broader Team | External |
|--------------|------|------|------|--------------|----------|
| Dashboard | Full | Full | Full | None | None |
| V/TO | Full | Full | Full | None | None |
| Rocks | Full | Full | Full | None | None |
| Scorecard | Full | Full | Full | None | None |
| Issues | Full | Full | Full | None | None |
| To-dos | Full | Full | Full | None | None |
| Transcripts | Full | Full | Full | None | None |
| Private Chat | Own | Own | Own | None | None |
| Insights | Full | Full | Full | None | None |

### Autonomy Boundaries

| Action | Autonomous | Requires Approval |
|--------|------------|-------------------|
| DM a partner with reminder | ✓ | |
| Post to leadership Slack | ✓ | |
| Surface insights in dashboard | ✓ | |
| Prepare meeting materials | ✓ | |
| Send to broader team channel | | ✓ |
| Email anyone | | Never |
| Customer communication | | Never |
| Modify shared documents | | ✓ |
| External API actions | | Never |

### Private Chat Behavior

Private chats are for preparation, not secrecy:
1. Each partner can chat privately with Ember
2. Content is not shared with other partners unless explicitly requested
3. Ember may prompt: "This seems like something to bring to the group. Want me to add it to the Issues list?"
4. Private chat history is retained for AI context but not exposed in dashboard

---

## Rationale

### Why Full Transparency as Default?
1. **User preference:** Rich explicitly stated "transparency is the rule"
2. **EOS philosophy:** Issues should be visible to solve them
3. **Partnership structure:** Equal partners should have equal access
4. **Avoids politics:** No perception of hidden information

### Why Allow Private Chat?
1. **User preference:** "Leaders can have private chat before bringing to group"
2. **Psychological safety:** Space to work through thoughts before committing
3. **Coaching context:** Some conversations are better 1:1
4. **Reduces friction:** Can explore ideas without group judgment

### Why Strict External Boundary?
1. **User requirement:** "AI should never be visible to customers"
2. **Trust protection:** Single breach would destroy credibility
3. **Legal/reputation risk:** AI actions attributed to company
4. **Control:** Leadership must approve anything that leaves the room

### Why No Autonomous External Actions Ever?
1. **Cannot be undone:** Once sent, can't take back
2. **Context gaps:** AI might misunderstand relationships or timing
3. **Human judgment critical:** External communication requires nuance
4. **User explicit:** "Nothing customer-facing, no communications on behalf"

---

## Consequences

### Positive
- Clear boundaries enable trust
- Transparency prevents politics
- Private space allows coaching relationship
- Strict external boundary protects reputation

### Negative
- No private partner-to-partner spaces (everything shared)
- Private chat could be misused for avoidance (mitigated by Ember's prompts)
- Manual approval required for any team communication

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Partner uses private chat to avoid issues | Ember prompts toward transparency |
| Accidental external exposure | Architecture makes external actions impossible by default |
| Private chat creates information asymmetry | All EOS data remains shared; only conversations are private |

---

## Implementation Details

### Authentication
- Google OAuth via Supabase
- Whitelist: Only Rich, John, Wade email addresses
- No public registration
- Session-based access

### Data Isolation
```
Users
├── rich@caldera.com → Full access, private chat
├── john@caldera.com → Full access, private chat  
└── wade@caldera.com → Full access, private chat

Dashboard Data → Shared view for all
Private Chats → Isolated by user ID
Transcripts → Shared view for all
Insights → Shared view for all
```

### Private Chat Storage
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  role TEXT, -- 'user' or 'assistant'
  content TEXT,
  created_at TIMESTAMP
);

-- Messages only visible to owner via RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_owner ON chat_messages 
  FOR ALL USING (user_id = auth.uid());
```

### Action Approval Flow
For any action requiring approval:
1. Ember proposes action in chat
2. User explicitly confirms
3. Ember executes with audit log
4. Confirmation displayed

### Audit Logging
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  user_id UUID,
  action TEXT,
  details JSONB,
  approved BOOLEAN,
  created_at TIMESTAMP
);
```

---

## Edge Cases

### Partner Disagreement About Sharing
If one partner wants to keep something private that affects others:
- Ember suggests bringing it to the group
- Does not force disclosure
- May note pattern if avoidance becomes chronic

### Ember's Memory Across Private Chats
- Ember remembers private conversations for context
- Does not cross-reference between partners' private chats
- Does not reveal private information in shared contexts

### Sensitive Issue Detection
If Ember detects something in private chat that seems urgent:
- Does not auto-share
- Does prompt user to consider sharing
- "This sounds like something that could affect the partnership. Have you considered discussing with Rich and Wade?"

---

## Alternatives Considered

### Alternative 1: Fully Private Individual Dashboards
- **Description:** Each partner sees only their own data
- **Rejected because:** Contradicts transparency principle; creates information silos

### Alternative 2: Role-Based Permissions
- **Description:** Different access levels based on role (e.g., Integrator sees more)
- **Rejected because:** Equal partnership; no hierarchy in access

### Alternative 3: No Private Chat
- **Description:** Everything shared by default, no private conversations
- **Rejected because:** Removes psychological safety; reduces adoption

### Alternative 4: AI Can Message Team with Approval
- **Description:** Ember could post to team Slack with partner approval
- **Rejected because:** Adds complexity; not needed for MVP; focus on leadership first

---

## References

- PRD: Ember AI Integrator
- Caldera Partner Interview (January 30, 2025)
- Supabase Row Level Security documentation
