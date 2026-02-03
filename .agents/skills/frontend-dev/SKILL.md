---
name: frontend-dev
description: |
  Build React components, pages, and layouts following Ember's design conventions.
  Triggers on: component, UI, frontend, React, page, layout, dashboard, form, button.

  Use when: creating new components, building pages, implementing UI features,
  or working on any frontend code in the Ember application.
---

# Frontend Development Skill

Build React components, pages, and layouts for Ember following established conventions and the design system.

> **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS

---

## Core Principles

1. **Simplicity first** — Start simple, add complexity only when needed
2. **Type everything** — Full TypeScript, no `any`
3. **Semantic HTML** — Proper elements, accessibility built-in
4. **Tailwind for styling** — Utility classes, semantic tokens
5. **Component composition** — Small, focused components

---

## Quick Decision Trees

### "Where does this component go?"

```
Component Placement:
├─ Used across multiple pages?           → components/
├─ Page-specific, complex?               → components/{page}/
├─ Page-specific, simple?                → Inline in page file
├─ UI primitive (button, input, card)?   → components/ui/
└─ Layout wrapper?                        → components/layout/
```

### "Client or Server Component?"

```
Component Type:
├─ Uses hooks (useState, useEffect)?     → 'use client'
├─ Handles user events (onClick)?        → 'use client'
├─ Uses browser APIs?                    → 'use client'
├─ Just renders data?                    → Server (default)
└─ Fetches data on mount?                → Server with async
```

---

## Component Patterns

### Basic Component

```tsx
// components/RockCard.tsx
interface RockCardProps {
  rock: Rock;
  onStatusChange?: (status: RockStatus) => void;
}

export function RockCard({ rock, onStatusChange }: RockCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="font-medium text-gray-900">{rock.title}</h3>
      <p className="text-sm text-gray-500">{rock.owner}</p>
      <StatusBadge status={rock.status} />
    </div>
  );
}
```

### Client Component with State

```tsx
// components/RockForm.tsx
'use client';

import { useState } from 'react';

interface RockFormProps {
  onSubmit: (data: RockFormData) => Promise<void>;
}

export function RockForm({ onSubmit }: RockFormProps) {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ title });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* form fields */}
    </form>
  );
}
```

---

## UI Guidelines

### Colors (Semantic Tokens)

```tsx
// Use semantic names, not raw colors
className="bg-primary"      // ✅
className="bg-blue-600"     // ❌

className="text-muted"      // ✅
className="text-gray-500"   // ❌ (unless intentional)
```

### Spacing

```tsx
// Use consistent spacing scale
className="p-4"          // 16px padding
className="space-y-4"    // 16px vertical gap
className="gap-2"        // 8px gap

// Common patterns
"space-y-4"   // Form fields, list items
"space-y-6"   // Section spacing
"gap-4"       // Grid/flex gaps
```

### Typography

```tsx
// Headings
"text-2xl font-bold"     // Page title
"text-xl font-semibold"  // Section title
"text-lg font-medium"    // Card title
"text-base"              // Body text
"text-sm text-muted"     // Secondary text
```

### States

Always implement these states:

```tsx
// Loading
{isLoading && <Spinner />}

// Empty
{items.length === 0 && <EmptyState message="No rocks yet" />}

// Error
{error && <ErrorMessage error={error} />}

// Success (data)
{items.map(item => <ItemCard key={item.id} item={item} />)}
```

---

## Forms

### Pattern

```tsx
<form onSubmit={handleSubmit} className="space-y-4">
  <div>
    <label htmlFor="title" className="block text-sm font-medium">
      Title
    </label>
    <input
      id="title"
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      className="mt-1 block w-full rounded-md border px-3 py-2"
      required
    />
  </div>

  <button
    type="submit"
    disabled={isSubmitting}
    className="rounded-md bg-primary px-4 py-2 text-white disabled:opacity-50"
  >
    {isSubmitting ? 'Saving...' : 'Save'}
  </button>
</form>
```

### Validation

```tsx
// Use Zod for validation
import { z } from 'zod';

const rockSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  ownerId: z.string().uuid('Invalid owner'),
});
```

---

## Accessibility

### Required

- `htmlFor` on labels matching input `id`
- `aria-label` on icon-only buttons
- Keyboard navigation (focus states, tab order)
- Color contrast (don't rely on color alone)

### Example

```tsx
<button
  aria-label="Delete rock"
  className="p-2 hover:bg-gray-100 focus:ring-2 focus:ring-primary"
>
  <TrashIcon className="h-5 w-5" />
</button>
```

---

## Reference Documentation

| File | Purpose |
|------|---------|
| [references/COMPONENTS.md](references/COMPONENTS.md) | Component patterns and examples |
| [references/DESIGN-TOKENS.md](references/DESIGN-TOKENS.md) | Color, spacing, typography tokens |
| [references/CHEATSHEET.md](references/CHEATSHEET.md) | Quick reference |

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Inline styles | Inconsistent, hard to maintain | Use Tailwind classes |
| Magic numbers | `p-[13px]` | Use scale: `p-3` or `p-4` |
| Missing states | No loading/empty/error | Always implement all states |
| Prop drilling | Passing props 3+ levels | Use context or composition |
| Client everything | All 'use client' | Default to server components |
| No types | Using `any` | Define proper interfaces |
