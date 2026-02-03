# ADR Template

Use this MADR 4.0.0-based template when generating ADR documents.

---

```markdown
---
status: { proposed | accepted | deprecated | superseded }
date: { YYYY-MM-DD }
decision-makers: { list of people involved }
---

# ADR-{NNNN}: {Title}

## Context and Problem Statement

{Describe the architectural decision that needs to be made in 2-3 sentences. Explain the context and why this decision is necessary for Charter Pro.}

## Decision Drivers

- {Driver 1, e.g., "PRD requires type-safe database queries"}
- {Driver 2, e.g., "Team prefers minimal boilerplate"}
- {Driver 3, e.g., "Must support pgvector for embeddings"}
- {Driver 4, e.g., "Single container deployment requirement"}

## Considered Options

1. **{Option 1}**
2. **{Option 2}**
3. **{Option 3}**

## Decision Outcome

**Chosen option:** "{Option N}" because {one sentence justification connecting to decision drivers}.

### Consequences

**Good:**

- {Positive consequence 1}
- {Positive consequence 2}

**Bad:**

- {Negative consequence 1 and how we'll mitigate it}

**Neutral:**

- {Observation that's neither positive nor negative}

### Confirmation

{How will we confirm this decision is correct? What would trigger a revisit?}

## Pros and Cons of the Options

### {Option 1}

{One sentence description}

- Good, because {argument}
- Good, because {argument}
- Neutral, because {argument}
- Bad, because {argument}

### {Option 2}

{One sentence description}

- Good, because {argument}
- Good, because {argument}
- Bad, because {argument}
- Bad, because {argument}

### {Option 3}

{One sentence description}

- Good, because {argument}
- Bad, because {argument}

## More Information

**Related PRD Requirements:**

- {REQ-XXX-NNN: Brief description}
- {REQ-YYY-NNN: Brief description}

**Related ADRs:**

- {ADR-NNN: Title, if applicable}

**References:**

- {Link to relevant documentation or research}
```

---

## Template Usage Notes

### Status Values

- `proposed` - Under discussion, not yet decided
- `accepted` - Decision made and approved
- `deprecated` - Decision no longer applies
- `superseded` - Replaced by a newer ADR (link to it)

### File Naming

Save as: `docs/adrs/ADR-{NNNN}-{kebab-case-title}.md`

Examples:

- `ADR-0001-database-orm-choice.md`
- `ADR-0002-background-job-processing.md`

### Writing Tips

1. **Context**: Be specific about Charter Pro's needs, not generic
2. **Decision Drivers**: Pull directly from PRD requirements and user input
3. **Options**: Include at least the options mentioned in PRD Section 8
4. **Pros/Cons**: Be balanced - every option has trade-offs
5. **Consequences**: Be honest about downsides and mitigations
6. **Confirmation**: Define concrete success criteria

### Linking to PRD

Always connect decisions back to specific PRD requirements:

- Use requirement IDs like `REQ-PERF-001`
- Reference PRD sections like "Section 2.1 Technology Stack"
- Quote design principles where relevant
