# ADR Discovery Questions

Use these questions to gather context before writing an ADR.

---

## General Questions (All ADRs)

1. **What problem are we trying to solve?**
2. **What constraints do we have?** (time, budget, team skills, existing systems)
3. **What are the alternatives?**
4. **What are the tradeoffs of each option?**
5. **Is this decision reversible? At what cost?**
6. **Who needs to be involved in this decision?**
7. **What will change if we make this decision?**

---

## By Topic

### Database / Data Storage

- What types of data are we storing?
- What are the access patterns? (read-heavy, write-heavy, mixed)
- Do we need transactions? ACID compliance?
- What's the expected data volume?
- Do we need real-time capabilities?
- What's our query complexity?
- Do we need full-text search? Vector search?
- What's our backup/recovery strategy?

### Authentication / Authorization

- Who are the users? (internal, external, both)
- What identity providers do we need to support?
- Do we need role-based access control (RBAC)?
- What are the session requirements?
- Do we need MFA?
- What's the security compliance requirement?

### API Design

- REST, GraphQL, or RPC?
- Who are the API consumers?
- What's the expected request volume?
- Do we need versioning?
- What authentication method?
- Real-time needs? (WebSockets, SSE)

### Frontend Architecture

- What framework? Why?
- SSR, SSG, or SPA?
- State management approach?
- Component library or custom?
- Styling approach?
- Testing strategy?

### AI / LLM Integration

- Which model(s)?
- Context window requirements?
- Latency requirements?
- Cost constraints?
- Caching strategy?
- Fallback behavior?
- Privacy/data handling?

### Hosting / Infrastructure

- Cloud provider preferences?
- Serverless vs traditional?
- Geographic requirements?
- Scaling expectations?
- Budget constraints?
- Team expertise?

### Integration (Third-Party)

- What APIs do we need to integrate?
- Authentication method for each?
- Rate limits and quotas?
- Data sync frequency?
- Error handling approach?
- Fallback behavior?

---

## After Gathering Context

1. **Summarize the decision space** — What are the viable options?
2. **Identify the key criteria** — What matters most?
3. **Score each option** — How does each option perform on key criteria?
4. **Make a recommendation** — Which option best fits our needs?
5. **Document the decision** — Write the ADR
