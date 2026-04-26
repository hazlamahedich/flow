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
