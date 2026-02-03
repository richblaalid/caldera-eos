# Frontend Dev Cheatsheet

## Quick Reference

### Component Placement
```
components/ui/       → Primitives (Button, Card)
components/          → Shared components
components/{page}/   → Page-specific
app/{page}/page.tsx  → Page component
```

### Client vs Server
```
'use client' → hooks, events, browser APIs
(default)    → data fetching, static content
```

---

## Common Patterns

### Card
```tsx
<div className="rounded-lg border bg-white p-4 shadow-sm">
  {/* content */}
</div>
```

### Button
```tsx
<button className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90">
  Click me
</button>
```

### Form Field
```tsx
<div>
  <label htmlFor="name" className="block text-sm font-medium">
    Name
  </label>
  <input
    id="name"
    className="mt-1 block w-full rounded-md border px-3 py-2"
  />
</div>
```

### Loading State
```tsx
{isLoading && <Spinner />}
```

### Empty State
```tsx
{items.length === 0 && (
  <div className="py-12 text-center text-gray-500">
    No items yet
  </div>
)}
```

---

## Typography

| Element | Classes |
|---------|---------|
| Page title | `text-2xl font-bold` |
| Section title | `text-xl font-semibold` |
| Card title | `text-lg font-medium` |
| Body | `text-base` |
| Caption | `text-sm text-gray-500` |
| Label | `text-sm font-medium` |

---

## Spacing Patterns

| Pattern | Class |
|---------|-------|
| Form fields | `space-y-4` |
| Card padding | `p-4` or `p-6` |
| Section gap | `space-y-6` |
| Grid gap | `gap-4` |
| Page padding | `p-8` |

---

## Status Colors

| Status | Background | Text |
|--------|------------|------|
| Success | `bg-green-100` | `text-green-800` |
| Warning | `bg-yellow-100` | `text-yellow-800` |
| Error | `bg-red-100` | `text-red-800` |
| Info | `bg-blue-100` | `text-blue-800` |
| Default | `bg-gray-100` | `text-gray-800` |

---

## Responsive

```tsx
// Stack → Row
"flex flex-col md:flex-row"

// Grid columns
"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"

// Hide on mobile
"hidden md:block"
```

---

## Required States

Every component needs:
- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Success/data state

---

## Accessibility Checklist

- [ ] `htmlFor` on labels
- [ ] `aria-label` on icon buttons
- [ ] Focus states visible
- [ ] Tab order logical
- [ ] Color not only indicator
