# Tasks Template

Use this template when generating `docs/tasks.md` from the plan.

---

```markdown
# Implementation Tasks

> Generated from docs/plan.md on {DATE}
>
> **Instructions for Claude:** Complete tasks sequentially within each phase.
> Mark each task complete immediately after implementation.
> Run tests after each task. Commit after each working change.

## Progress Summary

- Phase 0: [ ] Not Started / [~] In Progress / [x] Complete
- Phase 1: [ ] Not Started
- Phase 2: [ ] Not Started
  {Continue for all phases...}
- **MVP Status:** Not Started

---

## Phase 0: Project Foundation

### 0.0 Pre-flight

- [ ] 0.0.1: Read CLAUDE.md and confirm understanding of project conventions
- [ ] 0.0.2: Verify no uncommitted changes in working directory

### 0.1 Project Initialization

- [ ] 0.1.1: Initialize Next.js 14+ project with App Router (`npx create-next-app@latest`)
  - Files: package.json, tsconfig.json, next.config.js
  - Test: Project created with expected structure
- [ ] 0.1.2: Configure TypeScript strict mode
  - Files: tsconfig.json
  - Test: `npm run typecheck` passes
- [ ] 0.1.3: Set up ESLint with Next.js recommended rules
  - Files: .eslintrc.js, package.json
  - Test: `npm run lint` passes
- [ ] 0.1.4: Set up Prettier with consistent formatting
  - Files: .prettierrc, .prettierignore, package.json
  - Test: `npm run format` works
- [ ] 0.1.5: Configure test framework per ADR-009
  - Files: {test config}, package.json
  - Test: `npm run test` runs (0 tests OK)

### 0.2 Project Structure

- [ ] 0.2.1: Create folder structure per ADR-010
  - Folders: src/{folders per ADR}
- [ ] 0.2.2: Create placeholder index files for main modules
  - Files: src/{module}/index.ts
- [ ] 0.2.3: Verify build: `npm run build` succeeds
- [ ] 0.2.4: Verify dev: `npm run dev` starts without errors
- [ ] 0.2.5: Verify test: `npm run test` runs successfully

### 0.3 Database Setup

- [ ] 0.3.1: Install ORM per ADR-001
  - Files: package.json
- [ ] 0.3.2: Configure database connection
  - Files: src/lib/db.ts, .env.example
- [ ] 0.3.3: Create initial schema file
  - Files: src/db/schema.ts
- [ ] 0.3.4: Set up migrations
  - Files: drizzle.config.ts (or equivalent)
  - Test: `npm run db:migrate` works

### 0.4 Development Tooling

- [ ] 0.4.1: Add pre-commit hooks (husky + lint-staged)
  - Files: .husky/pre-commit, package.json
- [ ] 0.4.2: Create .env.example with required variables
  - Files: .env.example, .gitignore
- [ ] 0.4.3: Update README with setup instructions
  - Files: README.md

**Phase 0 Checkpoint:**

- [ ] Fresh clone + `npm install` + `npm run dev` works
- [ ] All npm scripts functional: dev, build, test, lint, typecheck
- [ ] Database connection verified
- [ ] Commit: "chore: complete project foundation (Phase 0)"

---

## Phase 1: {Feature Name from Plan}

### 1.1 {Sub-feature or Layer}

- [ ] 1.1.1: {Specific task - verb + noun + context}
  - Files: {paths}
  - Test: {how to verify}
- [ ] 1.1.2: {Specific task}
  - Files: {paths}
  - Test: {how to verify}
- [ ] 1.1.3: Write tests for {component/function}
  - Files: {test paths}
  - Test: Tests pass

### 1.2 {Sub-feature or Layer}

- [ ] 1.2.1: {Specific task}
  - Files: {paths}
  - Test: {how to verify}
- [ ] 1.2.2: {Specific task}
  - Files: {paths}

{Continue sub-sections as needed...}

**Phase 1 Checkpoint:**

- [ ] {Concrete verification from plan}
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Commit: "feat: complete {feature} (Phase 1)"

---

## Phase 2: {Feature Name from Plan}

{Continue same pattern...}

---

## Post-MVP Tasks

> Do not start these until MVP checkpoints are all verified.

### {Future Phase}: {Feature}

- [ ] {Task}

---

## Task Log

| Task  | Completed | Commit | Notes |
| ----- | --------- | ------ | ----- |
| 0.0.1 |           |        |       |
| 0.0.2 |           |        |       |
| 0.1.1 |           |        |       |

{Continue for all tasks...}
```

---

## Template Usage Notes

### Task Numbering

Format: `{Phase}.{Section}.{Task}`

Examples:

- `0.1.1` - Phase 0, Section 1, Task 1
- `1.2.3` - Phase 1, Section 2, Task 3
- `2.0.1` - Phase 2, Section 0, Task 1

### Task Format

Each task should include:

```markdown
- [ ] {N.N.N}: {Action verb} {what} {context}
  - Files: {comma-separated file paths}
  - Test: {how to verify completion}
```

### Action Verbs

Use consistent verbs:

- **Create** - New file/component
- **Add** - New functionality to existing file
- **Configure** - Set up tooling/settings
- **Implement** - Build feature logic
- **Write** - Tests or documentation
- **Update** - Modify existing code
- **Integrate** - Connect components
- **Verify** - Run checks/tests

### File References

Be specific when known:

- `src/components/Button.tsx` ✓
- `src/components/` ✗ (too vague)
- `{TBD}` ✓ (when location unknown)

### Test/Verification

Types of verification:

- `Test: npm run test passes`
- `Test: Component renders without errors`
- `Test: API returns expected response`
- `Test: Manual verification in browser`
- `Test: TypeScript compiles without errors`

### Progress Summary Update

When updating docs/tasks.md during execution:

```markdown
## Progress Summary

- Phase 0: [x] Complete
- Phase 1: [~] In Progress (5/12 tasks)
- Phase 2: [ ] Not Started
- **MVP Status:** In Progress
```

### Checkpoint Tasks

Every phase ends with:

1. Verification checklist
2. All tests pass confirmation
3. Commit instruction

### Task Log Usage

Update after each task:

```markdown
| Task  | Completed  | Commit | Notes                    |
| ----- | ---------- | ------ | ------------------------ |
| 0.1.1 | 2024-01-15 | abc123 |                          |
| 0.1.2 | 2024-01-15 | abc123 | Combined with 0.1.1      |
| 0.1.3 | 2024-01-15 | def456 | Chose ESLint flat config |
```

### Blocked Tasks

When a task is blocked:

```markdown
- [ ] 1.2.1: {Task description}
  - Files: {paths}
  - **BLOCKED:** Waiting for ADR-007 decision
```

### Skipped Tasks

When a task becomes unnecessary:

```markdown
- [~] 1.2.1: {Task description} - SKIPPED: {reason}
```
