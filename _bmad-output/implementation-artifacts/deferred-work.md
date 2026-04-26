# Deferred Work

Generated from Story 2.6a adversarial code review (2026-04-26).

## Review Cadence

Deferred items are reviewed at every sprint boundary (epic completion):
- **When:** After each epic retrospective, before next epic begins
- **Owner:** Tech Writer (Paige) maintains this file; PM (John) triages at review
- **Process:**
  1. At sprint boundary, review each open item
  2. If trigger condition met → create story or standalone task
  3. If no longer relevant → mark resolved with reason
  4. Update status column below
- **Next review:** Before Epic 3 sprint planning

### Status Tracker

| ID | Severity | Status | Last Reviewed |
|----|----------|--------|---------------|
| DW-2.6a-1 | Low | open | 2026-04-26 |
| DW-2.6a-2 | Medium | open | 2026-04-26 |
| DW-2.6a-3 | Low | resolved (A4 migration) | 2026-04-26 |
| DW-2.6a-4 | Medium | resolved (A5 Zod schemas) | 2026-04-26 |
| DW-2.6a-5 | Low | resolved (A4 migration) | 2026-04-26 |
| DW-2.6a-6 | Low | open | 2026-04-26 |
| DW-2.6a-7 | Low | resolved (A5 atomCache cleanup) | 2026-04-26 |
| DW-2.6a-8 | Low | resolved (A5 NaN guard) | 2026-04-26 |
| 2-6b focus traps | — | open | 2026-04-26 |
| 2-4 boundary audit | — | resolved (A3 audit) | 2026-04-26 |
| DW-3.1-1 | Medium | open | 2026-04-26 |
| DW-3.1-2 | Medium | open | 2026-04-26 |
| DW-3.2-1 | Medium | open | 2026-04-27 |
| DW-3.2-2 | Medium | open | 2026-04-27 |
| DW-3.2-3 | Low | open | 2026-04-27 |
| DW-3.2-4 | Low | open | 2026-04-27 |
| DW-3.2-5 | Medium | open | 2026-04-27 |
| DW-3.2-6 | Medium | open | 2026-04-27 |
| DW-3.2-7 | Low | open | 2026-04-27 |
| DW-3.2-8 | Low | open | 2026-04-27 |
| DW-3.2-9 | Low | open | 2026-04-27 |

## Deferred from: code review of 2-6b-trust-ceremonies-regression-milestones (2026-04-26)

- Focus trap rAF not cancelled on rapid activate/deactivate — edge case in rapid mount/unmount only
- Focus trap containerRef stale on React remount — rare edge case
- `overlayReducer` default silently accepts unknown actions — TypeScript exhaustive check catches at build time

## From Story 2.6a — Trust Badge Display & Agent Status Indicators

### DW-2.6a-1: File size limit violations
- **Severity:** Low
- **Files:** `AgentTrustGrid` (149L vs 80L limit), `AgentStatusItem` (84L vs 40L), `AgentStatusBar` (71L vs 50L), `TrustBadge` (63L vs 50L)
- **Reason:** Pre-existing pattern in codebase; restructuring risks regressions without dedicated refactoring sprint.
- **Action:** Schedule post-MVP cleanup pass. Split `AgentTrustGrid` into grid container + card sub-components.

### DW-2.6a-2: `thinking` overlay animation ignored
- **Severity:** Medium
- **Files:** `packages/ui/src/components/agent-status-bar/agent-status-item.tsx`
- **Reason:** `agentOverlays[statusRing]` reads animated opacity config for thinking state but applies it as a static value. Proper animation requires CSS `@keyframes` or `requestAnimationFrame` infrastructure not yet in place.
- **Action:** Add thinking animation in Agent Infrastructure epic when status ring is backed by real-time agent state.

### DW-2.6a-3: RLS policy pattern inconsistency
- **Severity:** Low
- **Files:** `supabase/migrations/20260430000001_trust_audit_milestone_tables.sql`
- **Reason:** New `trust_audits`/`trust_milestones` tables use subquery join pattern while `trust_matrix` uses `::text` JWT cast. Both are valid but inconsistent.
- **Action:** Align all trust table RLS policies in a dedicated security audit pass before GA.

### DW-2.6a-4: Unsafe `as` casts on DB rows
- **Severity:** Medium
- **Files:** `apps/web/app/(workspace)/agents/lib/trust-summary.ts`
- **Reason:** Supabase results cast with bare `as AgentId`. No runtime validation.
- **Action:** Add Zod validation schemas at the boundary layer when refactoring trust-summary into a shared query module.

### DW-2.6a-5: No `milestoneType` enum constraint
- **Severity:** Low
- **Files:** `packages/db/src/schema/trust.ts` — `text('milestone_type')` column
- **Reason:** Accepts any string; typos silently stored. Adding a Postgres enum or check constraint is low risk but requires migration.
- **Action:** Add `CHECK` constraint or `ENUM` type in schema governance task before 2.6c implementation.

### DW-2.6a-6: `color-mix()` no fallback
- **Severity:** Low
- **Files:** `packages/ui/src/components/trust-badge/trust-badge.tsx`
- **Reason:** `color-mix(in srgb, ...)` is used for hover states with no fallback. Browser support is sufficient for target (Chrome 111+, Safari 16.2+, Firefox 113+).
- **Action:** Add static fallback colors if target browser list expands.

### DW-2.6a-7: Module-level `atomCache` Map never cleaned up
- **Severity:** Low
- **Files:** `apps/web/lib/atoms/trust.ts`
- **Reason:** `atomCache` is a module-level `Map<string, Atom>` that grows with each unique `workspaceId:agentId` combination. In practice bounded by 6 agents × N workspaces, but on workspace switch or logout, stale entries persist indefinitely.
- **Action:** Add cleanup on workspace switch or logout. Consider using a LRU or clearing on `trustBadgeMapAtom` reset.

### DW-2.6a-8: `NaN` from invalid `lastTransitionAt` in `deriveBadgeState`
- **Severity:** Low
- **Files:** `packages/trust/src/badge-state.ts:83`
- **Reason:** If `lastTransitionAt` is an invalid date string, `new Date(invalid).getTime()` returns `NaN`, and `daysAtLevel` becomes `NaN`. The `>= 30` check fails (NaN comparisons are false), so `auto` returns `auto` — not a crash but semantically wrong.
- **Reason for deferral:** DB schema enforces `NOT NULL timestamptz` so invalid values shouldn't occur. The grid display is already guarded by `daysBetween` with `Math.max(0, ...)`.
- **Action:** Add `Number.isFinite` guard in `deriveBadgeState` if data sources beyond the DB are introduced.

## Deferred from: code review of 3-1-client-data-model-crud (2026-04-26)

### DW-3.1-1: create-client-form.test.tsx tests wrong component
- **Severity:** Medium
- **Files:** `apps/web/app/(workspace)/clients/components/__tests__/create-client-form.test.tsx`
- **Reason:** Test file named `create-client-form.test.tsx` renders `<ClientEmptyState>` and `<TierLimitBanner>` but never `<CreateClientForm>`. Zero CreateClientForm validation/submission tests exist. Pre-existing from initial implementation.
- **Action:** Add proper CreateClientForm tests (validation, submission, error display) in a test coverage pass.

### DW-3.1-2: TeamAccessPanel not rendered on detail page
- **Severity:** Medium
- **Files:** `apps/web/app/(workspace)/clients/[clientId]/page.tsx`, `team-access-panel.tsx`
- **Reason:** TeamAccessPanel exists as a stub but is not imported or rendered on the client detail page. Owner/admin has no UI to assign/revoke team members. Deferred as D2 decision — wiring deferred to a dedicated integration story.
- **Action:** Wire TeamAccessPanel into detail page when team scoping UX is implemented (likely Story 3.3 or a follow-up).

## Deferred from: code review of 3-2-retainer-agreements-scope-creep-detection (2026-04-27)

### DW-3.2-1: SQL CTE RPC for scope creep alerts
- **Severity:** Medium
- **Files:** `packages/db/src/queries/retainers/utilization.ts`
- **Reason:** Spec requires single SQL CTE query for scope creep detection. JS fallback runs N+1 queries with float arithmetic. Guard added against division-by-zero. RPC deferred to avoid blocking ship.
- **Action:** Create `get_scope_creep_alerts` SQL RPC as tech debt before Epic 7. Replace JS fallback. SQL is already written in story Dev Notes.

### DW-3.2-2: Historical retainer timeline UI
- **Severity:** Medium
- **Files:** `apps/web/app/(workspace)/clients/[clientId]/components/retainer-panel.tsx`
- **Reason:** AC2 requires historical retainers visible in a timeline. Query `listRetainersForClient` exists. UI component not built. Deferred to follow-up story "3.2.1 Historical Retainer Timeline" — pure UI, no architectural implications.
- **Action:** Create `retainer-timeline.tsx` component (~60 lines). Track test debt: component tests required.

### DW-3.2-3: Mobile 2-step wizard for retainer form
- **Severity:** Low
- **Files:** `apps/web/app/(workspace)/clients/[clientId]/components/retainer-form.tsx`
- **Reason:** Task 5.2 requires responsive 2-step wizard for mobile (<768px). Current form is functional but overwhelming on small screens. Deferred to polish pass — do consistently across all forms.
- **Action:** Implement viewport-based step logic in a polish sprint. Include responsive test AC in the story.

### DW-3.2-4: TOCTOU race in cancelRetainer
- **Severity:** Low
- **Files:** `packages/db/src/queries/retainers/crud.ts:177-200`
- **Reason:** Concurrent cancel requests can both succeed. Benign per spec (idempotent, sets same values). Optimistic locking via `updated_at` already noted as TODO in Dev Notes.
- **Action:** Consider `updated_at` optimistic locking check in a future hardening pass.

### DW-3.2-5: cancelRetainer idempotency behavior
- **Severity:** Low (spec-compliant)
- **Files:** `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/cancel-retainer.ts:36-43`
- **Reason:** Already-cancelled retainer returns success with cache revalidation. Spec says idempotent. Wasteful revalidation is the only concern.
- **Action:** Consider early return without revalidation if `status === 'cancelled'` in a hardening pass.

### DW-3.2-6: Success toast on retainer creation
- **Severity:** Medium
- **Files:** `apps/web/app/(workspace)/clients/[clientId]/components/retainer-form.tsx`
- **Reason:** AC8 requires toast "Retainer created — scope tracking is now active." No generic toast system exists in the codebase yet. Building one is out of scope for this story.
- **Action:** Implement generic toast system (sonner or custom) in a dedicated story, then wire success/error toasts across all server action flows.

### DW-3.2-7: First-time tooltip on utilization bar
- **Severity:** Low
- **Files:** `apps/web/app/(workspace)/clients/[clientId]/components/retainer-utilization-bar.tsx`
- **Reason:** AC8 requires dismissible tooltip tracked via localStorage explaining utilization bar. No tooltip component infrastructure exists.
- **Action:** Add when tooltip component system is built (likely in UI polish sprint).

### DW-3.2-8: Unused getCurrentBillingPeriod refactoring
- **Severity:** Low
- **Files:** `packages/db/src/queries/retainers/billing-periods.ts`, `utilization.ts`
- **Reason:** Billing period calculation duplicated in 3 places. `getCurrentBillingPeriod` exists but is unused. Refactoring is non-blocking.
- **Action:** Consolidate billing period logic to use shared function in a code quality pass.

### DW-3.2-9: File size limit violations
- **Severity:** Low
- **Files:** `retainer-form.tsx` (237 lines), `crud.ts` (211 lines)
- **Reason:** Exceeds 200-line soft limit (250 hard). Functional, no correctness impact.
- **Action:** Split in a code quality pass. retainer-form.tsx: extract type cards and field sections. crud.ts: extract field map and update logic.
