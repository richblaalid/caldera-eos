---
name: adr-management
description: |
  Manage Architecture Decision Records - identify, discuss, and document architectural choices.
  Triggers on: ADR, architecture decision, technical decision, design decision, technology choice.

  Use when: making significant technical decisions, documenting architectural choices,
  reviewing existing decisions, or when technical direction needs formal documentation.
---

# ADR Management Skill

Identify, discuss, and document Architecture Decision Records for Ember. ADRs capture important technical decisions with context, rationale, and consequences.

---

## When to Write an ADR

Write an ADR when:
- Choosing between technologies or approaches
- Making decisions that affect multiple components
- Establishing patterns the team should follow
- Documenting constraints or tradeoffs
- Recording decisions that might be questioned later

Don't write an ADR for:
- Implementation details
- Bug fixes
- Minor refactors
- Obvious choices with no alternatives

---

## ADR Lifecycle

```
Draft → Proposed → Accepted/Rejected → Deprecated/Superseded
```

| Status | Meaning |
|--------|---------|
| Draft | Work in progress, not ready for review |
| Proposed | Ready for team discussion |
| Accepted | Decision made, implement accordingly |
| Rejected | Considered but not adopted |
| Deprecated | No longer applies |
| Superseded | Replaced by another ADR |

---

## Existing ADRs (Ember)

| ADR | Topic | Status |
|-----|-------|--------|
| ADR-001 | AI Persona & Interaction Model | Accepted |
| ADR-002 | Data Ingestion Architecture | Accepted |
| ADR-003 | Privacy & Access Model | Accepted |
| ADR-004 | Real-time vs Async Processing | Accepted |
| ADR-005 | Technology Stack | Accepted |

---

## Quick Decision Trees

### "Does this need an ADR?"

```
Decision Check:
├─ Affects multiple components/files?              → Yes, ADR
├─ Team might question this later?                 → Yes, ADR
├─ Multiple valid alternatives exist?              → Yes, ADR
├─ Has significant tradeoffs?                      → Yes, ADR
├─ Establishes a pattern to follow?                → Yes, ADR
├─ Obvious choice, no alternatives?                → No ADR
└─ Implementation detail only?                     → No ADR
```

### "What status should this ADR have?"

```
Status Selection:
├─ Still exploring options?                        → Draft
├─ Ready for team input?                           → Proposed
├─ Team agreed, ready to implement?                → Accepted
├─ Decided against this approach?                  → Rejected
├─ No longer relevant to current system?           → Deprecated
└─ Replaced by a newer decision?                   → Superseded by ADR-XXX
```

---

## ADR Structure

Every ADR should have:

1. **Title** — Clear, descriptive name
2. **Status** — Current lifecycle state
3. **Context** — Why this decision is needed
4. **Decision** — What we decided
5. **Rationale** — Why we chose this option
6. **Consequences** — What results from this decision
7. **Alternatives** — Other options considered

---

## Reference Documentation

| File | Purpose |
|------|---------|
| [references/TEMPLATE.md](references/TEMPLATE.md) | ADR document template |
| [references/QUESTIONS.md](references/QUESTIONS.md) | Discovery questions by topic |
| [references/CHEATSHEET.md](references/CHEATSHEET.md) | Quick reference |

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Decision without context | "We chose X" with no why | Add Context section |
| Missing alternatives | Only shows chosen option | Document what was considered |
| Implementation details | Code-level decisions | Keep ADRs architectural |
| Stale ADRs | Outdated decisions | Update status to Deprecated/Superseded |
| Vague consequences | "This will be good" | Specific positive/negative impacts |

---

## File Naming

```
ADR-{NNN}-{Descriptive-Title}.md

Examples:
ADR-001-AI-Persona-Interaction-Model.md
ADR-006-Authentication-Strategy.md
```

Location: `docs/adrs/`
