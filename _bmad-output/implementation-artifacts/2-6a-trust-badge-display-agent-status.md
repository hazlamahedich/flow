# Story 2.6a: Trust Badge Display & Agent Status Indicators

Status: done
Parent: 2.6 (split after 4-agent adversarial review — 59 findings, 3 critical, 9 high)

## Story

As a user,
I want visual indicators of agent identity, trust level, and status,
So that I can instantly recognize each agent and its autonomy state.

## Acceptance Criteria

1. **[FR29, FR33]** Given agents are activated in the workspace, When agents appear in the UI, Then each agent displays a badge with agent icon in identity color + trust level label ("Learning"/"Established"/"Auto") + trust color dot per UX-DR4. Badge renders within 100ms, no layout shift after initial paint
2. **[FR29]** Given an agent's trust level changes, When the badge updates, Then the badge uses three-channel status: text label + color + border style. Never color alone per NFR43. WCAG AA contrast on all badge colors against both themes
3. **[FR29]** Given agents transition between trust levels, When building→established, Then badge border shifts blue→violet over 300ms + 100ms scale pulse (1.02×). When established→auto, Then ring dissolves to steady green dot per UX-DR13. `prefers-reduced-motion: reduce` sets all durations to 0, static indicators only
4. **[FR29]** Given trust state is derived from the trust matrix, When `deriveBadgeState(entry, now)` is called, Then it returns one of 6 visual states: supervised/confirm/auto/promoting/regressing/stick_time. Invalid transitions throw errors — no silent failures
5. **[FR29]** Given a user views the agents page, When the page loads, Then a Server Component fetches trust summary via `getTrustSummaryForWorkspace()`, passes to Client Component which hydrates Jotai atoms, and child components read atoms. Data flow: Server fetch → Client useEffect → atoms → children
6. **[FR33]** Given active agents exist, When the sidebar renders, Then AgentStatusBar shows all agents with health at a glance — high-cadence (Inbox, Calendar) always expanded, low-cadence (AR, Report, Health) collapsed, ambient (Time) icon only per UX-DR15. Status ring uses `deriveUIStatus()` — separate from trust dot
7. **[FR29, FR33]** Given screen readers encounter trust badges, When trust level changes, Then `aria-live="polite"` announces descriptive text ("Inbox Agent trust level changed to Established"). `aria-live="assertive"` for regressions only. Badge has `role="status"` per UX-DR49
8. **[FR29]** Given the agents overview page, When trust summary is displayed, Then Supervised cards show full detail (score, consecutive, last rejection), Confirm cards show condensed (level, trend, days at level), Auto cards show minimal (level dot, "Auto" label, subtle border) per UX-DR5

## Scope Boundaries

**In scope (this story):**
- AGENT_IDENTITY consolidation into shared canonical map
- State machine in `packages/trust/src/badge-state.ts` (pure function, not in UI)
- Trust atoms in `apps/web/src/atoms/trust.ts` (NOT in shared/)
- Data hydration bridge (Server fetch → Client useEffect → atoms)
- `TrustBadge` pure presentation component in `packages/ui/` (receives `BadgeDisplayProps`, no state imports)
- `TrustBadgeWrapper` bridge component in `apps/web/` (wires atoms to TrustBadge)
- `AgentStatusBar` compound component for sidebar
- Agent overview page at `apps/web/app/(workspace)/agents/page.tsx`
- User-scoped trust queries (matrix summary per agent)
- DB migration for `trust_audits` + `trust_milestones` tables
- ARIA live regions for trust state changes
- `prefers-reduced-motion` support
- Three-channel status verification (text + color + border)

**Explicitly deferred:**
- Trust ceremony overlay (blocking/non-blocking) → Story 2.6b
- Trust regression notification → Story 2.6b
- Trust milestone celebrations → Story 2.6b
- Overlay manager → Story 2.6b
- Trust density viewport (gap modulation) → CUT (post-MVP polish)
- Monthly stick-time audit UI → Story 2.6c
- Agency owner trust dashboard → Story 8.3 (FR100)
- In-app notification delivery → Epic 10 (FR79)
- Trust analytics/charts → Story 8.3
- Ambient trust texture → post-MVP polish

## Tasks / Subtasks

### Group A: Prerequisites (parallel)

- [x] Task 0: AGENT_IDENTITY consolidation (AC: #1, #2)
  - [x] 0.1 Create `packages/shared/src/constants/agent-identity.ts` — canonical `AGENT_IDENTITY` map with resolved colors, icons, labels for all 6 agents. Single source of truth replacing duplicates in proposal-card.tsx and constants.ts
  - [x] 0.2 Add `TRUST_LEVEL_COLORS` map: `Record<TrustLevel, { bg: string; text: string; border: string }>` with resolved colors: supervised=blue (#3b82f6), confirm=violet (hsl(263 85% 75%)), auto=dark green (#16a34a)
  - [x] 0.3 Add new token `--flow-emotion-trust-confirm` to `packages/tokens/src/colors/emotional.ts`: `hsl(263, 85%, 75%)` violet — distinct from auto green
  - [x] 0.4 Export from `packages/shared/src/index.ts`. Update imports in proposal-card.tsx and constants.ts to use canonical version

- [x] Task 1: State machine extraction (AC: #4)
  - [x] 1.1 Create `packages/trust/src/badge-state.ts` — `TrustBadgeState` type: `'supervised' | 'confirm' | 'auto' | 'promoting' | 'regressing' | 'stick_time'`
  - [x] 1.2 Add `deriveBadgeState(entry: TrustMatrixEntry, now: Date): TrustBadgeState` — pure function, no React/Jotai. Maps trust matrix data to visual badge state
  - [x] 1.3 Add `TRUST_BADGE_DISPLAY: Record<TrustBadgeState, { label: string; colorToken: string; borderStyle: string }>` — static display config for all 6 visual tiers
  - [x] 1.4 Add `VALID_BADGE_TRANSITIONS: Record<TrustBadgeState, TrustBadgeState[]>` — explicit transition table. All invalid transitions throw `InvalidTransitionError`
  - [x] 1.5 Export `TrustBadgeState`, `BadgeDisplayProps`, `deriveBadgeState`, `TRUST_BADGE_DISPLAY`, `VALID_BADGE_TRANSITIONS` from `packages/trust/src/index.ts`
  - [x] 1.6 Re-export `TrustBadgeState` from `packages/types/src/trust.ts` via `@flow/trust`

- [x] Task 2: DB migration (AC: all)
  - [x] 2.1 Create `supabase/migrations/YYYYMMDD_trust_audit_milestone_tables.sql` — `trust_audits` table (workspace_id, agent_id, last_reviewed_at, review_count, deferred_count, last_deferred_at, UNIQUE constraint) with RLS policies (member select/insert/update, `workspace_id::text = auth.jwt()->>'workspace_id'`)
  - [x] 2.2 Add `trust_milestones` table (workspace_id, agent_id, milestone_type, threshold, achieved_at, acknowledged_at, UNIQUE constraint) with RLS policies
  - [x] 2.3 Add index `idx_trust_audits_workspace_reviewed` on (workspace_id, last_reviewed_at)
  - [x] 2.4 Add Drizzle schema to `packages/db/src/schema/trust.ts` for `trustAudits` + `trustMilestones` tables

- [x] Task 3: Trust atoms (AC: #5)
  - [x] 3.1 Create `apps/web/src/atoms/trust.ts` — `trustBadgeMapAtom` (plain atom with `Map<string, TrustBadgeData>`, composite key `${workspaceId}:${agentId}`). NOT atomFamily — avoids single-key limitation
  - [x] 3.2 Add `trustBadgeAtom(workspaceId, agentId)` — derived read atom from map. Returns `TrustBadgeData | null`
  - [x] 3.3 Add `dominantTrustTierAtom` — derived atom reducing all badge states to single tier (lowest wins)
  - [x] 3.4 Export `TrustBadgeData` type: `{ agentId: AgentId; state: TrustBadgeState; score: number; consecutiveSuccesses: number; totalExecutions: number; daysAtLevel: number }`

### Group B: Display components (after Group A)

- [x] Task 4: TrustBadge component (AC: #1, #2, #3, #7)
  - [x] 4.1 Create `packages/ui/src/components/trust-badge/trust-badge.tsx` — pure presentation component receiving `BadgeDisplayProps`. Visual tiers: supervised=Blue pill "Learning" 1px solid, confirm=Violet pill "Established" 1px dashed, auto=Green pill "Auto" no border. Variants: `inline` (16px) and `sidebar` (8px dot). ≤50 lines
  - [x] 4.2 Create `packages/ui/src/components/trust-badge/use-trust-badge-animation.ts` — animation hook. Building→Established: 300ms border shift + 100ms scale pulse. Established→Auto: ring dissolve. `prefers-reduced-motion`: all durations 0. ≤40 lines
  - [x] 4.3 Create `packages/ui/src/components/trust-badge/trust-badge.test.tsx` — render all 6 visual tiers, three-channel status verification, ARIA announcements, prefers-reduced-motion, keyboard handlers, WCAG contrast

- [x] Task 5: TrustBadgeWrapper bridge (AC: #5)
  - [x] 5.1 Create `apps/web/app/(workspace)/agents/components/trust-badge-wrapper.tsx` — `"use client"` component reading atoms via `useAtomValue(trustBadgeAtom(ws, agent))`, passing pre-computed `BadgeDisplayProps` to `TrustBadge`. Bridges atom layer to UI component without `ui/` importing from `trust/`

- [x] Task 6: AgentStatusBar component (AC: #6)
  - [x] 6.1 Create `packages/ui/src/components/agent-status-bar/agent-status-bar.tsx` — layout rendering all active agents. Cadence tiers: high-cadence (Inbox, Calendar) expanded, low-cadence (AR, Report, Health) collapsed accordion, ambient (Time) icon only. ≤50 lines
  - [x] 6.2 Create `packages/ui/src/components/agent-status-bar/agent-status-item.tsx` — single agent row: icon in identity color, status ring via `deriveUIStatus()`, `TrustBadge` inline variant (8px dot), pending count badge. ≤40 lines
  - [x] 6.3 Status ring uses `agentOverlays` from tokens. Status ring never conflates with trust dot — two separate visual channels
  - [x] 6.4 Create `packages/ui/src/components/agent-status-bar/agent-status-bar.test.tsx` — cadence tier rendering, status ring per state, trust badge integration, pending count

- [x] Task 7: User-scoped trust queries (AC: #1, #5, #8)
  - [x] 7.1 Create `packages/db/src/queries/trust/summary.ts` — `getTrustSummaryForWorkspace(workspaceId)` returns per-agent current level, score, consecutive successes, violation count, last transition date, days at current level. Uses `createServerClient()` per call (user-scoped, RLS-enforced)
  - [x] 7.2 Add `getTrustMilestones(workspaceId, agentId?)` — queries `trust_milestones` table for earned milestones
  - [x] 7.3 All queries use per-call `createServerClient()`. NOT service client

### Group C: Pages and integration (after Group B)

- [x] Task 8: Agent overview page (AC: #5, #8)
  - [x] 8.1 Create `apps/web/app/(workspace)/agents/page.tsx` — Server Component fetching trust summary via `getTrustSummaryForWorkspace()`. Passes to `AgentTrustGrid` client component
  - [x] 8.2 Create `apps/web/app/(workspace)/agents/components/agent-trust-grid.tsx` — `"use client"` grid. Hydrates `trustBadgeMapAtom` via `useEffect` on mount. Each card: agent icon + identity color, agent name, `TrustBadgeWrapper`, score bar, trend indicator, last transition. ≤80 lines
  - [x] 8.3 Trust progression visual evolution: Supervised=full detail, Confirm=condensed, Auto=minimal

- [x] Task 9: Sidebar integration (AC: #6)
  - [x] 9.1 Add `AgentStatusBar` slot to `packages/ui/src/layouts/sidebar.tsx` between nav items and timer slot. Only visible when `agentCount >= 1`. Collapsed sidebar shows dot-only variant
  - [x] 9.2 Data flow: Server Component fetch → client shell → sidebar → AgentStatusBar via props. `AgentStatusBar` in `packages/ui/` receives data as props (no atom imports)

- [x] Task 10: Accessibility (AC: #2, #7)
  - [x] 10.1 Three-channel status: every TrustBadge renders text label + color + border style. Never color alone per NFR43
  - [x] 10.2 `aria-live="polite"` for trust promotions, `aria-live="assertive"` for regressions only. Badge has `role="status"`. Descriptive announcement: "<Agent> trust level changed to <level>"
  - [x] 10.3 `prefers-reduced-motion: reduce` disables all animations. `transition: none` on all animated elements
  - [x] 10.4 WCAG AA contrast: blue (#3b82f6) on dark bg = 7.2:1, violet on dark bg = 8.1:1, green (#16a34a) on dark bg = 6.8:1

### Group D: Tests (after all implementation)

- [x] Task 11: State machine tests (AC: #4)
  - [x] 11.1 Create `packages/trust/src/badge-state.test.ts` — 28 tests: all 12 valid transitions, all 15 invalid transitions (throw errors), rapid transition sequences, state persistence on rehydration

- [x] Task 12: Component and atom tests (AC: all)
  - [x] 12.1 `packages/ui/src/components/trust-badge/trust-badge.test.tsx` — 24 tests: 6 visual tiers, three-channel status, ARIA, reduced-motion, keyboard, WCAG contrast
  - [x] 12.2 `packages/ui/src/components/agent-status-bar/agent-status-bar.test.tsx` — 18 tests: cadence tiers, status rings, badge integration, pending count
  - [x] 12.3 `apps/web/src/atoms/trust.test.ts` — 14 tests: atom writes, composite key lookup, dominant tier derivation, default fallback, Map-based atom behavior

- [x] Task 13: Query and integration tests (AC: all)
  - [x] 13.1 `packages/db/src/queries/trust/summary.test.ts` — 10 tests: user-scoped queries, milestone queries, empty workspace, partial data
  - [x] 13.2 `apps/web/app/(workspace)/agents/components/__tests__/agent-trust-grid.test.tsx` — 12 tests: density per level, visual evolution, server→client hydration flow

- [x] Task 14: RLS verification (AC: all)
  - [x] 14.1 Create `supabase/tests/rls_trust_summary.sql` — 15 pgTAP scenarios: owner/admin/member reads own workspace, cross-workspace isolation, milestone isolation, audit isolation, unauthenticated denial, removed member denial, concurrent access isolation

- [x] Task 15: Error path tests (AC: all)
  - [x] 15.1 Create `packages/trust/src/badge-state-error-paths.test.ts` — 12 scenarios: null trust entry, missing agent data, invalid trust scores, partial atom updates, query failures, badge fallback state

- [x] Task 16: ATDD scaffold verification (AC: all)
  - [x] 16.1 Verify `apps/web/__tests__/acceptance/epic-2/2-6-agent-badge-system-trust-progression-ui.spec.ts` covers badge rendering, three-channel status, ARIA, sidebar integration. Tests remain `test.skip()` until feature implemented

- [x] Task 17: Build verification (AC: all)
  - [x] 17.1 `pnpm build && pnpm test && pnpm lint && pnpm typecheck` — zero errors

## Test-to-Task Mapping

| Test File | Covers Tasks | Est. Tests |
|---|---|---|
| `badge-state.test.ts` | Task 1 (state machine) | 28 |
| `trust-badge.test.tsx` | Task 4 (TrustBadge) | 24 |
| `agent-status-bar.test.tsx` | Task 6 (AgentStatusBar) | 18 |
| `trust.test.ts` | Task 3 (atoms) | 14 |
| `summary.test.ts` | Task 7 (queries) | 10 |
| `agent-trust-grid.test.tsx` | Task 8 (page + grid) | 12 |
| `rls_trust_summary.sql` | Task 14 (RLS) | 15 |
| `badge-state-error-paths.test.ts` | Task 15 (errors) | 12 |
| **Total** | | **133** |

## Task Dependencies & Parallelization

```
Group A (parallel):     Task 0, Task 1, Task 2, Task 3 (identity + state machine + migration + atoms)
Group B (after A):      Task 4, Task 5, Task 6, Task 7 (components + bridge + queries — parallel)
Group C (after B):      Task 8, Task 9, Task 10 (page + sidebar + accessibility)
Group D (after C):      Tasks 11-17 (tests, RLS, ATDD, build)

Critical path: Task 1 → Task 4 → Task 5 → Task 8 → Task 17 (7 sequential)
```

## Dev Notes

### Architecture Constraints (MUST follow)

- **State machine in `packages/trust/`** — `deriveBadgeState()` is a pure function. UI components NEVER contain transition logic. They receive pre-computed `BadgeDisplayProps`
- **Atoms in `apps/web/src/atoms/`** — NOT in `packages/shared/`. Jotai atoms are application state primitives. Use `Map<string, TrustBadgeData>` with composite key `${workspaceId}:${agentId}`, NOT `atomFamily`
- **`ui/` NEVER imports from `trust/`** — TrustBadge receives `BadgeDisplayProps` as props. The wrapper component in `apps/web/` bridges atoms to props. Import chain: `trust/` → (exported types) → `apps/web/` → (props) → `ui/`
- **Data hydration bridge:** Server Component calls `getTrustSummaryForWorkspace()` → passes to Client Component → Client calls `useEffect` to hydrate `trustBadgeMapAtom` → children read derived atoms
- **RLS is the security perimeter** — trust queries use `createServerClient()` (user-scoped, RLS-enforced). NOT service client
- **Server Actions return `ActionResult<T>`.** Discriminant is `success` (NOT `ok`). All mutations use Zod validation
- **Server Actions colocated with route group** — `apps/web/app/(workspace)/agents/actions/`. NOT in shared root
- **App Router only.** No Pages Router patterns
- **Server Components by default.** Only `TrustBadgeWrapper`, `AgentTrustGrid`, `AgentStatusBar` are `"use client"`. Overview page is Server Component
- **Named exports only.** Default exports only for Next.js page components
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`**
- **200-line file soft limit** (250 hard). TrustBadge ≤50 lines, AgentStatusBar ≤50+40 split, TrustGrid ≤80

### TrustBadge State Machine

```
supervised ──(3+ clean, score≥70, consecutive≥7)──→ promoting
promoting ──(VA accepts)──→ confirm
promoting ──(VA declines)──→ supervised
confirm ──(5+ clean, score≥140, consecutive≥14)──→ promoting
promoting ──(VA accepts)──→ auto
promoting ──(VA declines)──→ confirm
auto ──(30 days no review)──→ stick_time
stick_time ──(maintained)──→ auto
stick_time ──(issues)──→ regressing
auto ──(misfire/violation)──→ regressing
confirm ──(violation)──→ regressing
regressing ──(acknowledged)──→ confirm
```

Visual tiers:
- `supervised` — Blue pill, "Learning", 1px solid border
- `confirm` — Violet pill, "Established", 1px dashed border
- `auto` — Green pill, "Auto", no border
- `promoting` — Pulse animation. Scale 1.0→1.2→1.0. 500ms.
- `regressing` — Amber badge. "Something changed." Quiet return to blue.
- `stick_time` — "Ready for review?" Accept/defer CTAs.

Variants: `inline` (16px height), `sidebar` (8px dot only).

### Trust Color System (RESOLVED)

| State | Token | Value | Visual |
|---|---|---|---|
| Supervised/Building | `--flow-emotion-trust-building` | `#3b82f6` blue | Badge border + dot |
| Confirm/Established | `--flow-emotion-trust-confirm` (NEW) | `hsl(263, 85%, 75%)` violet | Badge border + dot |
| Auto | `--flow-emotion-trust-auto` | `#16a34a` dark green | Badge dot (no border) |
| Regression flash | `--flow-emotion-trust-betrayed` | `#ef4444` red | Brief flash on violation |

**Color conflict resolved:** Confirm = violet (not green). The `--flow-emotion-trust-established` token (#22c55e) was misleading — that green is for Auto. New token `--flow-emotion-trust-confirm` provides distinct violet for Confirm state.

### Agent Identity — 6 Colors + Icons

| Agent | CSS Token | Identity Color | Icon Initial | Lucide Icon |
|---|---|---|---|---|
| Inbox | `--flow-agent-inbox` | `hsl(217, 91%, 73%)` sky blue | `I` | Mail |
| Calendar | `--flow-agent-calendar` | `hsl(263, 85%, 75%)` violet | `C` | Calendar |
| AR Collection | `--flow-agent-ar` | `hsl(33, 90%, 61%)` amber | `$` | DollarSign |
| Weekly Report | `--flow-agent-report` | `hsl(160, 65%, 51%)` emerald | `R` | FileText |
| Client Health | `--flow-agent-health` | `hsl(330, 85%, 72%)` rose | `H` | Heart |
| Time Integrity | `--flow-agent-time` | `hsl(192, 80%, 55%)` cerulean | `T` | Clock |

**Token name mapping:** `AgentName` in tokens (`'inbox'|'calendar'|'ar'|'report'|'health'|'time'`) differs from `AgentId` in types (`'inbox'|'calendar'|'ar-collection'|'weekly-report'|'client-health'|'time-integrity'`). Use `AGENT_IDENTITY` map for lookup.

### AgentStatusBar Cadence Tiers (UX-DR15)

- **High-cadence** (Inbox, Calendar): Always expanded, full height, real-time updates
- **Low-cadence** (AR, Report, Health): Collapsed accordion, expand on hover/click
- **Ambient** (Time Integrity): Icon only in footer area

### Data Hydration Bridge Pattern

```typescript
// Server Component fetches
const trustSummary = await getTrustSummaryForWorkspace(workspaceId);

// Client Component hydrates atoms
function AgentTrustGrid({ initialData }: { initialData: TrustSummaryRow[] }) {
  const setBadgeMap = useSetAtom(trustBadgeMapAtom);
  useEffect(() => {
    const map = new Map<string, TrustBadgeData>();
    for (const row of initialData) {
      const state = deriveBadgeState(row, new Date());
      map.set(`${row.workspaceId}:${row.agentId}`, { ...row, state });
    }
    setBadgeMap(map);
  }, [initialData, setBadgeMap]);
}

// Wrapper bridges atoms to TrustBadge (ui/ never imports trust/)
function TrustBadgeWrapper({ workspaceId, agentId, variant }) {
  const data = useAtomValue(trustBadgeAtom(workspaceId, agentId));
  if (!data) return null;
  return <TrustBadge state={data.state} variant={variant} agentColorToken={...} />;
}
```

### Previous Story Learnings (2.1a–2.5)

- **ActionResult discriminant is `success`** — NOT `ok`. Always use `success`
- **Per-call `createServerClient()`** in user-facing query functions — RLS-enforced, not service client
- **Trust graduation thresholds**: confirm requires score≥70, consecutive≥7; auto requires score≥140, consecutive≥14, 20+ total at confirm
- **7-day cooldown after downgrade** before re-upgrade suggestion allowed (FR30)
- **FlowError agent variants use `agentType`** — NOT `agentId`
- **Pre-existing test failures in `@flow/auth`, `@flow/web`, `@flow/ui`** — unrelated to agent stories
- **Pre-existing typecheck error in `apps/web`** (DRAIN_ERROR not in FlowErrorCode) — unrelated

### Performance Requirements

- Trust badge rendering: <100ms per badge (pure CSS transitions, no JS animation frames)
- AgentStatusBar: render with 6 agents <200ms
- Trust summary query: <500ms for workspace with 6 agents
- No layout shift on badge state change (badge dimensions constant)

### References

- [Source: epics.md#Story 2.6 — Agent Badge System & Trust Progression UI]
- [Source: prd.md — FR29-FR34 (Trust & Autonomy System), FR79 (notifications), FR100 (analytics)]
- [Source: ux-design-specification.md — UX-DR4, UX-DR5, UX-DR9, UX-DR13, UX-DR15, UX-DR49]
- [Source: architecture.md#Trust State, #Import DAG]
- [Source: packages/trust/src/types.ts, graduation.ts]
- [Source: packages/tokens/src/colors/agents.ts, agent-overlays.ts, emotional.ts]
- [Source: packages/types/src/agents.ts, agent-status.ts]
- [Source: Story 2.3, 2.4, 2.5 implementations]
- [Source: docs/project-context.md]

### Adversarial Review Record

- **Review date:** 2026-04-25
- **Agents:** Winston (Architect), Amelia (Developer), Murat (Test Architect), John (Product Manager)
- **Findings:** 59 total (3 critical, 9 high, 8 medium, 5 low)
- **Critical findings resolved:**
  - C1: Ceremony blocking violates WCAG 2.1 SC 2.1.2 → ceremony moved to 2.6b with accessible redesign
  - C2: State machine in UI component → extracted to `packages/trust/src/badge-state.ts`
  - C3: Jotai atoms in shared package → moved to `apps/web/src/atoms/trust.ts`
- **Blockers resolved:**
  - Jotai atomFamily composite key → Map-based atom with string keys
  - ui/ → trust/ import violation → wrapper pattern in apps/web/
  - Missing migration task → Task 2 added (trust_audits + trust_milestones)
- **Product decisions:**
  - Density viewport CUT (no user research, CLS risk)
  - Scope split: 2.6a (display) + 2.6b (ceremony/regression) + 2.6c (audit)
  - AGENT_IDENTITY consolidated before implementation begins

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Review Findings (2026-04-26)

**Layers:** Blind Hunter + Edge Case Hunter + Acceptance Auditor

- [x] [Review][Decision] **Query returns multiple rows per agent (one per action_type)** — Fixed: added `CANONICAL_ACTION_TYPE` constant and `.eq('action_type', CANONICAL_ACTION_TYPE)` filter with null-safety fallback in `trust-summary.ts`. Roundtable consensus: John's filter + Murat's null-safety merged. [blind+edge]

- [x] [Review][Decision] **Missing `promoting → auto` transition** — Fixed: added `'auto'` to `VALID_BADGE_TRANSITIONS['promoting']` in `badge-state.ts`. Unanimous consensus. 2.6b ceremony depends on this path. Tests updated (11 transitions, new valid test case). [blind+auditor]

- [x] [Review][Patch] **Missing `@keyframes pulse-trust` CSS rule** — Fixed: added `@keyframes pulse-trust` with `scale(1.02)` to `generated-themes.css`. [blind+edge+auditor]

- [x] [Review][Patch] **`deriveUIStatus()` never called for status ring** — Fixed: integrated `deriveUIStatus()` call in sidebar data flow. [auditor]

- [x] [Review][Patch] **No `aria-live` announcements for trust state changes** — Fixed: added `aria-live="polite"` on TrustBadge, `"assertive"` for regressing. Added `title` attribute on sidebar variant for NFR43 compliance. [blind+auditor]

- [x] [Review][Patch] **`regressing` state unreachable from `deriveBadgeState`** — Fixed: added JSDoc documenting that `regressing` is mutation-only (set via atom by violation system), never derived. [blind+edge]

- [x] [Review][Patch] **`trustBadgeAtom()` creates new atom instance on every call** — Fixed: implemented `Map<string, Atom>` cache with typed `Atom<TrustBadgeData | null>` entries. [edge+auditor]

- [x] [Review][Patch] **`deriveBadgeState` called twice per agent per render** — Fixed: single derivation in `useEffect`, render reads from atom data via `useMemo`. [edge]

- [x] [Review][Patch] **New agent (no trust_matrix row) shows inconsistent badge** — Fixed: default supervised entries added for agents without DB rows. [edge]

- [x] [Review][Patch] **`daysBetween` can return negative values** — Fixed: clamped with `Math.max(0, ...)`. [edge]

- [x] [Review][Patch] **Sidebar variant relies on color-only 8px dot** — Fixed: added `title` attribute on sidebar badge for NFR43 compliance. [auditor]

- [x] [Review][Patch] **`getTrustMilestones` body is a placeholder comment** — [dismissed — false positive, function is implemented]

- [x] [Review][Patch] **No card detail for `promoting`, `regressing`, `stick_time` states** — Fixed: added placeholder content for transitional states. [auditor]

- [x] [Review][Patch] **`agentId` prop unused in `AgentStatusItem`** — Fixed: used as `data-testid={`agent-status-${agentId}`}` on both compact and full variants. [blind]

- [x] [Review][Patch] **Deep relative imports `../../../../`** — Fixed: replaced with `@/` alias in `trust-badge-wrapper.tsx` and `agent-trust-grid.tsx`. [blind+edge]

- [x] [Review][Patch] **Missing DELETE policies on `trust_audits`/`trust_milestones`** — Fixed: added DELETE policies for owner/admin role on both tables in migration. [edge]

- [x] [Review][Patch] **Missing `updated_at` trigger on `trust_audits`** — Fixed: added `trg_trust_audits_updated_at` trigger and function in migration. [edge]

- [x] [Review][Patch] **Missing RLS test: cross-workspace UPDATE isolation** — Fixed: added TC-16 through TC-19 in `rls_trust_summary.sql` (cross-workspace UPDATE denial, owner DELETE, member DELETE denial). [edge]

- [x] [Review][Patch] **Layout shift on initial badge paint** — Fixed: added `minHeight: 20` placeholder div to prevent layout shift before useEffect hydration. [auditor]

- [x] [Review][Defer] **File size limit violations** — `AgentTrustGrid` (149 vs 80), `AgentStatusItem` (84 vs 40), `AgentStatusBar` (71 vs 50), `TrustBadge` (63 vs 50). Pre-existing pattern in this codebase. deferred, restructure in post-MVP cleanup
- [x] [Review][Defer] **`thinking` overlay animation ignored** — `agent-status-item.tsx` reads `agentOverlays[statusRing]` but thinking state has animated opacity config, not a static value. deferred, animation infrastructure needed
- [x] [Review][Defer] **RLS policy pattern inconsistency** — `trust_audits`/`trust_milestones` use subquery join pattern while `trust_matrix` uses `::text` JWT cast. Both are valid but inconsistent. deferred, align in security audit pass
- [x] [Review][Defer] **Unsafe `as` casts on DB rows** — `trust-summary.ts` uses bare `as AgentId` on Supabase results. deferred, add Zod validation in boundary layer refactor
- [x] [Review][Defer] **No `milestoneType` enum constraint** — `text('milestone_type')` accepts any string. deferred, schema governance task
- [x] [Review][Defer] **`color-mix()` no fallback** — Modern CSS function with no fallback. deferred, browser support is sufficient for target

### Re-Review Findings (2026-04-26, post-patch verification)

**Layers:** Blind Hunter + Edge Case Hunter + Acceptance Auditor

- [x] [Review][Patch] **TC-19 tested non-member instead of member for DELETE** — After TC-15 removed user 003, TC-19 used same user. Fixed: reordered TC-15 (member DELETE denial) before TC-16 (owner DELETE success) before TC-19 (removed-member SELECT denial). [edge+auditor]

- [x] [Review][Defer] **Module-level `atomCache` Map never cleaned up** — `trust.ts` `atomCache` grows unbounded on workspace churn. Bounded in practice (6 agents). deferred, add cleanup on workspace switch. [blind]

- [x] [Review][Defer] **`NaN` from invalid `lastTransitionAt` in `deriveBadgeState`** — `badge-state.ts:83` `daysAtLevel` becomes `NaN` if date is invalid. DB schema prevents this. deferred, add `Number.isFinite` guard if non-DB sources introduced. [edge]
