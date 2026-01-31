# ADR-001: AI Persona & Interaction Model
## Architecture Decision Record

**Status:** Accepted  
**Date:** January 30, 2025  
**Decision Makers:** Rich (Caldera)

---

## Context

Ember is designed to be an AI-powered EOS Integrator for Caldera. A key early decision is defining how the AI presents itself and interacts with users. This affects user trust, adoption, and the overall effectiveness of the product.

Options range from a passive tool interface to an active AI persona that behaves like a team member.

---

## Decision

**Ember will be positioned as a "fourth partner" with a distinct persona—friendly yet professional, direct rather than acquiescing, and willing to hold the team accountable.**

### Persona Characteristics
- **Name:** Ember
- **Tone:** Warm but not soft. Direct but not harsh.
- **Relationship:** Partner, not servant
- **Behavior:** Will push back, detect avoidance, surface uncomfortable truths
- **Boundaries:** Knows its limits, defers to human judgment on decisions

### Interaction Model: Multi-Channel Presence

| Channel | Purpose | AI Behavior |
|---------|---------|-------------|
| Dashboard | Central tracking hub | Passive display + AI insights feed |
| Chat | Individual conversations | Active dialogue, coaching, Q&A |
| Slack DMs | Personal accountability | Proactive nudges and reminders |
| Slack Group | Leadership channel | Announcements, summaries, insights |
| Meeting | L10 participation | Listen → Answer questions → Eventually participate |

---

## Rationale

### Why "Fourth Partner" Instead of "Tool"?
1. **User research shows** Rich wants an AI that "earns its seat at the table" through insight, not just administration
2. **EOS context:** The Integrator role is explicitly about accountability and integration—a tool doesn't hold you accountable; a partner does
3. **Adoption:** Users are more likely to engage with a named entity that has expectations of them
4. **Differentiation:** Every EOS tool tracks Rocks and Scorecards; none act as a coach

### Why Direct Accountability Over Soft Suggestions?
1. **Caldera's stated need:** "Hold us accountable to commitments"
2. **Pattern from partner transcript:** Team has avoided hard conversations; AI should model directness
3. **EOS philosophy:** The Integrator role is explicitly the "tie-breaker" and accountability holder

### Why Multi-Channel Instead of Single Interface?
1. **Different contexts need different interactions:**
   - Dashboard for review and planning
   - Chat for coaching and questions
   - Slack for in-the-moment reminders
   - Meetings for real-time support
2. **Users already live in Slack** for daily communication
3. **Proactive outreach** (DMs, channel posts) creates accountability without users having to remember to check

---

## Consequences

### Positive
- Clear identity makes interactions predictable and trustworthy
- Multi-channel approach meets users where they are
- Direct accountability aligns with EOS methodology
- Named persona creates emotional engagement and adoption

### Negative
- Higher design/development complexity than a simple dashboard
- Risk of AI feeling "too pushy" if calibration is wrong
- Multi-channel means more integration work
- Persona maintenance across channels requires consistency

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Users reject "pushiness" | Escalation pattern: gentle → direct → pattern observation |
| Inconsistent personality across channels | Single prompt engineering system with channel-specific adaptations |
| Privacy concerns with Slack DMs | Clear communication about what's shared vs. private |

---

## Alternatives Considered

### Alternative 1: Dashboard-Only Tool
- **Description:** Traditional SaaS interface, users come to it
- **Rejected because:** Passive tools get ignored; doesn't match "Integrator" vision

### Alternative 2: Slack Bot Only
- **Description:** Everything through Slack commands and responses
- **Rejected because:** Too limited for V/TO management, Scorecard tracking, complex interfaces

### Alternative 3: Anonymous AI (No Persona)
- **Description:** AI assistant without distinct identity
- **Rejected because:** Reduces engagement; harder to build accountability relationship

### Alternative 4: Aggressive Accountability (Always Direct)
- **Description:** AI immediately calls out issues without escalation
- **Rejected because:** Would damage trust; needs to build relationship first

---

## Implementation Notes

1. **Prompt Engineering:** Develop a core "Ember personality prompt" that:
   - Establishes the partner role
   - Defines tone (warm + direct)
   - Includes EOS expertise
   - Incorporates Caldera-specific context

2. **Channel Adaptation:** Each channel gets a layer on top of core prompt:
   - Chat: Longer, more coaching-oriented
   - Slack DM: Brief, action-focused
   - Slack Group: Summary-oriented, less personal

3. **Escalation Logic:** Build explicit escalation rules:
   - First miss: Private, gentle
   - Second miss: Private, direct
   - Third miss: Pattern observation + L10 prep surfacing

4. **Feedback Loop:** Monitor partner responses to calibrate tone over time

---

## References

- PRD: Ember AI Integrator
- Caldera Partner Interview (January 30, 2025)
- Traction by Gino Wickman (Integrator role definition)
