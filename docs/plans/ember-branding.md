# Ember Branding & UI Plan

## Brand Concept: Ember

**Tagline:** "Your AI Integrator" (or none - just "Ember by Caldera")

### Brand Story
Ember extends Caldera's brand into the EOS coaching space. The name evokes warmth and persistence - a steady presence that keeps the team focused on what matters.

### Design Direction: Refined Minimal

**Philosophy:** Crisp typography, generous whitespace, subtle orange accents. Professional and trustworthy with moments of warmth. The design should feel like a premium business tool, not a consumer app.

**Key Principles:**
- **Restraint over abundance** - Orange appears as accent, not dominant
- **Typography-first** - Distinctive display font paired with clean body text
- **Subtle atmosphere** - Light noise textures, soft shadows, refined borders
- **Generous spacing** - Let content breathe, avoid cramped layouts

### Visual Identity

#### Color Palette
**Primary: Ember Orange (used sparingly as accent)**
- Ember 500: `#f97316` - Primary actions, logo mark, active states
- Ember 600: `#ea580c` - Hover states, emphasis
- Ember 700: `#c2410c` - Dark mode accents

**Foundation: Slate Scale (dominant)**
- Foreground: `#0f172a` (Slate 900) - Primary text
- Secondary: `#475569` (Slate 600) - Secondary text
- Muted: `#64748b` (Slate 500) - Tertiary text
- Border: `#e2e8f0` (Slate 200) - Subtle borders
- Surface: `#f8fafc` (Slate 50) - Subtle backgrounds

**Status Colors**
- Success: `#10b981` (Emerald) - On-track rocks, completed todos
- Warning: `#f59e0b` (Amber) - At-risk items
- Danger: `#ef4444` (Red) - Off-track, overdue

#### Typography
**Display Font:** Bricolage Grotesque (or similar characterful grotesque)
- Used for: Page titles, hero text, logo wordmark
- Weight: 600-700 for headings

**Body Font:** Geist Sans
- Used for: Body text, UI elements, data
- Weight: 400-500 for readability

#### Logo Concept: Flame + Traction
- **Mark:** Upward-pointing flame that suggests forward momentum/traction
  - The flame curves upward like an arrow or rising graph
  - Subtle chevron shape within the flame silhouette
  - Represents both warmth (ember) and progress (traction)
- **Wordmark:** "Ember" in Bricolage Grotesque, weight 600
- **Favicon:** Simplified flame mark only
- **Combination:** Mark + wordmark with proper spacing

#### Background & Texture
- Subtle noise overlay (2-3% opacity) on light backgrounds
- Soft gradient washes for hero sections
- Clean white/slate backgrounds for data-heavy views
- Avoid harsh borders - use shadows and spacing instead

### Dark Mode Strategy

#### Current State Analysis
The CSS has a basic dark mode media query but:
- Most components use hardcoded `bg-white` instead of `bg-background`
- Many text colors don't adapt (`text-foreground` vs hardcoded)
- The sidebar has `bg-white` hardcoded
- Form inputs use `bg-white`
- Cards use `bg-white`

#### Dark Mode Color Mapping
```css
/* Light Mode */
--background: #ffffff;
--foreground: #0f172a;
--muted: #f1f5f9;
--muted-foreground: #64748b;
--border: #e2e8f0;

/* Dark Mode */
--background: #0f172a;     /* Slate 900 */
--foreground: #f8fafc;     /* Slate 50 */
--muted: #1e293b;          /* Slate 800 */
--muted-foreground: #94a3b8; /* Slate 400 */
--border: #334155;         /* Slate 700 */
```

---

## Implementation Tasks

### Phase 1: Brand Assets

- [ ] **1.1** Create Ember logo SVG (flame mark with "E" integration)
- [ ] **1.2** Create favicon.ico (16x16, 32x32, 48x48)
- [ ] **1.3** Create apple-touch-icon.png (180x180)
- [ ] **1.4** Create og-image.png for social sharing (1200x630)
- [ ] **1.5** Update manifest.json with app icons
- [ ] **1.6** Update layout.tsx with favicon and metadata

### Phase 2: Dark Mode Compatibility

- [x] **2.1** Add dark mode toggle to header/settings
- [x] **2.2** Audit and fix Sidebar.tsx (replace bg-white → bg-background)
- [x] **2.3** Audit and fix Card component (replace bg-white → bg-background)
- [x] **2.4** Audit and fix form inputs (replace bg-white → bg-background)
- [x] **2.5** Audit and fix all dashboard pages for hardcoded colors
- [x] **2.6** Test all pages in dark mode

### Phase 3: UI Polish

- [ ] **3.1** Replace placeholder "E" logo in Sidebar with actual logo SVG
- [ ] **3.2** Update login page with branded hero
- [ ] **3.3** Add loading states with Ember branding
- [ ] **3.4** Update empty states with branded illustrations
- [ ] **3.5** Ensure consistent spacing and typography

---

## Asset Specifications

### Favicon Package
```
/public
├── favicon.ico           # Multi-size ICO (16, 32, 48)
├── favicon-16x16.png     # Standard favicon
├── favicon-32x32.png     # Retina favicon
├── apple-touch-icon.png  # iOS home screen (180x180)
├── icon-192.png          # Android/PWA
├── icon-512.png          # PWA splash
├── og-image.png          # Social sharing
└── ember-logo.svg        # Vector logo
```

### Logo Usage
- **Sidebar:** 32x32 mark only
- **Login page:** Full logo with wordmark
- **Favicon:** Simplified flame only
- **Social/OG:** Full logo centered on ember gradient

---

## Acceptance Criteria

1. ✅ Ember has a distinctive logo that connects to Caldera's brand
2. ✅ All favicon sizes are present and display correctly
3. ✅ Dark mode works across all pages without visual bugs
4. ✅ Users can toggle between light and dark mode
5. ✅ Social sharing shows proper OG image
