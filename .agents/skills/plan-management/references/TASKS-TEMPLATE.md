# Tasks Template

Use this template for `docs/tasks.md`.

---

```markdown
# {Project Name} Task List

## Task Legend

- [ ] Incomplete
- [x] Complete
- [~] Blocked (see notes)

## Phase 0: Foundation

### 0.1 Project Setup
- [ ] **0.1.1** Initialize Next.js project with TypeScript
  - Files: `package.json`, `tsconfig.json`
- [ ] **0.1.2** Configure Tailwind CSS
  - Files: `tailwind.config.js`, `globals.css`
- [ ] **0.1.3** Set up project structure
  - Files: `app/`, `components/`, `lib/`, `types/`

### 0.2 Database Setup
- [ ] **0.2.1** Create Supabase project
  - Notes: Configure in dashboard
- [ ] **0.2.2** Create initial migration
  - Files: `supabase/migrations/001_initial.sql`

**Checkpoint:** Project runs with `npm run dev`, connects to database

---

## Phase 1: {Feature Name}

### 1.1 {Group Name}
- [ ] **1.1.1** {Task description}
  - Files: `{affected files}`
  - Notes: {Optional context}
- [ ] **1.1.2** {Task description}
  - Files: `{affected files}`

### 1.2 {Group Name}
- [ ] **1.2.1** {Task description}
- [ ] **1.2.2** {Task description}

**Checkpoint:** {How to verify phase complete}

---

## Phase 2: {Feature Name}

{Continue pattern...}

---

**MVP BOUNDARY**

---

## Phase {N}: {Post-MVP Feature}

{Future tasks...}

---

## Task Log

| Date | Task | Status | Notes |
|------|------|--------|-------|
| {YYYY-MM-DD} | {Task ID} | {Done/Blocked} | {Optional notes} |
```

---

## Task Writing Guidelines

### Good Task Examples

```markdown
- [ ] **1.2.3** Create UserCard component with avatar and name
  - Files: `components/UserCard.tsx`
  - Notes: Use Tailwind, accept User type prop

- [ ] **2.1.1** Add POST /api/rocks endpoint for creating rocks
  - Files: `app/api/rocks/route.ts`, `lib/eos.ts`
  - Notes: Validate with Zod, return created rock
```

### Bad Task Examples

```markdown
# Too vague
- [ ] Set up authentication

# Too compound
- [ ] Build the dashboard with all components and connect to API

# Missing context
- [ ] Fix the bug
```

### Task Description Pattern

```
{Action verb} {specific thing} {with what/how}

Examples:
- Create RockCard component with status badge
- Add GET /api/rocks endpoint returning all rocks
- Configure Supabase auth with Google OAuth
- Write tests for rock status transitions
```
