# ADR Template

Use this template for new ADRs in `docs/adrs/`.

---

```markdown
# ADR-{NNN}: {Title}
## Architecture Decision Record

**Status:** {Draft | Proposed | Accepted | Rejected | Deprecated | Superseded by ADR-XXX}
**Date:** {YYYY-MM-DD}
**Decision Makers:** {Names}

---

## Context

{Describe the situation that requires a decision. What problem are we solving? What constraints exist? What forces are at play?}

Key considerations:
- {Consideration 1}
- {Consideration 2}
- {Consideration 3}

---

## Decision

**{One sentence summary of the decision}**

{Detailed description of what we decided and how it will be implemented}

### {Sub-heading if needed}

{Additional details, configurations, or specifications}

---

## Rationale

### Why This Approach?

{Explain why this option was chosen over alternatives}

1. **{Reason 1}:** {Explanation}
2. **{Reason 2}:** {Explanation}
3. **{Reason 3}:** {Explanation}

### Key Factors

| Factor | Weight | How This Decision Addresses It |
|--------|--------|-------------------------------|
| {Factor} | High/Med/Low | {Explanation} |

---

## Consequences

### Positive

- {Benefit 1}
- {Benefit 2}
- {Benefit 3}

### Negative

- {Tradeoff 1}
- {Tradeoff 2}

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| {Risk} | {How we'll handle it} |

---

## Alternatives Considered

### Alternative 1: {Name}

- **Description:** {What this option entails}
- **Pros:** {Benefits}
- **Cons:** {Drawbacks}
- **Rejected because:** {Why we didn't choose this}

### Alternative 2: {Name}

- **Description:** {What this option entails}
- **Rejected because:** {Why we didn't choose this}

---

## Implementation Notes

{Any specific guidance for implementing this decision}

---

## References

- {Link to relevant documentation}
- {Link to related ADRs}
- {Link to external resources}
```
