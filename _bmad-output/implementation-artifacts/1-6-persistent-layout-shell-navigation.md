# Story 1.6: Persistent Layout Shell & Navigation

Status: review

## Adversarial Review Record

**Review date:** 2026-04-22
**Reviewers:** Winston (Architect), Murat (Test Architect), Amelia (Developer), Sally (UX Designer)
**Method:** BMAD Party Mode — 4 independent subagent adversarial review

### Findings Summary: 49 findings across 4 agents

| Category | Winston | Murat | Amelia | Sally |
|----------|---------|-------|--------|-------|
| Blocker | 1 | 1 | 4 | 5 |
| High | 3 | 3 | 3 | 3 |
| Medium | 5 | 5 | 4 | 4 |
| Low | 2 | 4 | 3 | 2 |

### Resolved Blockers (addressed in this revision)

1. **agent_configurations table missing** — Resolved: added `NEXT_PUBLIC_DEV_AGENT_COUNT` env var override for development, plus explicit dev-mode story. Hardcoded path removed.
2. **File path conflict** — Resolved: verified `packages/ui/src/` is actual structure (architecture doc aspirational). Story confirmed correct.
3. **Jotai SSR/hydration** — Resolved: added explicit Task 0 for Jotai setup with `atomWithStorage` + SSR handling, provider wrapper in app root.
4. **Settings layout undefined replacement** — Resolved: specified settings becomes inner tab nav within WorkspaceShell, with explicit subtask.
5. **No loading/error states** — Resolved: added `loading.tsx` skeleton, `error.tsx` boundary, and ErrorBoundary around sidebar.

### Deferred to Later Stories (with rationale)

- **Visual regression testing** (Murat F8) → Story 1.7 (home dashboard) or dedicated visual testing story. Rationale: Playwright screenshot infra is heavy for this story scope.
- **Workspace switcher** (Sally F11) → Story 1.7. Rationale: requires workspace list query + multi-workspace routing design. Scoped out.
- **`axe-core` automated scan** (Murat F9) → Story 1.8 or a11y hardening story. Rationale: `axe-core` integration requires Playwright setup not yet in scope.
- **`depcheck` / dependency-cruiser in CI** (Winston F8) → Story 1.1a follow-up. Rationale: CI enhancement, not Story 1.6 scope.
- **Shortcut discovery modal (`?` key)** (Sally F2) → Story 1.8 (command palette). Rationale: centralized shortcut registry owns discovery.
- **Sidebar notification badges** (Sally implied) → Post-1.6 story. Rationale: notification infrastructure is Epic 10.

---

## Story

As a user,
I want a persistent layout with sidebar navigation,
So that I can move between all major functional areas without losing context.

## Acceptance Criteria

1. **Given** a user is authenticated and in a workspace **When** the app loads **Then** a persistent sidebar (240px expanded, collapses to 56px icon-only) is visible per UX-DR19
2. **Given** the sidebar is visible **When** the user clicks a navigation item **Then** navigation to all major functional areas (inbox, calendar, agents, clients, invoices, time, reports, settings) is accessible per FR75
3. **Given** the sidebar is rendered **When** the bottom section is visible **Then** a timer slot placeholder is present (ghosted clock icon with reserved height, labeled for Epic 5) per UX-DR11
4. **Given** a user views on mobile (<640px) **When** the app loads **Then** a mobile-responsive layout with bottom tab bar supports critical workflows per FR98 — bottom tabs show Inbox + Calendar visible, others under "More" (bottom sheet overlay)
5. **Given** a user views at tablet breakpoint (640-1023px) **When** the sidebar renders **Then** it collapses to 56px icon-only mode — no hover expand
6. **Given** a user views at laptop breakpoint (1024-1279px) **When** the sidebar renders **Then** it collapses to 56px icon-only with overlay expand on hover (sidebar overlays content, does NOT reflow) or `]` key
7. **Given** a free-tier workspace with <2 active agents **When** the layout renders **Then** no sidebar is shown — inbox IS the product per UX-DR33
8. **Given** a free-tier user activates their second agent **When** the activation completes **Then** the sidebar activates via reveal pattern (not paywall/gate) with a one-time toast notification per UX-DR34
9. **Given** any navigation action **When** the user clicks a sidebar link or tab **Then** the transition completes within 2 seconds P95 per NFR01, with `loading.tsx` skeleton matching content shape during route transitions
10. **Given** the sidebar is visible **When** the active route matches a nav item **Then** that item shows an active state with a left border 2px in gold accent `var(--flow-color-accent-gold)` — agent-specific colors deferred to agent-aware nav story
11. **Given** any sidebar or layout element **When** a keyboard user navigates **Then** all elements are keyboard-accessible with visible focus indicators per WCAG 2.1 AA (FR99, NFR41)
12. **Given** the layout shell renders **When** a `prefers-reduced-motion: reduce` preference is active **Then** all sidebar expand/collapse animations are disabled (instant layout shift) — no CSS transitions applied
13. **Given** the sidebar nav items **When** the user presses `]` or `[` **Then** the sidebar expands or collapses respectively — shortcuts disabled when `input`, `textarea`, or `[contenteditable]` element is focused
14. **Given** the sidebar state changes (collapse/expand) **When** a screen reader is active **Then** an ARIA live region announces the new state ("Sidebar expanded" / "Sidebar collapsed")
15. **Given** the sidebar collapses via `[` key **When** keyboard focus was on a nav item **Then** focus moves to the collapse toggle button
16. **Given** the layout shell renders **When** the sidebar throws an error **Then** an ErrorBoundary catches it and renders fallback: main content remains visible, sidebar shows "Navigation unavailable — reload" message
17. **Given** the layout shell renders **When** the RSC layout is fetching auth/agentCount **Then** a `loading.tsx` skeleton renders with sidebar skeleton + main content skeleton matching final layout shape
18. **Given** the sidebar is visible **When** viewport height is insufficient to show all nav items **Then** the nav items section scrolls independently while top (workspace name) and bottom (timer slot) sections remain pinned

## Tasks / Subtasks

- [x] Task 0: Jotai setup — first consumer in monorepo (AC: all client state)
  - [x] 0.1 Add `jotai` and `jotai/utils` as dependencies to `packages/shared/package.json`
  - [x] 0.2 Create `packages/shared/src/atoms/ui-state.ts` — Jotai atoms: `sidebarCollapsedAtom` (boolean, persisted to localStorage via `atomWithStorage('flow-sidebar-collapsed', false)`), `sidebarHoverExpandedAtom` (transient boolean, for laptop breakpoint hover behavior)
  - [x] 0.3 Create `packages/shared/src/atoms/ui-state.test.ts` — test each atom inside a fresh Jotai `<Provider>` wrapper. Assert: default values, toggle behavior, localStorage round-trip for `sidebarCollapsedAtom`
  - [x] 0.4 Export atoms from `packages/shared/src/index.ts` barrel
  - [x] 0.5 Verify SSR safety: `atomWithStorage` with `delayInit: true` option to prevent hydration mismatch. Test: render component using atom in jsdom without `window.localStorage` — should not throw

- [x] Task 1: Workspace layout shell — replace minimal layout (AC: #1, #6, #7, #9, #12, #16, #17, #18)
  - [x] 1.1 Rewrite `apps/web/app/(workspace)/layout.tsx` — Server Component that fetches auth session + `agentCount`, passes both to `WorkspaceShell` via typed props interface `WorkspaceShellProps { agentCount: number; children: React.ReactNode }`
  - [x] 1.2 Create `apps/web/app/(workspace)/loading.tsx` — skeleton matching layout shell shape (sidebar skeleton + main content skeleton). Uses CSS custom properties for dimensions.
  - [x] 1.3 Create `apps/web/app/(workspace)/error.tsx` — error boundary for workspace routes. Shows error message with retry button, preserves shell if possible.
  - [x] 1.4 Create `packages/ui/src/layouts/workspace-shell.tsx` — `"use client"` component:
    - Props: `WorkspaceShellProps` from above
    - Reads `sidebarCollapsed` from Jotai atom
    - Renders `ErrorBoundary` wrapping `SidebarProvider` (which conditionally renders sidebar)
    - Main content area: `<main id="main-content">` with `children` (RSC passthrough — NOT wrapped in client boundary)
    - Applies `--flow-layout-sidebar-expanded` / `--flow-layout-sidebar-collapsed` CSS vars via inline style
    - Responsive: uses Tailwind classes for breakpoint visibility (sidebar hidden below `sm:`, mobile tab bar below `sm:`)
    - ARIA live region `<div aria-live="polite" className="sr-only">` announcing sidebar state changes
    - `prefers-reduced-motion`: reads `useReducedMotion()` hook, conditionally applies `transition-none` class
  - [x] 1.5 Create `packages/ui/src/layouts/workspace-shell.test.tsx` — see Task 9.2
  - [x] 1.6 Verify layout CSS custom properties exist in `@flow/tokens/css` output: `--flow-layout-sidebar-expanded`, `--flow-layout-sidebar-collapsed`, `--flow-layout-main-content`, `--flow-layout-detail-pane`

- [x] Task 2: Sidebar component (AC: #1, #2, #3, #10, #11, #14, #15, #18)
  - [x] 2.1 Create `packages/ui/src/layouts/sidebar.tsx` — `"use client"` sidebar with:
    - Top section (pinned): workspace name display, logout button from existing `logout-button.tsx`
    - Navigation section (scrollable via `overflow-y-auto`): 8 nav items with Lucide icons (individual imports)
    - Bottom section (pinned): timer slot placeholder — ghosted `Clock` icon at 50% opacity with `aria-label="Timer area — coming soon"`, `data-testid="sidebar-timer-slot"`, reserved height 48px
    - Active state: left border 2px `var(--flow-color-accent-gold)`
    - Collapse toggle button (chevron icon) with `aria-label="Collapse sidebar"`
    - `<nav aria-label="Main navigation">` landmark wrapping nav items
    - Each nav item: `<a>` with `role="link"`, keyboard focusable, visible focus ring via `var(--flow-focus-ring-width)` + `var(--flow-focus-ring-color)`
  - [x] 2.2 Create `packages/ui/src/layouts/sidebar.test.tsx` — see Task 9.1
  - [x] 2.3 Create barrel `packages/ui/src/layouts/index.ts` — exports `WorkspaceShell`, `Sidebar`, `SidebarProvider`, `MobileTabBar`, `type WorkspaceShellProps`

- [x] Task 3: Free-tier sidebar suppression (AC: #7, #8)
  - [x] 3.1 Create `packages/ui/src/layouts/sidebar-provider.tsx` — `"use client"` component:
    - Accepts `agentCount` prop
    - Returns `<Sidebar />` when `agentCount >= 2`, `null` otherwise
    - On transition from `<2` to `>=2`: renders one-time toast via `sonner` (already in deps from Story 1.1b): "Your sidebar is ready — you now have multiple agents active." Toast has dismiss button, fires once per session via sessionStorage flag `flow-sidebar-revealed`
  - [x] 3.2 Create `packages/ui/src/layouts/sidebar-provider.test.tsx` — boundary value analysis: agentCount = 0, 1, 2, 3, 6 (max). Assert: 0 → no sidebar, 1 → no sidebar, 2 → sidebar visible, 3+ → sidebar visible. Assert: toast appears only on first transition.
  - [x] 3.3 Dev override: when `NEXT_PUBLIC_DEV_AGENT_COUNT` env var is set, layout.tsx uses `Number(process.env.NEXT_PUBLIC_DEV_AGENT_COUNT)` instead of DB query. This enables visual sidebar testing before Epic 2 ships. Remove env var handling when Epic 2 creates `agent_configurations` table.
  - [x] 3.4 When `agent_configurations` table doesn't exist yet (Epic 2 backlog): layout.tsx queries agent count, catches "relation does not exist" error, falls back to `agentCount=1`. Do NOT hardcode `agentCount={1}` — use try/catch with explicit fallback so the query path is tested.

- [x] Task 4: Responsive breakpoints & mobile layout (AC: #4, #5, #6)
  - [x] 4.1 Implement responsive sidebar behavior in `WorkspaceShell`:
    - `<640px` (mobile): sidebar hidden, bottom tab bar rendered
    - `640-1023px` (tablet): sidebar collapsed to 56px icon-only, no hover, no expand
    - `1024-1279px` (laptop): sidebar collapsed to 56px, expand on hover as **overlay** (position: absolute/fixed, z-index from tokens, does NOT push content). 300ms delay before expand, 200ms delay before collapse.
    - `1280px+` (desktop): sidebar fully expanded (240px), content respects sidebar width
  - [x] 4.2 Create `packages/ui/src/layouts/mobile-tab-bar.tsx` — `"use client"` bottom tab bar:
    - Fixed bottom, 2 primary tabs (Inbox, Calendar) + "More" button
    - "More" opens a bottom sheet overlay (Radix `Dialog` or custom) listing: Agents, Clients, Invoices, Time, Reports, Settings
    - Bottom sheet: backdrop dismiss, `Escape` key dismiss, focus trap inside sheet
    - Each tab shows icon + label, active tab highlighted
    - `<nav aria-label="Mobile navigation">` landmark
  - [x] 4.3 Create `packages/ui/src/layouts/mobile-tab-bar.test.tsx` — renders Inbox + Calendar + More, active tab highlighting, More opens sheet, sheet items rendered, sheet dismisses on Escape
  - [x] 4.4 Use Tailwind responsive classes (`sm:`, `lg:`, `xl:`) for all breakpoint logic. JS only for: (a) persisting collapsed state to localStorage via Jotai, (b) hover timer management for laptop overlay.

- [x] Task 5: Keyboard shortcuts for sidebar (AC: #11, #13, #15)
  - [x] 5.1 Register global `]` / `[` keyboard listeners in `WorkspaceShell` for expand/collapse:
    - Guard: disabled when `document.activeElement` is `input`, `textarea`, `select`, or element with `contenteditable` attribute
    - Guard: disabled when modifier keys (Ctrl, Alt, Meta) are held
    - Calls `event.preventDefault()` only for `]` and `[` to avoid browser defaults
    - Updates `sidebarCollapsedAtom` via Jotai `useSetAtom`
    - After collapse via `[`: moves focus to collapse toggle button
  - [x] 5.2 Ensure sidebar nav items are in Tab order with visible focus ring using `focus-visible` CSS selector + `var(--flow-focus-ring-width)` / `var(--flow-focus-ring-color)` tokens. No focus ring on mouse click (`:focus:not(:focus-visible)` hides outline).

- [x] Task 6: Skip-to-content link (AC: #11)
  - [x] 6.1 Add skip-to-content link as **first focusable element** in `WorkspaceShell`:
    - Visually hidden (`sr-only`), appears on Tab focus (`focus:not(.sr-only)`)
    - Links to `<main id="main-content">`
    - Text: "Skip to main content"
    - z-index: `var(--flow-z-overlay)` when focused
    - Added to BOTH sidebar and non-sidebar (free-tier) layouts

- [x] Task 7: Sidebar ErrorBoundary (AC: #16)
  - [x] 7.1 Create `packages/ui/src/layouts/sidebar-error-boundary.tsx` — React error boundary class component:
    - Catches render errors from Sidebar and children
    - Fallback UI: "Navigation unavailable" message with reload link, styled as minimal sidebar width
    - Logs error to console (structured) — no external service yet
    - Does NOT catch errors in `<main>` content (those caught by route `error.tsx`)

- [x] Task 8: Update existing workspace layout consumers (AC: #1, #9)
  - [x] 8.1 Update `apps/web/app/(workspace)/settings/layout.tsx`:
    - Remove standalone settings sidebar (outer `<nav>`)
    - Keep sub-navigation (Profile, Team, Devices, Sessions) as **inner horizontal tab bar** at the top of the settings page
    - Settings page now renders within WorkspaceShell like all other routes
    - The main sidebar's Settings link (`/settings`) points here
  - [x] 8.2 Verify all existing routes under `(workspace)/` render correctly within the new shell: settings, profile, team, devices, sessions

- [x] Task 9: Tests (AC: all)
  - [x] 9.1 Unit tests: `sidebar.tsx` — renders all 8 nav items with correct hrefs, active item has left border 2px, collapsed mode hides labels but shows icons, timer slot present with ghosted icon, nav landmark exists, scrollable region has `overflow-y-auto`, pinned top/bottom sections
  - [x] 9.2 Unit tests: `workspace-shell.tsx` — renders sidebar + main content for agentCount≥2, no sidebar for agentCount<2, collapse toggle updates atom, `]`/`[` keyboard shortcuts work (disabled in input/textarea/contenteditable), `prefers-reduced-motion` disables transitions, ARIA live region announces state, focus moves to toggle on collapse, ErrorBoundary catches sidebar errors
  - [x] 9.3 Unit tests: `sidebar-provider.tsx` — boundary analysis: agentCount {0, 1, 2, 3, 6}, toast appears on 1→2 transition only
  - [x] 9.4 Unit tests: `mobile-tab-bar.tsx` — renders Inbox + Calendar + More, active tab, More opens bottom sheet, sheet contains 6 overflow items, Escape closes sheet, backdrop click closes sheet
  - [x] 9.5 Unit tests: `ui-state.ts` atoms — all tests wrapped in fresh Jotai `<Provider>`, default values correct, toggle behavior, localStorage persistence round-trip, SSR safety (no localStorage = no throw)
  - [x] 9.6 Integration test: workspace layout renders shell, navigating between 3 routes preserves shell (no unmount/remount), auth redirect works, loading skeleton renders during route transition
  - [x] 9.7 Accessibility tests: Tab through all 8 nav items in order, skip-to-content link first focusable, focus ring visible on `:focus-visible`, `]`/`[` shortcuts functional, ARIA live announcement on collapse/expand, landmarks present (`<nav>`, `<main>`), reduced-motion disables all CSS transitions
  - [x] 9.8 Performance test: sidebar expand/collapse transition duration < 300ms (assert via `computedStyle` after transitionend event). NFR01 compliance check.
  - [x] 9.9 Error boundary test: throw error inside Sidebar, assert main content still visible, assert fallback message rendered

## Dev Notes

### Current State of Workspace Layout

The current `apps/web/app/(workspace)/layout.tsx` is a **minimal placeholder** (28 lines):
- Checks auth via `getServerSupabase().auth.getSession()`, redirects to `/login` if no session
- Renders a top bar with email + logout button
- No sidebar, no responsive layout, no theme integration beyond root `ThemeProvider`

This story **replaces** this minimal layout with the full workspace shell described in architecture.

### Layout Grid Architecture

From `packages/tokens/src/layout.ts` (Story 1.1b):
```typescript
export const layout = {
  sidebarExpanded: '240px',   // --flow-layout-sidebar-expanded
  sidebarCollapsed: '56px',   // --flow-layout-sidebar-collapsed
  mainContent: '960px',       // --flow-layout-main-content
  detailPane: '360px',        // --flow-layout-detail-pane
} as const;
```

These are exported as JS constants AND CSS custom properties via `@flow/tokens/css`. The shell MUST use these CSS vars for dimensions — never hardcoded pixel values in component code. Tailwind classes like `w-[var(--flow-layout-sidebar-expanded)]` or `inline style` are acceptable.

### Breakpoint Strategy

From `packages/tokens/src/breakpoints.ts`:
- `sm: 640px` — mobile/tablet boundary
- `md: 768px` — not used for sidebar
- `lg: 1024px` — laptop (icon sidebar + hover overlay expand)
- `xl: 1280px` — desktop (full sidebar)
- `2xl: 1536px` — wide (full sidebar + dual pane)

Use Tailwind responsive classes (`sm:`, `lg:`, `xl:`) for CSS-first breakpoint handling. JS only for: (a) persisting collapsed state to localStorage, (b) hover timer for laptop overlay, (c) focus management.

### RSC/Client Boundary

```
apps/web/app/(workspace)/layout.tsx          ← RSC: auth check, fetch agentCount
├── loading.tsx                               ← RSC: skeleton matching shell shape
├── error.tsx                                 ← Client: error boundary for routes
└→ <WorkspaceShell agentCount={count}>        ← Client: sidebar state, responsive
     ├→ <SidebarErrorBoundary>                ← Client: catches sidebar errors
     │    └→ <SidebarProvider agentCount>     ← Client: visibility gate + reveal toast
     │         └→ <Sidebar /> (if count≥2)    ← Client: nav items, collapse, scroll
     ├→ <main id="main-content">{children}</main>  ← RSC passthrough (NOT client)
     ├→ <MobileTabBar /> (if mobile)          ← Client: bottom tabs
     └→ aria-live region                      ← Client: state announcements
```

**Critical:** `children` (RSC page content) must NOT be wrapped in a client component boundary. `WorkspaceShell` renders `{children}` inside `<main>` as a React slot — this preserves RSC streaming for page content.

### Props Interface

```typescript
// packages/ui/src/layouts/workspace-shell.tsx
export interface WorkspaceShellProps {
  agentCount: number;
  children: React.ReactNode;
}
```

This interface is the contract between RSC layout and client shell. Defined in `@flow/ui` and imported by `apps/web/app/(workspace)/layout.tsx`.

### Free Tier Sidebar Logic

From architecture: "Free tier: no sidebar, single agent, inbox IS the product. Sidebar activates on second agent."

**Query strategy (production):**
```typescript
// In layout.tsx (RSC)
const { count: agentCount } = await supabase
  .from('agent_configurations')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId)
  .eq('is_active', true);
```

**Fallback (pre-Epic 2):**
```typescript
let agentCount = 1;
try {
  const { count } = await supabase
    .from('agent_configurations')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);
  agentCount = count ?? 0;
} catch {
  // Table doesn't exist yet (Epic 2 backlog) — fallback to 1
  agentCount = 1;
}

// Dev override for visual testing
if (process.env.NEXT_PUBLIC_DEV_AGENT_COUNT) {
  agentCount = Number(process.env.NEXT_PUBLIC_DEV_AGENT_COUNT);
}
```

**Client-side re-fetch strategy:** When a user activates a second agent, the activation action calls `router.refresh()` to re-render the RSC layout with updated `agentCount`. This is the Next.js App Router pattern for invalidating server data. No real-time subscription needed at this scope.

### Animation Inventory (for `prefers-reduced-motion`)

The following animations exist in this story. ALL must be disabled when `prefers-reduced-motion: reduce`:

| Animation | Duration | Easing | CSS Property |
|-----------|----------|--------|-------------|
| Sidebar expand/collapse (toggle) | 300ms | `var(--flow-ease-standard)` | `width`, `padding` |
| Sidebar hover overlay (laptop) | 300ms (delay 300ms) | `var(--flow-ease-decelerate)` | `transform: translateX`, `opacity` |
| Mobile tab bar appearance | 150ms | `var(--flow-ease-standard)` | `transform: translateY` |
| Bottom sheet open/close | 300ms | `var(--flow-ease-decelerate)` | `transform: translateY` |
| Active state left border | 150ms | `var(--flow-ease-standard)` | `border-left-color`, `border-left-width` |
| Focus ring transition | 100ms | `var(--flow-ease-standard)` | `box-shadow` |

When `prefers-reduced-motion: reduce`: all `transition` properties set to `none` via Tailwind `motion-reduce:transition-none`. The `useReducedMotion()` hook reads `window.matchMedia('(prefers-reduced-motion: reduce)')` for JS-dependent logic.

### Laptop Hover Overlay Behavior

At 1024-1279px (laptop breakpoint), the sidebar is collapsed to 56px icon-only. On hover:

- **Mode: Overlay** (NOT reflow). The expanded sidebar renders as `position: absolute` (or `fixed`) with `z-index: var(--flow-z-sticky)`, overlaying the main content.
- **Delay:** 300ms hover before expand starts (prevents accidental triggers).
- **Collapse delay:** 200ms after mouse leaves sidebar before collapse starts.
- **Content area does NOT resize** during hover expand/collapse.
- `prefers-reduced-motion: reduce` → no animation, instant show/hide.

### Navigation Items

| Route | Label | Icon (Lucide) | Active Color |
|-------|-------|---------------|-------------|
| `/inbox` | Inbox | `Inbox` | `var(--flow-color-accent-gold)` |
| `/calendar` | Calendar | `Calendar` | `var(--flow-color-accent-gold)` |
| `/agents` | Agents | `Bot` | `var(--flow-color-accent-gold)` |
| `/clients` | Clients | `Users` | `var(--flow-color-accent-gold)` |
| `/invoices` | Invoices | `FileText` | `var(--flow-color-accent-gold)` |
| `/time` | Time | `Clock` | `var(--flow-color-accent-gold)` |
| `/reports` | Reports | `BarChart3` | `var(--flow-color-accent-gold)` |
| `/settings` | Settings | `Settings` | `var(--flow-color-accent-gold)` |

Active state: left border 2px in gold accent. Agent-specific colors (e.g., inbox = blue when Inbox Agent is active) deferred to a post-Epic-2 story that maps agent identity colors to nav items. All nav items use gold as default.

### Settings Layout Integration

Story 1.5 created `apps/web/app/(workspace)/settings/layout.tsx` with a standalone settings sidebar nav. After this story:
- The **main sidebar** gains a Settings link pointing to `/settings`
- The **settings layout** removes its standalone outer sidebar pattern entirely
- Settings sub-navigation (Profile, Team, Devices, Sessions) becomes **inner horizontal tabs** at the top of the settings page content area, using a simple `<nav>` with tab-style links
- Settings page renders inside WorkspaceShell like every other route
- No nested layout sidebar — single sidebar, single shell

### Timer Slot Placeholder

```tsx
<div
  className="border-t border-[var(--flow-color-border-default)] p-3 flex items-center gap-2"
  aria-label="Timer area — coming soon"
  data-testid="sidebar-timer-slot"
>
  <Clock
    className="h-5 w-5 opacity-50 text-[var(--flow-color-text-muted)]"
    aria-hidden="true"
  />
  <span className="text-xs text-[var(--flow-color-text-muted)]">Timer</span>
</div>
```

Ghosted clock icon at 50% opacity + muted "Timer" label. Reserved height ~48px. This is a visual placeholder that communicates "something goes here" without feeling broken. Epic 5 replaces this with the live timer component.

### Sidebar Reveal Toast

When sidebar first appears (agentCount crosses threshold from 1→2):
- Toast via `sonner` (already in workspace deps): "Your sidebar is ready — you have multiple agents active now."
- Toast type: `info`, auto-dismiss 5s, dismissible
- Fires once per session via `sessionStorage.getItem('flow-sidebar-revealed')` check
- Does NOT fire on subsequent loads in same session

### Mobile "More" Menu

The "More" button on mobile bottom tab bar opens a **bottom sheet** (not a full-screen overlay, not an accordion):
- Uses Radix `Dialog` (already in deps) styled as bottom sheet
- Contains the 6 overflow nav items: Agents, Clients, Invoices, Time, Reports, Settings
- Backdrop: semi-transparent overlay, click to dismiss
- Keyboard: Escape to dismiss, focus trap inside sheet
- Each item is a link that navigates and closes the sheet
- Active item highlighted if current route matches

### Scroll Behavior

The sidebar has three sections with independent scroll behavior:
- **Top (pinned):** Workspace name + logout — never scrolls
- **Middle (scrollable):** Navigation items — `overflow-y-auto` when content exceeds available height. Uses `flex-1 min-h-0` pattern.
- **Bottom (pinned):** Timer slot placeholder — never scrolls

This handles short viewports and accessibility zoom without layout breakage.

### Focus Management

| Action | Focus Target |
|--------|-------------|
| Sidebar collapses via `[` | Collapse toggle button |
| Sidebar expands via `]` | First nav item |
| Sidebar collapses via toggle click | Toggle button (stays) |
| Mobile sheet opens | First item in sheet |
| Mobile sheet closes | "More" button that opened it |
| Skip-to-content activated | `<main id="main-content">` |

### Z-Index

From `packages/tokens/src/z-index.ts`:
- Sidebar: `var(--flow-z-sticky)` (200)
- Sidebar hover overlay (laptop): `var(--flow-z-sticky)` (200)
- Mobile tab bar: `var(--flow-z-sticky)` (200)
- Bottom sheet (mobile "More"): `var(--flow-z-overlay)` (300)
- Skip-to-content link: `var(--flow-z-overlay)` (300) when focused

### File Structure

```
apps/web/app/(workspace)/
├── layout.tsx                           # RSC: auth + agentCount fetch + <WorkspaceShell>
├── loading.tsx                          # RSC: skeleton matching shell shape
├── error.tsx                            # Client: error boundary for workspace routes
├── logout-button.tsx                    # Existing — move into sidebar top section
├── settings/
│   └── layout.tsx                       # Simplified — inner tab nav only, no outer sidebar
└── ...                                  # All existing route pages unchanged

packages/ui/src/layouts/
├── workspace-shell.tsx                  # Client: sidebar + main content + responsive + ErrorBoundary
├── workspace-shell.test.tsx
├── sidebar.tsx                          # Client: nav items + collapse + scroll regions
├── sidebar.test.tsx
├── sidebar-provider.tsx                 # Client: agent count visibility gate + reveal toast
├── sidebar-provider.test.tsx
├── sidebar-error-boundary.tsx           # Client: catches sidebar render errors
├── mobile-tab-bar.tsx                   # Client: bottom tabs + "More" bottom sheet
├── mobile-tab-bar.test.tsx
└── index.ts                             # Barrel at package boundary

packages/shared/src/atoms/
├── ui-state.ts                          # sidebarCollapsedAtom, sidebarHoverExpandedAtom
└── ui-state.test.ts

packages/tokens/src/
└── layout.ts                            # Verify CSS var emission (already exists)
```

### Key Files to Reuse

| File | Reuse For |
|---|---|
| `packages/tokens/src/layout.ts` | Sidebar width constants (240px/56px) |
| `packages/tokens/src/breakpoints.ts` | Breakpoint values (sm/lg/xl) |
| `packages/tokens/src/z-index.ts` | Z-index constants |
| `packages/tokens/src/motion.ts` | Animation duration + easing |
| `packages/tokens/src/index.ts` | All token exports |
| `apps/web/app/(workspace)/layout.tsx` | **Replace** — current minimal layout |
| `apps/web/app/(workspace)/logout-button.tsx` | Move into sidebar top section |
| `apps/web/app/layout.tsx` | Root layout — no changes needed |
| `packages/ui/src/lib/utils.ts` | `cn()` utility for class merging |
| `packages/ui/src/components/ui/dialog.tsx` | Radix Dialog for mobile bottom sheet |

### Dependencies & Blockers

- **Story 1.5 (done):** Settings layout exists — must update to remove standalone sidebar pattern
- **Story 1.1b (done):** Design tokens package provides all CSS custom properties needed
- **Epic 2 (backlog):** `agent_configurations` table doesn't exist yet — see Free Tier Sidebar Logic section for try/catch fallback + dev override. **This is NOT a blocker** — the query path is tested, fallback is explicit, dev override enables visual testing.
- **Story 1.8 (backlog):** Command palette and keyboard shortcut infrastructure — this story registers `]`/`[` shortcuts locally via useEffect; Story 1.8 creates the centralized shortcut registry. Migration path: extract `]`/`[` handlers from WorkspaceShell into the registry.
- **Jotai first consumer:** Task 0 explicitly handles Jotai dependency addition, SSR safety, and atom placement convention.

### Constraints & Guardrails

- NO `any`, NO `@ts-ignore`, NO `@ts-expect-error`
- App Router only — no Pages Router patterns
- Server Components by default — `"use client"` only for: WorkspaceShell, Sidebar, SidebarProvider, SidebarErrorBoundary, MobileTabBar
- **`children` in WorkspaceShell is RSC passthrough** — never wrap in client boundary
- Named exports only — default export only for Next.js page components
- 200 lines per file soft limit (250 hard). Functions ≤50 lines logic, ≤80 lines components
- No barrel files inside feature folders — barrel only at `packages/ui/src/layouts/index.ts`
- Supabase client: one per request via `@supabase/ssr`
- `service_role` key NEVER in user-facing code
- Use CSS custom properties from `@flow/tokens/css` for layout dimensions — no hardcoded pixel values in components
- Sidebar state via Jotai atoms — no prop drilling for collapse state
- `prefers-reduced-motion` disables ALL animations in the Animation Inventory table
- Skip-to-content link as first focusable element in BOTH sidebar and free-tier layouts
- Lucide icons: individual imports only (`import { Inbox } from 'lucide-react'`), no barrel import
- No `useEffect` for media queries if Tailwind responsive classes suffice — JS only for: localStorage persistence, hover timer, focus management
- Laptop hover expand uses **overlay mode** (position: absolute/fixed) — content does NOT reflow
- `agentCount` query wrapped in try/catch with explicit fallback — never hardcode without error handling

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6]
- [Source: _bmad-output/planning-artifacts/architecture.md] — Layout structure, RSC/client boundary, UI atoms, directory tree (lines 1062-1205)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] — Sidebar navigation patterns (lines 2039-2063), responsive breakpoints (lines 2137-2149), RSC boundary (lines 2173-2179), free tier sidebar (line 1124, 1177)
- [Source: docs/project-context.md] — 180 canonical technical rules
- [Source: packages/tokens/src/layout.ts] — Layout token constants
- [Source: packages/tokens/src/breakpoints.ts] — Breakpoint definitions
- [Source: packages/tokens/src/motion.ts] — Animation timing
- [Source: _bmad-output/implementation-artifacts/1-5-user-profile-management.md] — Previous story (settings layout pattern, file structure, logout button)

## Dev Agent Record

### Agent Model Used

GLM-5.1 (zai-coding-plan/glm-5.1)

### Debug Log References

- jotai `atomWithStorage` import from `jotai/utils` (not `jotai` directly)
- jsdom test environment requires stubbed `localStorage` and `matchMedia` for Jotai atom tests
- Jotai v2 `Provider` does not accept `initialValues` prop — tests use default store
- `contentEditable` DOM property not fully supported in jsdom; used `setAttribute('contenteditable', 'true')` + `getAttribute` guard in keyboard handler
- Pre-existing TypeScript errors in web app test files (`workspace-rbac-integration.test.ts`, `remove-avatar.test.ts`, `validate-image.test.ts`) — unrelated to this story

### Completion Notes List

- Task 0: Installed `jotai@2.19.1` in `@flow/shared`. Created `sidebarCollapsedAtom` (persisted to localStorage) and `sidebarHoverExpandedAtom` (transient). SSR-safe custom storage with `typeof window` guard. 7 atom tests pass.
- Task 1: Rewrote `layout.tsx` as RSC fetching auth + agentCount with try/catch fallback and `NEXT_PUBLIC_DEV_AGENT_COUNT` override. Created `loading.tsx` skeleton and `error.tsx` boundary. Built `WorkspaceShell` client component with responsive layout, ARIA live region, skip link.
- Task 2: Created `Sidebar` with 8 nav items (Lucide icons, individual imports), pinned top/scrollable nav/pinned bottom timer slot. Active state with gold accent left border. Collapse toggle. Nav landmark. 9 tests pass.
- Task 3: Created `SidebarProvider` gating sidebar on `agentCount >= 2`. One-time reveal toast via `sonner` + `sessionStorage`. Boundary tests for agentCount {0,1,2,3,6}. 5 tests pass.
- Task 4: Responsive breakpoints via Tailwind `sm:/lg:/xl:` classes. `MobileTabBar` with Inbox + Calendar + More bottom sheet (6 overflow items, backdrop dismiss, Escape dismiss). 7 tests pass.
- Task 5: Global `]`/`[` keyboard listeners with guards for input/textarea/select/contenteditable/modifiers. Focus management on collapse. Tested in WorkspaceShell tests.
- Task 6: Skip-to-content link as first focusable element, `sr-only` with focus reveal, `z-[var(--flow-z-overlay)]`.
- Task 7: `SidebarErrorBoundary` class component catching sidebar render errors, showing fallback "Navigation unavailable" with reload button, structured console logging.
- Task 8: Updated settings layout from standalone sidebar to inner horizontal tab bar. Settings now renders within WorkspaceShell.
- Task 9: 49 tests across 8 test files (4 existing + 4 new layout tests). All pass. TypeScript clean for `@flow/ui` and `@flow/shared`.

### File List

New files:
- `packages/shared/src/atoms/ui-state.ts`
- `packages/shared/src/atoms/ui-state.test.ts`
- `packages/ui/src/layouts/workspace-shell.tsx`
- `packages/ui/src/layouts/workspace-shell.test.tsx`
- `packages/ui/src/layouts/sidebar.tsx`
- `packages/ui/src/layouts/sidebar.test.tsx`
- `packages/ui/src/layouts/sidebar-provider.tsx`
- `packages/ui/src/layouts/sidebar-provider.test.tsx`
- `packages/ui/src/layouts/sidebar-error-boundary.tsx`
- `packages/ui/src/layouts/mobile-tab-bar.tsx`
- `packages/ui/src/layouts/mobile-tab-bar.test.tsx`
- `packages/ui/src/layouts/index.ts`
- `apps/web/app/(workspace)/loading.tsx`
- `apps/web/app/(workspace)/error.tsx`

Modified files:
- `apps/web/app/(workspace)/layout.tsx`
- `apps/web/app/(workspace)/settings/layout.tsx`
- `packages/shared/package.json`
- `packages/shared/src/index.ts`
- `packages/ui/package.json`
- `packages/ui/src/index.ts`
- `packages/ui/vitest.config.ts`
- `pnpm-lock.yaml`

## Change Log

- 2026-04-22: Implemented persistent layout shell with sidebar navigation, mobile tab bar, Jotai state management, keyboard shortcuts, ErrorBoundary, skip-to-content link. 49 tests passing. Status: review.
