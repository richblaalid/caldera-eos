---
description: Build React components, pages, and layouts following Charter Pro design system conventions
---

# Frontend Development Skill

## Overview

This skill guides frontend development for Charter Pro, ensuring all React components, pages, and layouts adhere to the established design system and project conventions.

## When to Use

Invoke this skill when:

- Creating new React components
- Building pages or layouts
- Implementing UI features
- Styling with Tailwind CSS
- Working with ShadCN components
- Adding loading states, empty states, or error handling UI

## Core References

**CRITICAL:** Before writing any frontend code, read:

| Document                | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `docs/design-system.md` | Visual language, component patterns, accessibility requirements |
| `src/components/ui/`    | ShadCN primitive components (don't modify these)                |

## Workflow

### Step 1: Understand the Context

1. Read `docs/design-system.md` completely
2. Identify which component patterns apply
3. Check existing components in `src/components/` for similar patterns

### Step 2: Plan the Component

Before writing code, confirm:

- [ ] Component location (features/, shared/, or layout/)
- [ ] Props interface design
- [ ] Which ShadCN primitives to use
- [ ] Loading, empty, and error states needed
- [ ] Accessibility requirements (aria labels, focus management)

### Step 3: Implementation Checklist

Apply these rules from the design system:

#### Colors

- Use semantic tokens ONLY: `bg-primary`, `text-muted-foreground`, `border-border`
- NEVER use raw Tailwind colors: `bg-blue-600`, `text-gray-500`
- Status colors: green for success, yellow for warning, `destructive` for errors

#### Typography

- Primary text: `text-foreground`
- Secondary text: `text-muted-foreground`
- Font sizes: `text-xs` (12px) to `text-2xl` (24px)

#### Spacing

- Follow 4px increments: `space-1` through `space-8`
- Page padding: `p-6`
- Card padding: `p-4`
- Form field gap: `space-y-4`

#### Components

- Buttons: Use variant (default/secondary/outline/ghost/destructive/link) and size (sm/default/lg)
- Forms: Vertical stack with `space-y-4`, labels with `htmlFor`, error messages with `text-destructive`
- Cards: Use CardHeader/CardContent/CardFooter structure
- Dialogs: Include DialogHeader with title and description

#### States

- Loading: Skeleton for page load, Loader2 spinner for actions
- Empty: Icon + title + description + CTA pattern
- Error: Inline for forms, toast for operations, full-page for critical

#### Icons

- Use Lucide React exclusively
- Sizes: `h-4 w-4` (inline), `h-5 w-5` (nav), `h-8 w-8` (empty state)

#### Accessibility

- Icon-only buttons need `aria-label`
- Form fields need `htmlFor` and `aria-describedby` for errors
- Loading states need `aria-busy="true"`
- Focus rings via `focus-visible:ring-2 focus-visible:ring-ring`

### Step 4: File Structure

```
src/components/
├── ui/                    # ShadCN primitives (don't modify)
├── layout/                # App shell, sidebar, header
├── features/              # Feature-specific components
│   ├── chat/
│   ├── documents/
│   └── admin/
└── shared/                # Cross-feature components
```

Component file pattern:

```tsx
// ComponentName.tsx
import { cn } from "@/lib/utils";

interface ComponentNameProps {
  /** JSDoc for prop */
  label: string;
  variant?: "default" | "compact";
}

export function ComponentName({ label, variant = "default" }: ComponentNameProps) {
  return (
    <div className={cn("base-classes", variant === "compact" && "compact-classes")}>{label}</div>
  );
}
```

### Step 5: Verification

Before marking complete:

- [ ] No raw Tailwind colors used
- [ ] Loading states implemented for async operations
- [ ] Empty states for lists/collections
- [ ] Error states handle failures gracefully
- [ ] Keyboard navigation works
- [ ] Icon buttons have aria-labels
- [ ] Mobile responsive (test with sm: md: lg: breakpoints)

## Quick Reference: Common Patterns

### Button with Loading State

```tsx
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Saving...
</Button>
```

### Form Field with Error

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" aria-describedby="email-error" />
  {error && (
    <p id="email-error" className="text-sm text-destructive">
      {error}
    </p>
  )}
</div>
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <div className="rounded-full bg-muted p-4 mb-4">
    <FileText className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-medium mb-2">No items yet</h3>
  <p className="text-sm text-muted-foreground mb-4 max-w-sm">Description here</p>
  <Button>Add Item</Button>
</div>
```

### Interactive Card

```tsx
<Card className="cursor-pointer hover:bg-muted/50 transition-colors">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
</Card>
```

## Do NOT

- Modify files in `src/components/ui/` (ShadCN primitives)
- Use raw Tailwind colors (blue-500, gray-200, etc.)
- Skip loading/error/empty states
- Create icon buttons without aria-labels
- Use more than 2 primary buttons per view
- Animate on initial page load
- Forget mobile responsive behavior
