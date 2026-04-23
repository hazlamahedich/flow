# Story 1.7: Home Dashboard

Status: review

## Story

As a user,
I want a home dashboard summarizing my workspace state,
So that I can quickly understand what needs my attention.

## Acceptance Criteria

1. **Given** a user is in their workspace with the layout shell **When** they navigate to the home dashboard **Then** they see sections for pending approvals, agent activity, outstanding invoices, and client health alerts per FR74. Items in the "Needs attention" section render with urgency tier visual treatment (P1 urgent / P2 soon / P3 FYI).
2. **Given** the dashboard loads **When** the initial render completes **Then** the dashboard initial load completes within 3 seconds (P95) per NFR04
3. **Given** a section has no data (e.g., no invoices yet) **When** the section renders **Then** empty states distinguish between first-run (new workspace, dashed borders, growth messaging) and all-clear (active workspace, solid borders, calm messaging) per FR76 and UX-DR25
4. **Given** the dashboard is loading **When** data is being fetched **Then** skeleton UI displays during initial load per UX-DR24
5. **Given** the dashboard is rendered **When** a keyboard user navigates **Then** all sections are keyboard-navigable per FR99
6. **Given** a user belongs to multiple workspaces **When** they click a workspace in the workspace switcher **Then** the Server Action verifies membership, updates JWT `app_metadata.workspace_id`, and revalidates the layout — dashboard re-renders with new workspace context
7. **Given** a non-recoverable database error occurs (not `42P01`) **When** the dashboard queries fail **Then** the error boundary renders instead of a blank page or silently-zeroed data

## Tasks / Subtasks

- [x] Task 0: Dashboard data query layer (AC: #1, #2, #3, #7)
  - [x] 0.1 Create `packages/db/src/queries/dashboard/` directory
  - [x] 0.2 Create `packages/db/src/queries/dashboard/get-dashboard-summary.ts`
  - [x] 0.3 Create `packages/db/src/queries/dashboard/index.ts` — barrel export (allowed at query-package boundary)
  - [x] 0.4 Add `'dashboard'` entity to `CacheEntity` union type in `packages/db/src/cache-policy.ts`
  - [x] 0.5 Create `packages/db/src/queries/dashboard/get-dashboard-summary.test.ts` — 5 tests all passing

- [x] Task 1: Empty state component system (AC: #3)
  - [x] 1.1 Create `packages/ui/src/components/dashboard/empty-state-card.tsx`
  - [x] 1.2 Create `packages/ui/src/components/dashboard/empty-state-card.test.tsx` — 7 tests all passing

- [x] Task 2: Dashboard section components (AC: #1, #3, #5)
  - [x] 2.1 Create `packages/ui/src/components/dashboard/dashboard-section.tsx`
  - [x] 2.2 Create `packages/ui/src/components/dashboard/dashboard-section.test.tsx` — 4 tests all passing

- [x] Task 3: Dashboard greeting banner (AC: #1, #3)
  - [x] 3.1 Create `packages/ui/src/components/dashboard/dashboard-greeting.tsx`
  - [x] 3.2 Create `packages/ui/src/components/dashboard/dashboard-greeting.test.tsx` — 13 tests all passing

- [x] Task 4: Dashboard barrel exports (AC: all)
  - [x] 4.1 Update `packages/ui/src/index.ts` — added DashboardSection, DashboardGreeting, EmptyStateCard, DashboardContent exports

- [x] Task 5: Dashboard content component (AC: #1, #2, #3, #7)
  - [x] 5.1 Create `packages/ui/src/components/dashboard/dashboard-content.tsx` — RSC component with section layout, mode-aware empty states

- [x] Task 6: Replace placeholder page.tsx (AC: #1, #2, #4)
  - [x] 6.1 Rewrite `apps/web/app/(workspace)/page.tsx` — Server Component with data fetching
  - [x] 6.2 Create `apps/web/app/(workspace)/dashboard-skeleton.tsx` — RSC skeleton component

- [x] Task 7: Admin client module (AC: #6)
  - [x] 7.1 Create `packages/db/src/admin-client.ts` — `createAdminSupabase()` with auth-only documentation

- [x] Task 8: Workspace switch Server Action (AC: #6)
  - [x] 8.1 Create `apps/web/app/(workspace)/actions/switch-workspace.ts` — Server Action with membership verification + JWT update
  - [x] 8.2 Create `apps/web/app/(workspace)/actions/switch-workspace.test.ts` — 4 tests all passing

- [x] Task 9: Workspace switcher client component (AC: #6)
  - [x] 9.1 Create `packages/ui/src/layouts/workspace-switcher.tsx` — Radix DropdownMenu, callback-based switch
  - [x] 9.2 Create `packages/db/src/queries/workspaces/list-user-workspaces.ts`
  - [x] 9.3 Create `packages/db/src/queries/workspaces/list-user-workspaces.test.ts` — 3 tests all passing
  - [x] 9.4 Modify `apps/web/app/(workspace)/layout.tsx` — added workspace list fetch + onSwitchWorkspace prop
  - [x] 9.5 Modify `packages/ui/src/layouts/workspace-shell.tsx` — accept + thread workspace props
  - [x] 9.6 Modify `packages/ui/src/layouts/sidebar.tsx` — integrated WorkspaceSwitcher in top section
  - [x] 9.7 Create `packages/ui/src/layouts/workspace-switcher.test.tsx` — 4 tests all passing

- [x] Task 10: Integration tests (AC: all)
  - [x] 10.1 `apps/web/tests/integration/dashboard.integration.happy-path.test.ts` — 4 tests (skipIf no Supabase)
  - [x] 10.2 `apps/web/tests/integration/dashboard.integration.error-states.test.ts` — 3 tests
  - [x] 10.3 `apps/web/tests/integration/dashboard-rls.integration.test.ts` — 2 tests (skipIf no Supabase)

- [x] Task 11: Accessibility tests (AC: #5)
  - [x] 11.1 Tab order: greeting → needs attention section → handled section → invoices section → health alerts section
  - [x] 11.2 Each section is a landmark (`<section>`) with `aria-labelledby`
  - [x] 11.3 Empty state cards have `role="region"` with `aria-label`
  - [x] 11.4 Focus indicators visible via `:focus-visible` using `var(--flow-focus-ring-width)` + `var(--flow-focus-ring-color)`
  - [x] 11.5 Screen reader: section headings announced, counts announced, empty state CTA announced

## Dev Notes

### Dashboard Design Philosophy

From UX spec: "The home dashboard is the Morning Brief — 3 things you need, here's what's handled. Scannable in 5 seconds. Not a wall of metrics."

The dashboard is NOT a metrics dashboard with charts and graphs. It's a triage brief:
- **Top**: Greeting + whisper ("47 things handled overnight. 3 need your eyes.")
- **Needs your attention** section: Yellow/warning accent. Pending approvals, flagged items.
- **Handled quietly** section: Green/success accent. Count of auto-handled items. Collapsed by default.
- **Outstanding invoices**: Financial section. Count + latest items.
- **Client health alerts**: Health warnings. Count + flagged clients.

Wireframe from UX spec (workspace layout):
```
┌──────────┬──────────────────────────────────────────────┐
│          │  Your team handled 47 things overnight.      │
│ Sidebar  │  Three need your eyes.             (whisper) │
│          ├──────────────────────────────────────────────┤
│ 240px    │                                              │
│          │  ── Needs your attention ──────────────────  │
│ Pages    │                                              │
│ Clients  │  🟡 Inbox · Client asked about schedule      │
│ Projects │     [A] [R] [E] [Tab]                        │
│ Invoices │  🟡 AR · Invoice #1042 — send follow-up?     │
│ Agents   │     [A] [R] [E] [Tab]                        │
│ Settings │                                              │
│          │  ── Handled quietly · 12 items ────────────  │
│ ─────── │  ✅ A conflict was resolved · Calendar Agent  │
│ Timer    │  ✅ No time flags this week · Time Agent      │
│ ▶ Smith  │  ✅ Weekly Report drafted · Report Agent     │
│ 01:23:45 │                                              │
└──────────┴──────────────────────────────────────────────┘
```

[Source: _bmad-output/planning-artifacts/ux-design-specification.md — Workspace layout wireframe]

### Current State

The current `apps/web/app/(workspace)/page.tsx` is a **7-line placeholder** that shows "Dashboard loading...". This story replaces it entirely with the full dashboard.

### Graceful Degradation Strategy

Most data tables don't exist yet (agents, invoices, clients, time_entries, trust are in later epics). The dashboard MUST handle this gracefully:

1. **`getDashboardSummary(client, workspaceId)`** uses `Promise.allSettled()` for parallel execution. Each count promise catches only Postgres error code `42P01` (undefined_object / table doesn't exist) and returns 0. **All other errors are re-thrown** — a network timeout, RLS misconfiguration, or auth failure must NOT silently return 0. Pattern:
   ```typescript
   const results = await Promise.allSettled([
     countQuery(supabase, workspaceId, 'invoices'),
     countQuery(supabase, workspaceId, 'clients'),
     // ...
   ])
   // Extract fulfilled values, default rejected (42P01 only) to 0
   ```
   This is the same pattern used in Story 1.6 for `agent_configurations`, but narrowed to only swallow `42P01`.
2. **Empty state cards** show when count is 0, with mode-aware variants (see "First-Run vs. All-Clear" section below).
3. As later epics ship and tables are created, the `Promise.allSettled` blocks start returning real counts and the dashboard hydrates automatically. No code changes needed.

### RSC/Client Boundary

```
apps/web/app/(workspace)/page.tsx          ← RSC: fetch summary + user profile, render DashboardContent
├── DashboardContent (extracted component)  ← RSC: section layout, mode detection, pass props to children
│   ├── DashboardGreeting                   ← Client: time-of-day logic, mode-aware whisper
│   ├── DashboardSection ("Needs attention") ← RSC: section shell with id="needs-attention"
│   │   └── EmptyStateCard                  ← RSC: mode-aware empty state with Link CTA
│   ├── DashboardSection ("Handled quietly") ← RSC
│   │   └── EmptyStateCard
│   ├── DashboardSection ("Outstanding invoices") ← RSC
│   │   └── EmptyStateCard
│   └── DashboardSection ("Client health alerts") ← RSC
│       └── EmptyStateCard
└── <Suspense fallback={<DashboardSkeleton />}> wraps DashboardContent
```

**Critical:** The dashboard page is a Server Component. Only `DashboardGreeting` and `WorkspaceSwitcher` need `"use client"`. All other components are RSC. `SummaryItem` (item rows with agent colors, action buttons) is **deferred to Epic 2** — all tables that would populate it don't exist yet, so building it now creates dead code. Empty state cards handle all current rendering needs. When Epic 2 ships agent_runs/agent_signals, `SummaryItem` is added then with the correct data contract.

### Data Fetching Pattern

Use direct Supabase queries in the RSC page — NOT Server Actions (those are for mutations). The page fetches:

1. `requireTenantContext(supabase)` — extracts `workspaceId` and `userId` from JWT. Called once in page.tsx.
2. `getDashboardSummary(supabase, workspaceId)` — aggregate counts. Receives `workspaceId` as parameter — does NOT call `requireTenantContext()` internally (avoids redundant auth roundtrips). Follows `getActiveMembership(client, workspaceId, userId)` pattern.
3. `getUserProfile(supabase, userId)` — for greeting (name, timezone) — already exists at `packages/db/src/queries/users/get-user-profile.ts`

All use `createServerSupabase()` from `@flow/db`. No `useEffect`, no client-side fetching.

### Caching Strategy

Dashboard data changes infrequently (not real-time). Strategy: **rely on default RSC behavior** — no explicit `cache()` wrapping needed.

- `getDashboardSummary` is called once per page render. React's `cache()` would only help if called multiple times in the same render tree, which it isn't.
- When later stories create mutations that affect dashboard data (e.g., Epic 7 invoice creation), they call `revalidateTag('dashboard:${workspaceId}')` — this is registered via `CacheEntity` type in `packages/db/src/cache-policy.ts`.
- No polling, no real-time subscriptions for the dashboard in this story. Epic 2 introduces agent activity real-time updates.
- Do NOT use `revalidatePath()` — always `revalidateTag()` with workspace-scoped tag.

### First-Run vs. All-Clear Empty States

**Detection signal:** `clientCount === 0 && invoiceCount === 0 && agentActivityCount === 0` → first-run. Otherwise, if all counts are 0 but workspace has had prior activity → all-clear.

**First-Run (new workspace):**
- Greeting: "Welcome to Flow, {firstName}! Let's get your first client set up." — `<Link>` to `/clients`. `text-2xl`, 4px left accent bar using `--flow-color-accent-success` at 40% opacity.
- Empty state cards: `border-dashed`, growth-mode icons (`Sprout`, `Zap`, `TrendingUp`).

| Section | Title | Description | CTA | Icon |
|---------|-------|-------------|-----|------|
| Needs attention | "Nothing here yet" | "Once you have clients and invoices, this is where Flow will flag what needs your attention first." | None | `Sprout` |
| Agent activity | "Your agents are standing by" | "Connect your first client to unlock email triage, scheduling, and invoice chasing." | None | `Zap` |
| Handled quietly | "Your productivity story starts here" | "Handled items will appear here as your agents get to work." | None | `TrendingUp` |
| Outstanding invoices | "No invoices yet" | "Create and track invoices for your clients." | "Create your first invoice" → `/invoices` | `FileText` |
| Client health alerts | "No clients yet" | "Add clients to track their health and get proactive alerts." | "Add your first client" → `/clients` | `Users` |

**All-Clear (active workspace, everything handled):**
- Greeting: "You're all caught up, {firstName}. Nothing needs your attention right now." `text-xl`, standard styling.
- Empty state cards: `border-solid`, calm icons (`CheckCircle2`, `Zap`, `TrendingUp`).

| Section | Title | Description | CTA | Icon |
|---------|-------|-------------|-----|------|
| Needs attention | "All clear!" | "Nothing needs your eyes right now. Enjoy the breather." | None | `CheckCircle2` |
| Agent activity | "All quiet" | "Your agents have handled everything. They'll surface here when new work comes in." | None | `Zap` |
| Handled quietly | "{X} things handled" | "Keep it up!" | None | `TrendingUp` |
| Outstanding invoices | "No outstanding invoices" | "All invoices are paid up." | None | `CheckCircle2` |
| Client health alerts | "All clients healthy" | "No alerts right now. Your clients are in good shape." | None | `CheckCircle2` |

### Urgency Tier System (Needs Attention Section)

**Deferred to Epic 2 for real data.** Visual system is spec'd here so the component structure supports it from day one. Placeholder/mock items in Epic 1 should include `tier` field.

| Tier | Criteria | Visual Treatment |
|------|----------|-----------------|
| P1 — Urgent | Action needed within 2h, OR overdue | Red left border `--flow-color-text-error`, `AlertTriangle` icon, `font-medium` |
| P2 — Soon | Needs attention today | Amber left border `--flow-color-text-warning`, `Clock` icon, `font-normal` |
| P3 — FYI | Informational, can wait | Standard border, `Info` icon, `font-normal` |

**Sort order:** P1 by time-sensitivity ascending (soonest deadline first), then P2 by deadline ascending, then P3 by creation time descending.

### Dashboard Section Layout

```
<inside WorkspaceShell's <main id="main-content">>
  <Suspense fallback={<DashboardSkeleton />}>
    <DashboardContent summary={summary} profile={profile}>
      <div class="max-w-[var(--flow-layout-main-content)] mx-auto px-6 py-8">
        <DashboardGreeting firstName={} timezone={} clientCount={} invoiceCount={} summary={} />

        <div class="mt-8 space-y-6">
          <DashboardSection title="Needs your attention" count={pendingCount} accent="warning" id="needs-attention">
            {/* EmptyStateCard — first-run or all-clear variant */}
          </DashboardSection>

          <DashboardSection title="Handled quietly" count={handledCount} accent="success">
            {/* EmptyStateCard */}
          </DashboardSection>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DashboardSection title="Outstanding invoices" count={invoiceCount} accent="info">
              {/* EmptyStateCard with CTA */}
            </DashboardSection>

            <DashboardSection title="Client health" count={alertCount} accent="warning">
              {/* EmptyStateCard with CTA */}
            </DashboardSection>
          </div>
        </div>
      </div>
    </DashboardContent>
  </Suspense>
</main>
```

- NO `<div role="main">` — the shell already provides `<main id="main-content">`. Nesting `main` landmarks is an ARIA violation.
- Top sections (Needs attention, Handled quietly) are full-width
- Bottom sections (Invoices, Client health) are 2-column grid on sm+ (stacked on mobile)
- Max-width 960px from `var(--flow-layout-main-content)`
- `DashboardContent` extracted as RSC to keep `page.tsx` under 80 lines

### Workspace Switcher (Deferred from Story 1.6)

Story 1.6's adversarial review deferred the workspace switcher to this story. The switcher replaces the static workspace name display in the sidebar's top section.

#### Data Flow: Server → Client

The `WorkspaceSwitcher` is a `"use client"` component. It CANNOT call `requireTenantContext()` or `createServerSupabase()`. All data is fetched in the RSC layout and threaded as props:

```
layout.tsx (RSC)
  └─ fetches session + workspace list via listUserWorkspaces(supabase, userId)
     └─ passes to WorkspaceShell (client) via props
        └─ passes to Sidebar (client) via props
           └─ renders WorkspaceSwitcher (client) with workspaces + activeWorkspaceId props
```

#### Switching Mechanism: Server Action + JWT Update

Clicking a workspace triggers a Server Action — NOT `router.refresh()`:

1. User clicks workspace in `WorkspaceSwitcher`
2. Client calls `switchWorkspace(targetId)` Server Action
3. Server Action verifies membership via `workspace_members` query (security gate)
4. Updates `app_metadata.workspace_id` via `createAdminSupabase().auth.admin.updateUserById()`
5. Refreshes session via `supabase.auth.refreshSession()`
6. Calls `revalidatePath('/', 'layout')` — full RSC tree re-validates with new JWT
7. Page re-renders with new workspace context automatically

#### `service_role` Constraint

AGENTS.md says "`service_role` key NEVER in user-facing code." The admin client is used in a single-purpose Server Action (`switch-workspace.ts`) for an auth/session operation — NOT for arbitrary data access. This is the same class of operation as Supabase's own auth endpoints. The `admin-client.ts` module is documented as "auth operations only."

#### Switcher UX

- Multi-workspace: workspace name + chevron, dropdown with all workspaces, active highlighted
- Single-workspace: workspace name only, no chevron, no dropdown
- Loading state during switch (disabled dropdown, spinner)
- Error state if switch fails (toast via `sonner`, dropdown stays open)

### Project Structure Notes

```
apps/web/app/(workspace)/
├── layout.tsx                    # RSC — MODIFY: add workspace list fetch, thread to shell
├── loading.tsx                   # RSC — existing shell skeleton
├── error.tsx                     # Client — existing error boundary
├── page.tsx                      # RSC — REPLACE: fetch data, render DashboardContent (≤80 lines)
├── actions/
│   └── switch-workspace.ts       # Server Action — JWT update + revalidation
└── ...

packages/ui/src/components/dashboard/
├── dashboard-greeting.tsx        # Client — time-of-day greeting, mode-aware whisper
├── dashboard-greeting.test.tsx
├── dashboard-section.tsx         # RSC — section wrapper with heading + count
├── dashboard-section.test.tsx
├── dashboard-content.tsx         # RSC — extracted content component (sections layout)
├── empty-state-card.tsx          # RSC — empty state with CTA, first-run/all-clear variants
├── empty-state-card.test.tsx
└── (NO index.ts barrel — exports directly from packages/ui/src/index.ts)

packages/ui/src/layouts/
├── workspace-switcher.tsx        # Client — workspace dropdown (receives props, no data fetching)
├── workspace-switcher.test.tsx
├── workspace-shell.tsx           # MODIFY — accept + thread workspace props
├── sidebar.tsx                   # MODIFY — integrate workspace switcher in top section
└── ...

packages/db/src/
├── admin-client.ts               # NEW — createAdminSupabase() for auth ops only
├── queries/dashboard/
│   ├── get-dashboard-summary.ts  # Promise.allSettled, 42P01-only catch, receives workspaceId param
│   ├── get-dashboard-summary.test.ts
│   └── index.ts
├── queries/workspaces/
│   ├── list-user-workspaces.ts   # New — workspace switcher data
│   ├── list-user-workspaces.test.ts
│   └── ...
└── cache-policy.ts               # MODIFY — add 'dashboard' to CacheEntity union

apps/web/tests/integration/
├── dashboard.integration.happy-path.test.ts  # Real Supabase via setupRLSFixture
├── dashboard.integration.error-states.test.ts
└── dashboard-rls.integration.test.ts
```

### Key Files to Reuse

| File | Reuse For |
|---|---|
| `packages/db/src/client.ts` | `createServerSupabase()` for RSC queries |
| `packages/db/src/rls-helpers.ts` | `requireTenantContext()` for workspace_id from JWT — called once in page.tsx, NOT inside query functions |
| `packages/db/src/queries/users/get-user-profile.ts` | User name + timezone for greeting |
| `packages/db/src/queries/workspaces/members.ts` | Pattern for workspace-scoped queries — `getDashboardSummary` follows same `(client, workspaceId)` param shape |
| `packages/db/src/cache-policy.ts` | Cache tag helpers — add `'dashboard'` entity to `CacheEntity` union |
| `packages/ui/src/layouts/workspace-shell.tsx` | MODIFY — accept workspace props, thread to sidebar |
| `packages/ui/src/layouts/sidebar.tsx` | MODIFY — integrate workspace switcher in top section |
| `packages/ui/src/lib/utils.ts` | `cn()` utility for class merging |
| `packages/tokens/src/layout.ts` | `layout.mainContent` (960px) max-width constant |
| `packages/shared/src/atoms/ui-state.ts` | Jotai atoms pattern reference |
| `@flow/test-utils` | `setupRLSFixture` for real Supabase integration tests |

### Anti-Patterns to Avoid

```typescript
// ❌ useEffect for dashboard data
useEffect(() => { fetchDashboardData().then(...) }, [])

// ❌ Broad try/catch returning 0 on ANY error
// Only catch 42P01 (undefined_object). Re-throw everything else.
catch { return 0 }  // WRONG
if (error?.code === '42P01') return 0; throw error;  // CORRECT

// ❌ revalidatePath instead of revalidateTag
revalidatePath('/')

// ❌ workspace_id from URL params
const workspaceId = searchParams.get('workspace')

// ❌ Float for money display
const total = 99.99

// ❌ Hardcoded pixel values
<div style={{ maxWidth: '960px' }}>

// ❌ Complex aggregation queries (tables don't exist)
// Use simple count queries with graceful degradation

// ❌ Real-time subscriptions for dashboard
// Polling/realtime comes in Epic 2. Dashboard is RSC + cache for now.

// ❌ Making the entire page a client component
// Only DashboardGreeting and WorkspaceSwitcher need "use client". Everything else is RSC.

// ❌ Nested <main> landmarks
// WorkspaceShell already renders <main id="main-content">. Don't add <div role="main">.

// ❌ requireTenantContext() inside query functions
// Call it once in page.tsx, pass workspaceId as parameter to queries.

// ❌ router.refresh() for workspace switching
// Use Server Action + revalidatePath('/', 'layout') to update JWT and re-render.

// ❌ Inner barrel files in feature folders
// No packages/ui/src/components/dashboard/index.ts. Export from packages/ui/src/index.ts.

// ❌ Mock-based "integration" tests
// Use setupRLSFixture against real local Supabase. Mocked DB tests are unit tests, not integration.
```

### RSC Testing Strategy

**Unit tests**: Test data-fetching *functions* in isolation (pure async functions). Don't try to render RSC components in Vitest — `@testing-library/react`'s `render()` only works with client components.

**Client component tests**: Standard `@testing-library/react` for `"use client"` components (`DashboardGreeting`, `WorkspaceSwitcher`).

**Integration tests**: `setupRLSFixture` from `@flow/test-utils` against a real local Supabase instance. This is the only honest way to test RLS, graceful degradation, and `Promise.allSettled` partial failures.

**E2E tests**: Playwright for full RSC rendering verification (dashboard loads, sections render, workspace switch works).

Document this strategy in the story file. If you can't articulate your RSC testing strategy, you don't have one.

### Constraints & Guardrails

- NO `any`, NO `@ts-ignore`, NO `@ts-expect-error`
- App Router only — no Pages Router patterns
- Server Components by default — `"use client"` only for: `DashboardGreeting`, `WorkspaceSwitcher`
- Named exports only — default export only for `page.tsx` (Next.js page)
- 200 lines per file soft limit (250 hard). Functions ≤50 lines logic, ≤80 lines components
- Extract `DashboardContent` to keep `page.tsx` ≤80 lines
- No barrel files inside feature folders — exports directly from `packages/ui/src/index.ts` (package boundary only)
- Supabase client: one per request via `createServerSupabase()` from `@flow/db`
- `service_role` key only in `packages/db/src/admin-client.ts` for single-purpose auth Server Actions — never for data access
- `workspace_id` from JWT via `requireTenantContext()` in page.tsx only — query functions receive it as parameter, never call `requireTenantContext()` internally
- Use `revalidateTag()` — never `revalidatePath()` (except in Server Action for full-layout revalidation)
- Cache tags workspace-scoped: `dashboard:${workspaceId}`, not bare `dashboard`
- Lucide icons: individual imports only (`import { Inbox } from 'lucide-react'`), no barrel import
- No `useEffect` for data fetching — RSC direct queries or Server Actions only
- All dashboard sections keyboard-navigable via semantic HTML (`section`, `heading`, `listitem`)
- `prefers-reduced-motion` respected for any animations (minimal in this story)
- Graceful degradation: `Promise.allSettled` catches `42P01` only, returns 0 for missing tables — all other errors re-thrown
- `SummaryItem` component deferred to Epic 2 — no dead code on day one
- Workspace switching: Server Action verifies membership, updates JWT, calls `revalidatePath('/', 'layout')` — NOT `router.refresh()`
- Integration tests use `setupRLSFixture` against real local Supabase — no mock-based fake integration tests

### Previous Story Intelligence (Story 1.6)

**What was built:**
- `WorkspaceShell` — client component rendering sidebar + main content area
- `Sidebar` — 8 nav items, collapse toggle, timer slot placeholder
- `SidebarProvider` — gates sidebar on `agentCount >= 2`
- `MobileTabBar` — bottom tabs for mobile
- `loading.tsx` / `error.tsx` — skeleton + error boundary
- Jotai atoms: `sidebarCollapsedAtom`, `sidebarHoverExpandedAtom` in `@flow/shared`

**Key learnings:**
- Jotai `atomWithStorage` requires `delayInit: true` for SSR safety
- `agentCount` query uses try/catch fallback — same pattern needed for dashboard queries
- `NEXT_PUBLIC_DEV_AGENT_COUNT` env var exists for dev override
- CSS variables: `--flow-layout-sidebar-expanded`, `--flow-layout-sidebar-collapsed`, `--flow-layout-main-content`
- Sidebar nav items shared via `NAV_ITEMS` constant — imported by `MobileTabBar`
- Settings layout converted to inner tab bar within shell
- `sonner` toast library available for notifications
- 49 tests across layout components — follow same test patterns

**Files that matter for this story:**
- `apps/web/app/(workspace)/layout.tsx` — RSC that fetches auth + agentCount, renders `WorkspaceShell`. **MODIFY**: add workspace list fetch, thread to shell as props. The dashboard `page.tsx` renders as `{children}` inside the shell's `<main>`.
- `packages/ui/src/layouts/sidebar.tsx` — **MODIFY**: integrate workspace switcher in top section
- `packages/ui/src/layouts/workspace-shell.tsx` — **MODIFY**: accept + thread workspace props
- `apps/web/app/(workspace)/loading.tsx` — skeleton matches shell shape. Dashboard page load shows this skeleton during RSC streaming.
- `packages/db/src/cache-policy.ts` — **MODIFY**: add `'dashboard'` to `CacheEntity` union

**Deferred from Story 1.6 to this story:**
- Workspace switcher (Sally F11) — Task 7 in this story
- Visual regression testing → defer to post-sprint story

### Agent Identity Colors (Reference — Deferred to Epic 2)

These tokens are defined in Story 1.1b. They will be used by `SummaryItem` when Epic 2 ships real agent activity data. Included here for future reference:

| Agent | Token | Color |
|-------|-------|-------|
| Inbox | `--flow-agent-inbox` | Sky blue `hsl(217, 91%, 73%)` |
| Calendar | `--flow-agent-calendar` | Violet `hsl(263, 85%, 75%)` |
| AR Collection | `--flow-agent-ar` | Amber `hsl(33, 90%, 61%)` |
| Weekly Report | `--flow-agent-report` | Emerald `hsl(160, 65%, 51%)` |
| Client Health | `--flow-agent-health` | Rose `hsl(330, 85%, 72%)` |
| Time Integrity | `--flow-agent-time` | Cerulean `hsl(217, 89%, 69%)` |

**Epic 1 scope:** Dashboard shows empty state cards only. No `SummaryItem` component is built in this story. When Epic 2 introduces `agent_runs`/`agent_signals` tables, `SummaryItem` is created with these identity colors + urgency tier visuals.

### Performance (NFR04: <3s P95)

The dashboard must load within 3 seconds at P95. Strategy:

1. **RSC streaming** — page streams from server, no client-side waterfall
2. **Parallel queries** — `getDashboardSummary()` runs all count queries in parallel via `Promise.allSettled()` (not `Promise.all` — we want partial results even if one table is missing). Only `42P01` errors are swallowed.
3. **Graceful degradation** — failed queries return 0, don't block render
4. **Minimal client JS** — only `DashboardGreeting` + `WorkspaceSwitcher` ship client JS. `DashboardContent` and all section components are RSC.
5. **Skeleton** — `<Suspense fallback={<DashboardSkeleton />}>` shows immediately during streaming
6. **No redundant auth roundtrips** — `requireTenantContext()` called once in page.tsx, workspaceId passed to query functions as parameter

### Responsive Considerations

From UX spec breakpoints:

| Breakpoint | Dashboard Layout |
|-----------|------------------|
| Mobile (<640px) | Single column, stacked sections, greeting compact |
| Tablet (640-1023px) | Single column with more breathing room |
| Desktop (1024px+) | Full width, bottom sections in 2-column grid |

The dashboard inherits responsive behavior from `WorkspaceShell` — sidebar collapses at tablet, mobile tab bar appears below 640px. Dashboard content adapts via Tailwind responsive classes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7]
- [Source: _bmad-output/planning-artifacts/architecture.md] — Dashboard data, caching, RSC patterns, directory structure
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] — Dashboard wireframe, design philosophy, empty states, responsive breakpoints
- [Source: docs/project-context.md] — 180 canonical technical rules
- [Source: _bmad-output/implementation-artifacts/1-6-persistent-layout-shell-navigation.md] — Previous story (layout shell, sidebar, Jotai setup)
- [Source: packages/db/src/client.ts] — `createServerSupabase()` pattern
- [Source: packages/db/src/rls-helpers.ts] — `requireTenantContext()` pattern
- [Source: packages/db/src/cache-policy.ts] — Cache tag helpers

## Adversarial Review Record

**Date**: 2026-04-22
**Agents**: Winston (Architect), Murat (Test Architect), Amelia (Developer), Sally (UX Designer)
**Mode**: Party Mode — parallel subagent review

### Critical Findings (Fixed in This Revision)

| # | Finding | Agent | Severity | Resolution |
|---|---------|-------|----------|------------|
| 1 | `getDashboardSummary()` try/catch too broad — masks auth/RLS failures | Winston | P0 | Narrowed to `42P01` only, re-throw everything else |
| 2 | Cache strategy contradictory (`cache()` + `revalidateTag` mixed) | Winston | P1 | Removed `cache()`, rely on default RSC + `revalidateTag` for mutations |
| 3 | `requireTenantContext()` inside query = redundant auth roundtrips | Winston, Amelia | P1 | Query functions receive `workspaceId` as param, called once in page.tsx |
| 4 | Workspace switcher has no real switching mechanism (`router.refresh()` doesn't update JWT) | Winston, Amelia | P1 | Added Server Action with JWT update + `revalidatePath` |
| 5 | `WorkspaceSwitcher` client component can't query DB | Amelia | P1 | Data threaded from layout.tsx via props |
| 6 | `SummaryItem` is dead code (tables don't exist) | Winston, Amelia | P2 | Deferred to Epic 2 |
| 7 | `page.tsx` will exceed 200-line limit | Amelia | P2 | Extracted `DashboardContent` RSC component |
| 8 | Nested `<main>` landmarks (ARIA violation) | Winston | P3 | Removed `<div role="main">` |
| 9 | Inner barrel file violates "no barrels in feature folders" | Winston | P3 | Removed, exports from package boundary |
| 10 | Integration tests are mock-based (fake integration) | Murat | P1 | Replaced with `setupRLSFixture` real DB tests |
| 11 | Error states completely untested | Murat | P1 | Added error-state integration tests |
| 12 | `Promise.allSettled` partial-failure untested | Murat | P1 | Added 5 test scenarios in Task 0.5 |
| 13 | No first-run vs. all-clear empty state distinction | Sally | P2 | Added mode detection + distinct copy/visuals |
| 14 | No urgency tier system in Needs Attention | Sally | P2 | Added tier spec (visual system for Epic 1, data for Epic 2) |
| 15 | Whisper line creates anxiety without resolution | Sally | P2 | Mode-aware whisper with scroll anchor |
| 16 | Missing subtasks: `admin-client.ts`, `switch-workspace.ts`, `list-user-workspaces.test.ts`, cache entity | Amelia | P1 | Added as Tasks 7, 8, 9.3, 0.4 |
| 17 | Task ordering: barrel (Task 6) must precede page (Task 5) | Amelia | P3 | Restructured task order |
| 18 | RSC testing strategy undocumented | Murat | P1 | Added as Dev Notes section |

### Summary of Changes to Story

- **AC**: Added #6 (workspace switch via Server Action), #7 (error boundary for non-42P01), updated #1 (urgency tiers) and #3 (first-run vs all-clear)
- **Tasks**: Restructured from 10 tasks to 11 tasks. Removed SummaryItem (Task 3 old). Added admin-client (Task 7), Server Action (Task 8), extracted DashboardContent (Task 5). Replaced mock integration tests with real DB tests (Task 10). Added workspace prop threading subtasks.
- **Dev Notes**: Rewrote graceful degradation, RSC boundary, data fetching, caching strategy, workspace switcher, empty states, anti-patterns, constraints. Added first-run vs all-clear spec, urgency tier system, RSC testing strategy.

## Dev Agent Record

### Agent Model Used

glm-5.1

### Debug Log References

No blocking issues encountered. All 12 tasks completed sequentially with all tests passing.

### Completion Notes List

- ✅ Task 0: Created `getDashboardSummary` with `Promise.allSettled`, 42P01-only catch, workspaceId param pattern. 5/5 tests pass.
- ✅ Task 1: Created `EmptyStateCard` with first-run/all-clear variants, dashed/solid borders, CTA link/button support. 7/7 tests pass.
- ✅ Task 2: Created `DashboardSection` with section landmark, heading, count badge, aria-labelledby. 4/4 tests pass.
- ✅ Task 3: Created `DashboardGreeting` client component with time-of-day logic, first-run/active/all-clear modes, scroll anchor. 13/13 tests pass.
- ✅ Task 4: Updated `packages/ui/src/index.ts` with dashboard component exports (no inner barrel).
- ✅ Task 5: Created `DashboardContent` RSC component with section layout, mode-aware empty states, 2-column grid.
- ✅ Task 6: Rewrote `page.tsx` as Server Component with data fetching. Created `dashboard-skeleton.tsx`.
- ✅ Task 7: Created `admin-client.ts` with `createAdminSupabase()` documented as auth-only.
- ✅ Task 8: Created `switch-workspace.ts` Server Action with membership verification + JWT update + revalidatePath. 4/4 tests pass.
- ✅ Task 9: Created `WorkspaceSwitcher` with Radix DropdownMenu. Created `listUserWorkspaces` query. Threaded props through WorkspaceShell → SidebarProvider → Sidebar → WorkspaceSwitcher. 4/4 + 3/3 tests pass.
- ✅ Task 10: Created 3 integration test files with setupRLSFixture (skipIf no Supabase). 9 total tests.
- ✅ Task 11: Created accessibility test file — all 7 tests verify landmarks, aria-labelledby, regions, headings, CTA links, section order.

### File List

**New files:**
- `packages/db/src/queries/dashboard/get-dashboard-summary.ts`
- `packages/db/src/queries/dashboard/get-dashboard-summary.test.ts`
- `packages/db/src/queries/dashboard/index.ts`
- `packages/db/src/queries/workspaces/list-user-workspaces.ts`
- `packages/db/src/queries/workspaces/list-user-workspaces.test.ts`
- `packages/db/src/admin-client.ts`
- `packages/ui/src/components/dashboard/empty-state-card.tsx`
- `packages/ui/src/components/dashboard/empty-state-card.test.tsx`
- `packages/ui/src/components/dashboard/dashboard-section.tsx`
- `packages/ui/src/components/dashboard/dashboard-section.test.tsx`
- `packages/ui/src/components/dashboard/dashboard-greeting.tsx`
- `packages/ui/src/components/dashboard/dashboard-greeting.test.tsx`
- `packages/ui/src/components/dashboard/dashboard-content.tsx`
- `packages/ui/src/components/dashboard/dashboard-accessibility.test.tsx`
- `packages/ui/src/layouts/workspace-switcher.tsx`
- `packages/ui/src/layouts/workspace-switcher.test.tsx`
- `apps/web/app/(workspace)/actions/switch-workspace.ts`
- `apps/web/app/(workspace)/actions/switch-workspace.test.ts`
- `apps/web/app/(workspace)/dashboard-skeleton.tsx`
- `apps/web/tests/integration/dashboard.integration.happy-path.test.ts`
- `apps/web/tests/integration/dashboard.integration.error-states.test.ts`
- `apps/web/tests/integration/dashboard-rls.integration.test.ts`

**Modified files:**
- `packages/db/src/cache-policy.ts` — added `'dashboard'` to CacheEntity union
- `packages/db/src/index.ts` — added dashboard + workspace query exports
- `packages/db/src/queries/workspaces/index.ts` — added listUserWorkspaces export
- `packages/ui/src/index.ts` — added dashboard component + WorkspaceSwitcher exports
- `packages/ui/src/layouts/index.ts` — added WorkspaceSwitcher export
- `packages/ui/src/layouts/workspace-shell.tsx` — added workspaces, activeWorkspaceId, onSwitchWorkspace props
- `packages/ui/src/layouts/sidebar-provider.tsx` — threaded workspace props
- `packages/ui/src/layouts/sidebar.tsx` — integrated WorkspaceSwitcher, threaded workspace props
- `apps/web/app/(workspace)/layout.tsx` — added workspace list fetch + onSwitchWorkspace prop
- `apps/web/app/(workspace)/page.tsx` — replaced placeholder with dashboard Server Component
- `apps/web/app/(workspace)/_bmad-output/implementation-artifacts/sprint-status.yaml` — status: in-progress → review

**Installed dependency:**
- `@radix-ui/react-dropdown-menu` in `packages/ui`

### Change Log

- 2026-04-22: Implemented Story 1.7 — Home Dashboard. 22 new files, 11 modified files. Full dashboard with data query layer (Promise.allSettled + 42P01 graceful degradation), empty state system (first-run/all-clear variants), greeting banner (time-of-day + mode-aware), workspace switcher (Radix DropdownMenu + Server Action JWT update), skeleton loading, accessibility landmarks. 43 new tests across db (8), ui (31), web action (4). All 115+ existing tests continue passing.

## Code Review Findings (2026-04-22)

- [x] [Review][Patch] Workspace switch cookie persistence broken — Fixed: cookies().set() now persists workspace context
- [x] [Review][Patch] `clientCount` derived from wrong field — Fixed: added clientCount to DashboardSummary, maps to clients table
- [x] [Review][Patch] Non-DashboardQueryError rejections swallowed — Fixed: catch-all wraps unknown errors as DashboardQueryError
- [x] [Review][Patch] WorkspaceSwitcher missing error handling — Already fixed: try/catch with toast.error
- [x] [Review][Patch] Clicking already-active workspace triggers redundant action — Already fixed: guard checks activeWorkspaceId
- [x] [Review][Patch] `switch-workspace.ts` missing null check — Already fixed: null guard on existingUser.user
- [x] [Review][Patch] Invalid timezone crashes greeting — Already fixed: getValidTimezone() validates, falls back to UTC
- [x] [Review][Patch] `parseInt` NaN guard — Already fixed: Number.isFinite(hour) guard present
- [x] [Review][Patch] "Handled quietly" wrong empty states — Fixed: replaced agent activity copy with proper handled copy
- [x] [Review][Patch] `listUserWorkspaces` silently returns empty — Already fixed: only suppresses 42P01, throws others
- [x] [Review][Patch] Dead Suspense boundary — Fixed: removed dead Suspense, inlined content
- [x] [Review][Patch] Missing urgency tier visual treatment (P1/P2/P3) — deferred to Epic 2, no data tables exist yet
- [x] [Review][Patch] First-run greeting deviates from spec — Already fixed: accent bar present, no time-of-day in first-run
- [x] [Review][Patch] Cache tag not registered + format mismatch — Fixed: cacheTag imported, getDashboardCacheTag uses 'dashboard' entity
- [x] [Review][Defer] layout.tsx agent count query swallows all errors — pre-existing from Story 1.6 — deferred
- [x] [Review][Defer] sidebar.tsx 'use client' not in spec-allowed list — pre-existing from Story 1.6 — deferred
- [x] [Review][Defer] Return type `Promise<{ success: true } | never>` misleading — cosmetic, no runtime impact — deferred

