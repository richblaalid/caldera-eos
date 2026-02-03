---
description: Manage Architecture Decision Records for Ember - identify, discuss, and document architectural choices
argument-hint: [status|next|new <topic>|identify|<number>]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Bash(mkdir:*), AskUserQuestion
---

# ADR Management Command

Identify, discuss, and document Architecture Decision Records for Ember. This skill handles:

- **Existing ADRs** (decisions already documented)
- **New architectural decisions** as they arise during development

## Usage

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `/adr` or `/adr status` | Show all ADRs and their status             |
| `/adr next`             | Work on the next pending PRD Section 8 ADR |
| `/adr new <topic>`      | Create a new ADR for any topic             |
| `/adr identify`         | Scan PRD for decisions that need ADRs      |
| `/adr 001`              | Work on a specific ADR by number           |

## Examples

```
/adr                     # See current status
/adr next                # Start next PRD ADR (e.g., ADR-001)
/adr new authentication  # Document the BetterAuth decision
/adr new image-hosting   # Create ADR for a new decision
/adr identify            # Find undocumented decisions in PRD
/adr 005                 # Work specifically on embedding model ADR
```

## Existing ADRs

| ADR | Topic | Status |
|-----|-------|--------|
| ADR-001 | AI Persona & Interaction Model | Accepted |
| ADR-002 | Data Ingestion Architecture | Accepted |
| ADR-003 | Privacy & Access Model | Accepted |
| ADR-004 | Real-time vs Async Processing | Accepted |
| ADR-005 | Technology Stack | Accepted |

### Future ADRs (006+)

New architectural decisions that arise during development.

## Workflow

1. **Check Status**: Glob `docs/adrs/ADR-*.md` and read frontmatter
2. **Gather Context**: Read relevant sections from PRD.md and product-plan.md
3. **Discuss**: Ask clarifying questions appropriate to the ADR type
4. **Recommend**: Present options with pros/cons and make a recommendation
5. **Document**: Generate ADR using the template
6. **Track**: Update `docs/adrs/README.md`

## Key Files

- **Skill definition**: `.claude/skills/adr-management/SKILL.md`
- **Template**: `.claude/skills/adr-management/references/TEMPLATE.md`
- **Questions**: `.claude/skills/adr-management/references/QUESTIONS.md`
- **Tracking**: `docs/adrs/README.md`
