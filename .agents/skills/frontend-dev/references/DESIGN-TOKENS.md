# Design Tokens

Design tokens for Ember UI consistency.

---

## Colors

### Semantic Colors

| Token | Usage | Tailwind Class |
|-------|-------|----------------|
| Primary | Brand, CTAs, links | `bg-primary`, `text-primary` |
| Secondary | Secondary actions | `bg-secondary` |
| Muted | Subtle text, borders | `text-muted`, `border-muted` |
| Success | Positive states | `bg-green-*`, `text-green-*` |
| Warning | Caution states | `bg-yellow-*`, `text-yellow-*` |
| Error | Error states | `bg-red-*`, `text-red-*` |

### Background Colors

| Usage | Class |
|-------|-------|
| Page background | `bg-gray-50` |
| Card background | `bg-white` |
| Hover state | `hover:bg-gray-100` |
| Selected state | `bg-primary/10` |

### Text Colors

| Usage | Class |
|-------|-------|
| Primary text | `text-gray-900` |
| Secondary text | `text-gray-600` |
| Muted text | `text-gray-500` |
| Disabled text | `text-gray-400` |
| Inverse text | `text-white` |

---

## Typography

### Font Sizes

| Name | Class | Size |
|------|-------|------|
| xs | `text-xs` | 12px |
| sm | `text-sm` | 14px |
| base | `text-base` | 16px |
| lg | `text-lg` | 18px |
| xl | `text-xl` | 20px |
| 2xl | `text-2xl` | 24px |
| 3xl | `text-3xl` | 30px |

### Font Weights

| Name | Class | Weight |
|------|-------|--------|
| Normal | `font-normal` | 400 |
| Medium | `font-medium` | 500 |
| Semibold | `font-semibold` | 600 |
| Bold | `font-bold` | 700 |

### Common Combinations

```tsx
// Page title
"text-2xl font-bold text-gray-900"

// Section title
"text-xl font-semibold text-gray-900"

// Card title
"text-lg font-medium text-gray-900"

// Body text
"text-base text-gray-600"

// Caption/helper
"text-sm text-gray-500"

// Label
"text-sm font-medium text-gray-700"
```

---

## Spacing

### Scale

| Name | Class | Size |
|------|-------|------|
| 0 | `p-0` | 0px |
| 1 | `p-1` | 4px |
| 2 | `p-2` | 8px |
| 3 | `p-3` | 12px |
| 4 | `p-4` | 16px |
| 5 | `p-5` | 20px |
| 6 | `p-6` | 24px |
| 8 | `p-8` | 32px |
| 10 | `p-10` | 40px |
| 12 | `p-12` | 48px |

### Common Patterns

```tsx
// Card padding
"p-4" // or "p-6" for larger cards

// Form field spacing
"space-y-4"

// Section spacing
"space-y-6" // or "space-y-8"

// Grid gaps
"gap-4" // or "gap-6"

// Page padding
"p-8"

// Inline spacing
"space-x-2" // buttons, badges
```

---

## Borders & Shadows

### Border Radius

| Usage | Class |
|-------|-------|
| Buttons, inputs | `rounded-md` |
| Cards | `rounded-lg` |
| Badges, pills | `rounded-full` |
| Modals | `rounded-xl` |

### Border Colors

| Usage | Class |
|-------|-------|
| Default border | `border-gray-200` |
| Focus border | `border-primary` |
| Error border | `border-red-500` |

### Shadows

| Usage | Class |
|-------|-------|
| Card | `shadow-sm` |
| Dropdown | `shadow-md` |
| Modal | `shadow-lg` |
| Hover lift | `hover:shadow-md` |

---

## Responsive Breakpoints

| Name | Min Width | Class Prefix |
|------|-----------|--------------|
| sm | 640px | `sm:` |
| md | 768px | `md:` |
| lg | 1024px | `lg:` |
| xl | 1280px | `xl:` |
| 2xl | 1536px | `2xl:` |

### Common Patterns

```tsx
// Responsive grid
"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"

// Hide on mobile
"hidden md:block"

// Stack on mobile, row on desktop
"flex flex-col md:flex-row"
```

---

## Tailwind Config

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb', // blue-600
          // Add shades as needed
        },
        muted: '#6b7280', // gray-500
      },
    },
  },
};
```
