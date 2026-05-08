# DersRotasi Design System

## Mission
Create calm, trustworthy, implementation-ready UI guidance for DersRotasi, a parent/child study planner where parents plan academic work, assign tasks, track exams, and review analysis without feeling buried in administration.

## Brand
- Product/brand: DersRotasi
- Audience: parents, students, and families managing study routines
- Product surface: responsive React web app with parent and child workspaces
- Experience promise: focused academic control with a soft, native-app feel

## Style Foundations
- Visual style: iOS-inspired glass surfaces, soft color chips, shallow depth, high readability.
- Interface density: medium. Dashboards may be information-rich, but each workspace must keep one primary workflow.
- Primary workflow split: `overview`, `planning`, `tasks`, `exams`, `analysis`.
- Font stack: `"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Type tokens:
  - `--dr-type-large-title=2.125rem`
  - `--dr-type-title-1=1.75rem`
  - `--dr-type-title-2=1.375rem`
  - `--dr-type-title-3=1.25rem`
  - `--dr-type-body=1.0625rem`
  - `--dr-type-callout=1rem`
  - `--dr-type-subhead=0.9375rem`
  - `--dr-type-footnote=0.8125rem`
  - `--dr-type-caption=0.75rem`
- Radius tokens:
  - App panels: 28-32px
  - Cards: 24-30px
  - Widgets: 20-26px
  - Controls: 16-20px
  - Icon buttons and chips: full radius when compact
- Spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32. Prefer `gap` and section spacing over nested padding stacks.

## Color Palette And Roles
- Light theme:
  - `--dr-bg=#eef2fb`
  - `--dr-surface=rgba(255,255,255,0.68)`
  - `--dr-surface-strong=rgba(255,255,255,0.86)`
  - `--dr-text=#293047`
  - `--dr-muted=#6f7892`
  - `--dr-border=rgba(105,119,150,0.16)`
  - `--dr-blue=#6fa8ff`
  - `--dr-green=#6fd6b5`
  - `--dr-purple=#b8a3ff`
  - `--dr-red=#ff8fa0`
  - `--dr-orange=#ffc27a`
  - `--dr-yellow=#ffe28a`
- Dark theme:
  - `--dr-bg=#0f1320`
  - `--dr-surface=rgba(22,27,43,0.88)`
  - `--dr-surface-strong=rgba(30,36,55,0.94)`
  - `--dr-text=#f1f5ff`
  - `--dr-muted=#a3aec6`
  - `--dr-border=#2e3650`
  - `--dr-blue=#8ab4ff`
  - `--dr-green=#7ee7c7`
  - `--dr-purple=#c4b5fd`
  - `--dr-red=#ff9aa2`
  - `--dr-orange=#ffc68b`
  - `--dr-yellow=#ffe08a`
- Semantic usage:
  - Blue: planning, schedule, neutral guidance, primary navigation accents.
  - Green/mint: progress, completed work, positive analysis signal.
  - Purple/lilac: exams, advanced insights, future-looking summaries.
  - Orange/peach/yellow: warnings, attention, near-term reminders.
  - Red/coral: overdue, destructive, risk, irreversible actions.
- Avoid one-note palettes. Do not let any screen become only blue/purple, only beige, or only dark slate.

## Core Components
- `ios-card` is the main content container. Use for modules, modals, analysis panels, and large workspace surfaces.
- `ios-panel` is a compact grouped control container. Use for segmented controls, toolbars, and small command bands.
- `ios-widget` is the repeated summary unit. Use for stats, list cards, schedule blocks, empty states, and compact read-only details.
- `ios-button` is the default secondary action.
- `ios-button-active` is the active/primary action. It must be visually scarce on a screen.
- `dr-form-field` is the standard input/select field. Use for all forms that need light/dark theme parity.
- `dr-text-view` is the standard textarea/long text field.
- `dr-icon-button` is preferred for tool actions when an icon is enough.
- `dr-destructive-button` is reserved for deletion and irreversible operations.
- Color utility cards:
  - `ios-blue`, `ios-mint`, `ios-lilac`, `ios-peach`, `ios-coral`, `ios-yellow`.
  - Use these as soft semantic fills, not as decorative random color.

## Component State Rules
- Every interactive component must support default, hover, focus-visible, active, disabled, loading, and error states when applicable.
- Touch targets must be at least 44px high.
- Focus-visible must remain obvious in light and dark themes.
- Disabled controls must keep layout dimensions stable.
- Loading states must not resize buttons, cards, grids, schedule rows, or modal footers.
- Destructive actions must require clear confirmation when data loss is possible.

## Layout Principles
- Do not merge major parent workflows. Planning, task tracking, exams, and analysis should feel like distinct rooms in the same app.
- The overview screen may summarize other workspaces, but it should link out instead of embedding every module.
- Planning owns schedule, curriculum, study-plan generation, exam calendar planning, and task assignment setup.
- Tasks owns assigned task monitoring and completion state.
- Exams owns school exam and composite/mock exam records.
- Analysis owns performance interpretation and reports.
- Keep page sections unframed when they are structural. Use cards only for actual modules or repeated items.
- Avoid cards inside cards. A widget inside a card is acceptable only when it is a repeated item or a modal sub-section.
- Desktop layout can use multi-column grids; mobile must collapse to a single clear flow.
- Modals must use `max-height` with internal scroll, fixed footer actions, and `aria-modal`.
- Header/topbar actions must remain reachable without crowding the module navigation.

## Typography And Content
- Use large display text only for workspace titles and true overview hero moments.
- Compact panels, widgets, sidebars, forms, and cards need smaller headings.
- Letter spacing must be neutral for normal Turkish text. Use uppercase tracking only for short labels and kickers.
- Prefer direct Turkish labels:
  - `Planlama`
  - `Gorevler`
  - `Sinavlar`
  - `Analiz`
  - `Genel Bakis`
- Empty states should state what is missing and where to fix it. Do not over-explain feature mechanics in visible UI.
- Use concise helper copy. Parents should feel guided, not lectured.

## Accessibility
- Target: WCAG 2.2 AA.
- Keyboard-first interactions required for topbar, drawers, modals, menus, tabs, and segmented controls.
- Focus-visible rules required for all buttons, links, inputs, selects, textareas, and role buttons.
- Color alone must not communicate status; pair color with text or icons.
- Form errors must be textual and placed near the relevant control.
- Dialogs must have accessible labels and close behavior.
- Long Turkish labels must wrap or truncate intentionally without overlapping adjacent controls.

## Rules: Do
- Use semantic design tokens and existing `.ios-*` / `.dr-*` primitives before adding new CSS.
- Keep parent workspace navigation consistent across desktop, drawer, quick actions, and search results.
- Use `dr-form-field` for new form controls so dark mode stays readable.
- Keep schedule and exam editors modal-based when editing could interrupt the primary page.
- Treat overview as a command center: show next task, today schedule, upcoming exam, and short analysis signal.
- Verify dark mode when adding Tailwind utility classes that hard-code slate, white, blue, rose, or emerald colors.
- Prefer feature-complete controls over explanatory text.

## Rules: Don't
- Do not reintroduce the old single "Dersler ve Gorevler" catch-all as the main parent workflow.
- Do not put task assignment, task tracking, exams, and analysis all on one screen.
- Do not use marketing-page hero composition inside the operational app.
- Do not add decorative gradient blobs, orbs, or unrelated background art.
- Do not hide focus indicators or rely on low-contrast text.
- Do not introduce one-off raw hex colors inside components when a token or existing utility can express the state.
- Do not use oversized rounded text buttons when a standard icon button is clearer.
- Do not make dark mode a filter over light mode; define readable surfaces and text explicitly.

## Guideline Authoring Workflow
1. Restate the workflow being changed: planning, tasks, exams, analysis, overview, child dashboard, or shared shell.
2. Identify the existing component primitive: `ios-card`, `ios-panel`, `ios-widget`, `ios-button`, `dr-form-field`, or modal.
3. Define states and empty states before styling.
4. Check light and dark color behavior.
5. Check mobile width, long labels, and touch targets.
6. Run typecheck/build/smoke when behavior changes.

## Required Output Structure For Future UI Work
- Context and goals.
- Existing component primitives reused.
- New or changed tokens/classes.
- State behavior: default, hover, focus-visible, active, disabled, loading, error.
- Responsive behavior.
- Accessibility acceptance criteria.
- QA checklist.

## Quality Gates
- Every new parent-facing UI must answer: "Which workspace owns this?"
- Every new form must use theme-safe field styling.
- Every modal must close safely and preserve or discard drafts intentionally.
- Every overview card must link to an owning workspace when action is needed.
- Every dark-mode change must be checked against text, border, background, and hover states.
- Every new repeated card/list item must handle empty, long-content, and narrow-screen cases.
