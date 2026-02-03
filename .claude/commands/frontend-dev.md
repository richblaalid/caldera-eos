---
description: Build React components, pages, and layouts following Ember design conventions
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm run lint:*), Bash(npm run typecheck:*), AskUserQuestion
---

# Frontend Development Command

Build React components, pages, and layouts for Ember following the established design conventions.

## Usage

```
/frontend-dev                    # Start guided component development
/frontend-dev ChatMessage        # Create a specific component
/frontend-dev page /chat         # Create a page component
```

## Workflow

1. **Read Skill Definition**: Start by reading `.claude/skills/frontend-dev/SKILL.md`
2. **Check Existing Patterns**: Look at similar components in `components/`
3. **Plan Component**: Confirm location, props, states needed
4. **Implement**: Follow design conventions strictly
5. **Verify**: Run lint and typecheck, test responsiveness

## Key Files

- **Skill Definition**: `.claude/skills/frontend-dev/SKILL.md`
- **Components Reference**: `.claude/skills/frontend-dev/references/COMPONENTS.md`
- **Design Tokens**: `.claude/skills/frontend-dev/references/DESIGN-TOKENS.md`
- **UI Primitives**: `components/ui/` (when created)

## Quick Rules

- **Colors**: Semantic tokens only (`bg-primary`, NOT `bg-blue-600`)
- **Icons**: Lucide React, icon buttons need `aria-label`
- **States**: Always implement loading, empty, and error states
- **Spacing**: 4px increments (`space-1` through `space-8`)
- **Forms**: `space-y-4` gap, labels with `htmlFor`

See `.claude/skills/frontend-dev/SKILL.md` for complete guidelines.
