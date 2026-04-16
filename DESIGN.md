# DESIGN.md

## 1) Visual Theme & Atmosphere
- Product type: Parent/child study planner dashboard.
- Tone: Clean, calm, high-trust, task-focused.
- Density: Medium. Never overcrowded.
- Principle: One workflow per screen. Avoid "page inside page" feeling.

## 2) Color Palette & Roles
- `--bg`: `#F1F5F9` (app background)
- `--surface`: `#FFFFFF` (main surface)
- `--surface-muted`: `#F8FAFC` (secondary blocks)
- `--text`: `#0F172A` (primary text)
- `--text-muted`: `#475569` (secondary text)
- `--primary`: `#1D4ED8` (main actions)
- `--primary-strong`: `#1E3A8A` (active nav)
- `--success`: `#059669`
- `--warning`: `#D97706`
- `--danger`: `#DC2626`
- `--border`: `#CBD5E1`

## 3) Typography Rules
- Heading font: Sora (fallback: system sans).
- Body font: Manrope (fallback: system sans).
- Sizes:
  - H1: 28/34, 800
  - H2: 22/30, 800
  - H3: 18/26, 700
  - Body: 14/22, 500
  - Caption: 12/18, 600
- Keep letter spacing neutral, readable Turkish text.

## 4) Component Stylings
- Radius scale:
  - Large panel: 24-28px
  - Card: 16-20px
  - Controls: 12-16px
- Borders: 1px solid `--border`.
- Shadows: subtle only (`0 8px 24px rgba(15,23,42,0.08)`).
- Buttons:
  - Primary: `--primary`, white text
  - Secondary: white bg, border, slate text
- Nav item active state: dark navy fill, white text.

## 5) Layout Principles
- Desktop workspace uses 2-column grid when sidebar is open:
  - Sidebar fixed width: 280px
  - Content: `minmax(0, 1fr)`
- Sidebar must be `sticky`, not `fixed` over content.
- Mobile module menu opens as overlay drawer; should not push content down.
- Keep max content width at 1200-1280px.

## 6) Depth & Elevation
- Surface hierarchy:
  1. App background
  2. Main content panel
  3. Cards
  4. Overlay/drawer
- Avoid stacking more than 2 nested card layers.

## 7) Do and Don't
- Do:
  - Show one primary workflow per screen (Planning / Tasks / Analysis).
  - Close sidebar on click outside (desktop only when open).
  - Preserve spacing rhythm: 8 / 12 / 16 / 24 / 32.
- Don't:
  - Do not render unrelated modules on the same screen.
  - Do not use full-screen blockers for desktop sidebar toggles.
  - Do not place major cards inside multiple wrapper cards.

## 8) Responsive Behavior
- Breakpoints:
  - Mobile: < 768
  - Tablet: 768-1279
  - Desktop: >= 1280
- At desktop, sidebar is visible and optional.
- At tablet/mobile, sidebar replaced by top-right menu button + overlay drawer.
- Touch targets at least 40px high.

## 9) Agent Prompt Guide
Use these instructions when generating UI:
- "Preserve workflow separation: planning, tasks, analysis must not visually merge."
- "Prefer stable grid and sticky sidebar over fixed overlays."
- "Keep cards shallow and avoid page-in-page nesting."
- "Use calm blue/slate palette and high readability for Turkish dashboard content."
