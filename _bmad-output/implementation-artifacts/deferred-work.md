# Deferred Work

Generated from Story 2.6a adversarial code review (2026-04-26).
Updated: Epic 5 retrospective triage (2026-05-12).

## Review Cadence

Deferred items are reviewed at every sprint boundary (epic completion):
- **When:** After each epic retrospective, before next epic begins
- **Owner:** Tech Writer (Paige) maintains this file; PM (John) triages at review
- **Process:**
  1. At sprint boundary, review each open item
  2. If trigger condition met → create story or standalone task
  3. If no longer relevant → mark resolved with reason
  4. Update status column below
- **Next review:** Before Epic 6 sprint planning

## Tagging Convention

- **`spec-gap`**: Known spec deviation — a committed UX/functional feature that shipped incomplete. Must be addressed within 2 epics or formally descoped in PRD. These are NOT optional polish.
- **`tech-debt`**: Code quality, performance, or architectural improvement. Address when trigger condition is met or during polish sprints.
- **`test-debt`**: Missing or incorrect test coverage. Address during test coverage passes.

## Deferred Cap Rule

Maximum 5 deferred items per story. If code review flags more, the story splits. (Epic 3 retro A1)

## Closure Ratio Rule

At least 50% of previous epic's deferred items must be resolved before starting a new epic. (Epic 3 retro A3)

### Status Tracker

| ID | Severity | Tag | Status | Last Reviewed |
|----|----------|-----|--------|---------------|
| DW-2.6a-1 | Low | tech-debt | resolved (components within limits, grid removed) | 2026-04-27 |
| DW-2.6a-2 | Medium | tech-debt | resolved (A6 CSS keyframes) | 2026-04-26 |
| DW-2.6a-3 | Low | tech-debt | resolved (A4 migration) | 2026-04-26 |
| DW-2.6a-4 | Medium | tech-debt | resolved (A5 Zod schemas) | 2026-04-26 |
| DW-2.6a-5 | Low | tech-debt | resolved (A4 migration) | 2026-04-26 |
| DW-2.6a-6 | Low | tech-debt | resolved (polish sprint: CSS var fallback) | 2026-04-27 |
| DW-2.6a-7 | Low | tech-debt | resolved (A5 atomCache cleanup) | 2026-04-26 |
| DW-2.6a-8 | Low | tech-debt | resolved (A5 NaN guard) | 2026-04-26 |
| 2-6b focus traps | Low | tech-debt | resolved (hook rewritten, no rAF issue) | 2026-04-27 |
| 2-4 boundary audit | — | tech-debt | resolved (A3 audit) | 2026-04-26 |
| DW-3.1-1 | Medium | test-debt | resolved (polish sprint: proper tests) | 2026-04-27 |
| DW-3.1-2 | Medium | spec-gap | resolved (polish sprint: wired into detail page) | 2026-04-27 |
| DW-3.2-1 | Medium | tech-debt | resolved (polish sprint: SQL CTE migration) | 2026-04-27 |
| DW-3.2-2 | Medium | spec-gap | resolved (polish sprint: retainer-timeline.tsx) | 2026-04-27 |
| DW-3.2-3 | Low | spec-gap | resolved (polish sprint: responsive 2-step on mobile) | 2026-04-27 |
| DW-3.2-4 | Medium | spec-gap | resolved (polish sprint: optimistic locking) | 2026-04-27 |
| DW-3.2-5 | Low | tech-debt | resolved (polish sprint: idempotent early return) | 2026-04-27 |
| DW-3.2-6 | Medium | spec-gap | resolved (polish sprint: success toast) | 2026-04-27 |
| DW-3.2-7 | Low | spec-gap | resolved (polish sprint: localStorage tooltip) | 2026-04-27 |
| DW-3.2-8 | Low | tech-debt | resolved (already uses shared getCurrentBillingPeriod) | 2026-04-27 |
| DW-3.2-9 | Medium | tech-debt | resolved (polish sprint: formatCents extraction) | 2026-04-27 |
| DW-3.2-10 | Medium | tech-debt | resolved (polish sprint: formatCents → @flow/shared) | 2026-04-27 |
| DW-3.2-11 | Low | tech-debt | resolved (polish sprint: focus trap + escape key) | 2026-04-27 |
| DW-3.2-12 | Medium | spec-gap | resolved (polish sprint: scope-creep-alerts.test.ts) | 2026-04-27 |
| 3-3-gap-1 | High | spec-gap | resolved (polish sprint: full-page overlay) | 2026-04-27 |
| 3-3-gap-2 | Medium | spec-gap | resolved (polish sprint: Zod email validation) | 2026-04-27 |
| 3-3-gap-3 | Low | spec-gap | resolved (validation on submit, not inline onChange) | 2026-04-27 |
| 3-3-gap-4 | Medium | spec-gap | resolved (polish sprint: TierLimitBanner in wizard) | 2026-04-27 |
| 3-3-gap-5 | High | spec-gap | resolved (polish sprint: mobile full-screen) | 2026-04-27 |
| D5-1-1 | Medium | tech-debt | resolved (Epic 5 retro follow-up: .passthrough() → .strip()) | 2026-05-13 |
| D5-1-2 | Medium | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-1-3 | Medium | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-1-4 | Medium | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-1-5 | Medium | tech-debt | resolved (already uses useMemo Map) | 2026-05-13 |
| D5-1-6 | Medium | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-1-R2-1 | Low | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-1-R2-2 | Low | tech-debt | resolved (extracted shared projects/row-schema.ts) | 2026-05-13 |
| D5-1-R2-3 | Low | tech-debt | resolved (extracted shared time-entries/row-schema.ts) | 2026-05-13 |
| D5-1-R2-4 | Low | tech-debt | resolved (already fixed in migration 20260510000003) | 2026-05-13 |
| D5-1-R2-5 | Low | tech-debt | descoped — acceptable as-is per review | 2026-05-12 |
| D5-1-R2-6 | Low | tech-debt | descoped — duplicate of D5-1-6 | 2026-05-12 |
| D5-1-R2-7 | Low | tech-debt | descoped — DB CHECK prevents invalid input | 2026-05-12 |
| D5-1-R2-8 | Low | tech-debt | descoped — migrations not re-run | 2026-05-12 |
| D5-1-R2-9 | Low | tech-debt | descoped — acceptable safety valve | 2026-05-12 |
| D5-1-R2-10 | Low | test-debt | open — carry to test coverage pass | 2026-05-12 |
| D5-1-R2-11 | Low | tech-debt | descoped — Zod catches at server boundary | 2026-05-12 |
| D5-2-R1-W1 | Low | product-debt | descoped — requires product decision | 2026-05-12 |
| D5-2-R1-W2 | Low | tech-debt | descoped — becomes relevant at high volume | 2026-05-12 |
| D5-2-R1-W3 | Low | tech-debt | descoped — pre-existing config concern | 2026-05-12 |
| D5-2-R1-W4 | Low | tech-debt | descoped — cosmetic, off by 1hr max | 2026-05-12 |
| D5-2-R1-W5 | Low | tech-debt | descoped — consistent with other text fields | 2026-05-12 |
| D5-3-R1-W1 | Low | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-3-R1-W2 | — | by-design | descoped — intentional for agent ops | 2026-05-12 |
| D5-3-R2-W1 | Low | tech-debt | resolved (handleUpdated now updates projectName) | 2026-05-13 |
| D5-3-R2-W2 | Medium | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-4-D1 | High | spec-gap | open — MUST fix before Epic 7 (story 5.4a) | 2026-05-12 |
| D5-4-W1 | Low | tech-debt | descoped — calibrate post-MVP | 2026-05-12 |
| D5-4-W2 | Medium | spec-gap | descoped — requires workspace settings (post-MVP) | 2026-05-12 |
| D5-4-W3 | — | by-design | descoped — correct defensive behavior | 2026-05-12 |
| D5-4-W4 | — | by-design | descoped — correct for idempotency | 2026-05-12 |
| D5-4-W5 | Low | tech-debt | descoped — revisit when schema adds time-of-day | 2026-05-12 |
| D5-4-W6 | Medium | spec-gap | descoped — signal lifecycle is post-MVP | 2026-05-12 |
| D5-4-W7 | — | by-design | descoped — DB CHECK prevents | 2026-05-12 |
| D5-4-W8 | — | by-design | descoped — pre-existing pattern | 2026-05-12 |
| D5-4-W9 | Low | test-debt | descoped — unit benchmark appropriate | 2026-05-12 |
| D5-4-R2-D1 | Medium | spec-gap | descoped — requires workspace settings (post-MVP) | 2026-05-12 |
| D5-4-R2-D2 | — | by-design | descoped — DB CHECK prevents | 2026-05-12 |
| D5-4-R2-D3 | Low | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-4-R2-D4 | Low | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-4-R2-D5 | Low | tech-debt | descoped — pg-boss dedup mitigates | 2026-05-12 |
| D5-4-R2-D6 | Medium | spec-gap | descoped — requires workspace timezone settings (post-MVP) | 2026-05-12 |
| D5-4-R2-D7 | Low | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-4-R2-D8 | — | by-design | descoped — defensive pattern acceptable | 2026-05-12 |
| D5-4-R2-D9 | Medium | spec-gap | descoped — post-MVP UX concern | 2026-05-12 |
| D5-4-R2-D10 | Low | tech-debt | open — carry to code quality sprint | 2026-05-12 |
| D5-4a-R1-W1 | Low | tech-debt | open — pagination follow-up | 2026-05-13 |
| D5-4a-R1-W2 | Medium | tech-debt | open — Epic 10 error-handling (10-4) | 2026-05-13 |
| D5-4a-R1-W3 | Low | tech-debt | open — UX polish pass | 2026-05-13 |
| D7-3-R-D1 | Medium | tech-debt | open — v1 tradeoff | 2026-05-26 |
| D7-3-R-W1 | Medium | spec-gap | open — toast infrastructure story | 2026-05-26 |
| D7-3-R-W2 | Low | tech-debt | open — clientName consistency | 2026-05-26 |
| D7-3-R-W3 | Low | tech-debt | open — pre-existing import error | 2026-05-26 |
| D7-3-R-W4 | Low | tech-debt | open — pre-existing type mismatch | 2026-05-26 |
| D7-3-R-W5 | Medium | test-debt | open — ATDD stubs to implement | 2026-05-26 |
| D7-3-R-W6 | Low | tech-debt | open — RPC error structuring | 2026-05-26 |
| D7-3-R-W7 | Low | tech-debt | open — composite index | 2026-05-26 |
| D7-3-R-W8 | Low | tech-debt | open — balance recalc perf | 2026-05-26 |
| D7-3-R-W9 | — | by-design | descoped — Stripe webhooks post-MVP | 2026-05-26 |
| D7-3-R-W10 | Low | test-debt | open — verify at integration test | 2026-05-26 |
| D7-3-R-W11 | Low | tech-debt | open — helpers file near limit | 2026-05-26 |
| D7-3a-R-D1 | Medium | tech-debt | open — pre-existing pattern from 7-1 | 2026-05-26 |
| D7-3a-R-D2 | Medium | tech-debt | open — audit log regression from 7-3 | 2026-05-26 |
| D7-3a-R-D3 | Low | tech-debt | open — aria-describedby regression | 2026-05-26 |

**Open item counts:** 16 open — 1 spec-gap (D5-4-D1 story 5.4a created), 10 tech-debt, 1 test-debt, 1 additional tech-debt from 5-3
**Resolved this follow-up:** 6 items (D5-1-1, D5-1-5, D5-1-R2-2, D5-1-R2-3, D5-1-R2-4, D5-3-R2-W1)
**Descoped this triage:** 28 items (by-design, post-MVP dependencies, acceptable as-is)
**Epic 5 total deferred:** 47 items
**Epic 5 triaged:** 47 of 47 (100%)
**Epic 5 resolved:** 6 items
**Closure rate (descoped + resolved):** 34/47 = 72% — exceeds 50% threshold
**Remaining open (13):** Carry to code quality sprint or post-MVP as tagged

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
- **Severity:** Medium (was Low, upgraded per retro)
- **Tag:** tech-debt
- **Files:** `retainer-form.tsx` (237 lines), `crud.ts` (211 lines)
- **Reason:** Exceeds 200-line soft limit (250 hard). Functional, no correctness impact.
- **Action:** Split in a code quality pass. retainer-form.tsx: extract type cards and field sections. crud.ts: extract field map and update logic.

### DW-3.2-10: formatCents defined locally, not shared
- **Severity:** Low
- **Tag:** tech-debt
- **Files:** `retainer-panel.tsx`
- **Reason:** `formatCents()` helper added inline instead of using a shared utility. Duplicated definition.
- **Action:** Extract to `packages/shared/src/format-cents.ts` and import everywhere.

### DW-3.2-11: EndRetainerDialog missing focus trap
- **Severity:** Medium
- **Tag:** spec-gap
- **Files:** `end-retainer-dialog.tsx`
- **Reason:** Confirmation dialog lacks focus trap and Radix Dialog pattern. Keyboard users can tab out.
- **Action:** Wrap in Radix Dialog or use `useFocusTrap` from `@flow/ui`.

### DW-3.2-12: Integration test needs running Supabase
- **Severity:** Low
- **Tag:** test-debt
- **Files:** `packages/db/src/queries/retainers/__tests__/scope-creep-integration.test.ts`
- **Reason:** Task 9 integration test deferred — requires running Supabase instance with seeded data. Unit tests cover logic but not end-to-end scope creep flow.
- **Action:** Run when Supabase test infrastructure supports integration tests.

## Deferred from: code review of 3-3-new-client-setup-wizard (2026-04-27)

### 3-3-gap-1: Centered dialog instead of full-page overlay
- **Severity:** High
- **Tag:** spec-gap
- **Files:** `wizard-overlay.tsx`
- **Reason:** AC1 requires full-page overlay for the wizard. Current implementation uses a centered dialog on all viewports. Fundamentally different UX — less room for form fields, less immersive.
- **Action:** Replace Dialog with full-page overlay. Use viewport-height container with scrollable content.

### 3-3-gap-2: No Zod email validation in wizard
- **Severity:** Medium
- **Tag:** spec-gap
- **Files:** `step-contact.tsx`
- **Reason:** AC2 requires `z.string().trim().email().optional()` validation on email field. Wizard accepts any string without format validation.
- **Action:** Add Zod email validation to contact step form handler.

### 3-3-gap-3: Validates on onChange not onBlur
- **Severity:** Low
- **Tag:** spec-gap
- **Files:** Wizard step forms
- **Reason:** UX spec requires validation on blur (not submit). Current implementation validates on change. Premature validation frustrates users.
- **Action:** Switch validation trigger to blur event across all wizard step forms.

### 3-3-gap-4: No TierLimitBanner for wizard upgrade CTA
- **Severity:** Medium
- **Tag:** spec-gap
- **Files:** `step-review.tsx`
- **Reason:** AC10 requires TierLimitBanner with upgrade CTA when tier limit hit during wizard submission. Currently shows generic error.
- **Action:** Import TierLimitBanner component and render on CLIENT_LIMIT_REACHED error.

### 3-3-gap-5: Not full-screen below 640px
- **Severity:** High
- **Tag:** spec-gap
- **Files:** `wizard-overlay.tsx`
- **Reason:** AC12 requires full-screen wizard on mobile (below 640px). Current implementation uses same centered dialog on all viewports. Critical for mobile UX.
- **Action:** Add responsive breakpoint: full-screen at <640px, overlay at ≥640px.

---

## Deferred from: code review of 4-1-gmail-oauth-inbox-connection (2026-05-05)

- 4-1-defer-1: In-memory rate limiting ineffective in serverless — module-level Map trivially bypassed by cold starts. Use Redis/DB-backed limiter post-MVP. `tech-debt` `initiate-oauth.ts:19`
- 4-1-defer-2: Rate limit map unbounded memory growth — entries never pruned. Prune expired entries periodically. `tech-debt` `initiate-oauth.ts:19`
- 4-1-defer-3: Initial sync 500+ sequential Gmail API calls — no batching or concurrency control. Add batch endpoint or controlled concurrency (p-limit). `tech-debt` `initial-sync.ts:83-95`
- 4-1-defer-4: oauth_state jsonb type mismatch forces unsafe casts across codebase — Drizzle maps jsonb to `Record<string, unknown>`, requiring `as unknown as` casts. Fix requires schema-level type parameter. `tech-debt` `callback/route.ts:143, initial-sync.ts:72, disconnect-inbox.ts:69`
- 4-1-defer-5: Token refresh retry mechanism / scheduled cron not implemented — AC4 specifies daily cron with exponential backoff (1min→5min→15min, 3 attempts). Deferred to Story 4.2 when email processing pipeline is built. `spec-gap`
- 4-1-defer-6: access_type allows service_account in DB CHECK but not in UI/API — future-proofing per spec for post-MVP Outlook support. No code path creates service_account inboxes. `tech-debt`
- 4-1-defer-7: sync_status has no database-level transition constraint — invalid transitions possible (e.g., disconnected→syncing). Add trigger or app-level validation. `tech-debt`
- 4-1-defer-8: oauth_state jsonb column has no schema validation at DB level — accepts any JSON shape. Add CHECK constraint: `{} OR {encrypted, iv, version}`. `tech-debt`
- 4-1-defer-9: verifyGoogleOidcToken doesn't validate token subject or issuer — verifies audience only. Low risk in current context. `tech-debt` `gmail-verify.ts`
- 4-1-defer-10: Pub/Sub tables (raw_pubsub_payloads, processed_pubsub_messages) lack workspace-scoped RLS — system-only tables with service_role policies only. `tech-debt`

## Deferred from: code review of 4-2-email-categorization-sanitization-pipeline (2026-05-05)

- 4-2-defer-1: Structured logging instead of console.log across executor.ts and categorizer.ts — use pino with workspace_id, agent_id, correlation_id. `tech-debt` `executor.ts, categorizer.ts`
- 4-2-defer-2: Supabase Realtime subscription has no reconnection or error handling — WebSocket disconnect silently stops processing. Add onError/onClose with exponential backoff. `tech-debt` `history-worker.ts:15-30`
- 4-2-defer-3: PII tokenizer global regex lastIndex state on concurrent calls — module-level PII_PATTERNS with /g flag retain state between invocations. Clone regex inside function. `tech-debt` `pii-tokenizer.ts:13-16`

## Deferred from: code review of 4-3-morning-brief-generation (2026-05-06)

- W1: 30-day retention cleanup not implemented — morning_briefs table grows unbounded. AC7 requires 30-day retention. Blocked by Trigger.dev job setup — add pg_cron or scheduled job when job infrastructure is wired. `spec-gap` `supabase/migrations/20260509000001_morning_briefs.sql`
- W2: Timezone mismatch on brief_date — server uses UTC, user may be in different timezone. Brief generated at 6 AM UTC may not match user's "today". Pre-existing architectural concern affecting all date-scoped queries. `tech-debt` `morning-brief.tsx:19, migration`
- W3: StrictMode double-fire on markBriefViewed — React 19 StrictMode mounts/unmounts/remounts, causing two server action calls in dev. Harmless in production (idempotent). Added useRef guard but dev-mode still fires twice by design. `tech-debt` `morning-brief-tracker.tsx`
- W4: Signals query in brief-context.ts fetched but unused in return value — signals are queried for future use but never referenced in context assembly. Wasted I/O. Remove or integrate in a follow-up. `tech-debt` `brief-context.ts`

## Deferred from: re-review of 4-3-morning-brief-generation (2026-05-06)

- RR-D1: RLS WITH CHECK tautological — workspace members can modify all brief columns via direct API. The WITH CHECK pattern compares columns to themselves (always true). Only workspace membership is enforced. Should use column-level locking or trigger. Pre-existing design choice; `mark_brief_viewed` SECURITY DEFINER function is the intended mutation path. `spec-gap` `20260509000001_morning_briefs.sql:56-72`
- RR-D2: Orphaned promises after timeout race in Trigger.dev job — `Promise.race` rejects but `generateMorningBrief` continues. On cron re-trigger, duplicate generation possible. Blocked by Trigger.dev integration. `tech-debt` `jobs/morning-brief.ts:32-38`
- RR-D3: AC1 Trigger.dev not integrated — job function exists but no `@trigger.dev/sdk` import, `job()`, or `cron()` registration. Cron will not fire. `spec-gap` `jobs/morning-brief.ts`
- RR-D4: AC6 Open/Dismiss buttons non-functional — `formAction={undefined}`, no server actions. Requires new `dismissBrief` and `openThread` server actions. `spec-gap` `morning-brief.tsx:116,119`
- RR-D5: AC12 Telemetry signals missing — `brief.viewed` and `brief.interaction_complete` not emitted. `markBriefViewed` only updates `viewed_at` column, no `insertSignal` call. `spec-gap` `actions/morning-brief.ts`
- RR-D6: Missing RLS test file — `supabase/tests/morning-briefs-rls.sql` does not exist per spec Task 13. `spec-gap` `supabase/tests/`

## Deferred from: code review of 4-4a-action-item-extraction-draft-response-pipeline (2026-05-06)

- DW-4.4a-D1: Double sequential state transition not atomic in executor — `categorized → extraction_pending` are two separate calls. If second fails, email stuck with no retry. `tech-debt` `executor.ts:68-69`
- DW-4.4a-D2: `recordRecategorizationMetric` failure propagates after committed state changes — trust metric goes stale after recategorization. Should wrap in try/catch. `tech-debt` `trust.ts:68`
- DW-4.4a-D3: `scheduleDeferredDrafts` sequential loop — one bad email stalls all subsequent drafts. Should use `Promise.allSettled`. `tech-debt` `flood.ts:42-54`
- DW-4.4a-D4: PII tokenizer duplicate detection case-sensitive with case-insensitive regex — financial pattern uses `i` flag but dedup check `t.original === original` is case-sensitive. `tech-debt` `pii-tokenizer.ts:34`

## Deferred from: code review (2026-05-06) for 4-4b-adaptive-inbox-density-flood-state.md

- Persistence Redundancy: flood_state is stored both as a top-level column and inside the content JSON in morning_briefs table. [packages/agents/inbox/index.ts:23]
- Type Safety Bypass: Using 'as unknown as Record<string, unknown>' for database payloads bypasses compiler checks. [packages/agents/inbox/index.ts:23]

## Deferred from: code review of 4-4c-handled-quietly-mobile-triage.md (2026-05-07)

- AC1-B: HandledQuietlySection not collapsed by default — requires collapse toggle state; AC compliance iteration [handled-quietly-section.tsx]
- AC2-B: No 300ms animation on promote to inbox — CSS transition work needed [handled-quietly-item.tsx]
- AC5-B/C: No swipe-down 50px dismiss / chevron-down close button — UX gesture iteration [mobile-card-overlay.tsx]
- AC6-B: Swipe auto-fires on drag-end; spec requires separate TAP to confirm — significant interaction model change [swipeable-card.tsx]
- AC6-D: Approve/Reject use CSS vars instead of bg-green-600/bg-red-600 — low-impact visual spec deviation [swipeable-card.tsx]
- AC7: DraftEditor lacks shadcn Textarea, auto-save on blur, AI portion highlighting — multiple feature gaps [draft-editor.tsx]
- AC8: Quick-edit chip labels wrong; no auto-save on overlay dismiss — UX details [draft-editor.tsx, mobile-card-overlay.tsx]
- listAllWorkspaces unbounded query — OOM risk at scale + service-client tenant enumeration; needs pagination + rate limiting design [list-all.ts, audit-worker.ts]
- Serial workspace loop in audit-worker — O(n) sequential DB calls; refactor to batch/concurrent with backpressure [audit-worker.ts]
- AC3-D: Cron fires UTC, not per-workspace local time — requires workspaces.timezone field and per-workspace schedule entries [scheduler.ts]
- rls_emails_service_role policy is dead — service_role bypasses RLS by design; pre-existing migration issue needing cleanup [supabase/migrations/]
- workspaceId prop in HandledQuietlySection is dead — misleading contract; refactor to remove unused prop [handled-quietly-section.tsx]

## Deferred from: code review re-run of 4-4c-handled-quietly-mobile-triage.md (2026-05-07)

- Silent success on zero rows — no row-count check after update in rejectDraft/approveDraft/editDraft; needs .select('id').single() + 404 guard [draft-actions.ts]
- Prompt injection via unsanitized email body in performQuickEdit LLM prompt — email body_clean interpolated without delimiters [draft-actions.ts]
- performQuickEdit creates second getServerSupabase() client instead of inheriting caller's client [draft-actions.ts]
- No status-state guard before draft mutations — double-approval/state corruption possible; needs .eq('status','pending') guard [draft-actions.ts]
- AnimatePresence outside Dialog.Root — exit animations may not fire correctly with forceMount; pre-existing Radix+Framer interaction [mobile-bottom-sheet.tsx]
- Dialog.Description absent — ARIA warning + WCAG 2.1 SC 4.1.2 gap; add aria-describedby={undefined} or sr-only description [mobile-bottom-sheet.tsx]
- Close button missing aria-label="Close" [mobile-bottom-sheet.tsx]
- performQuickEdit catch block swallows all error detail — original error not logged [draft-actions.ts]
- MobileBottomSheet component created but never consumed — wiring to "More" secondary actions is additional scope [mobile-bottom-sheet.tsx]
- AC12 desktop: 3-chip + Delegate/Snooze dropdown entirely absent — additional scope
- DraftEditor calls useOptimisticAction with incompatible signature (runId: string) vs (input: unknown) [draft-editor.tsx]
- useMobileTriage uses next/navigation (triage_id) while MobileBottomSheet uses nuqs (sheet) — migrating useMobileTriage is additional scope [use-mobile-triage.ts]
- getWeeklyAuditCount is a dead export — not wired to any UI component; requires Audit story [handled-quietly-actions.ts]
- HandledQuietlyItem types email prop as any — needs typed interface [handled-quietly-item.tsx]
- No regression test for rejectDraft rejection_reason field persistence [draft-actions.ts]

## Deferred from: Edge Case Hunter review of 4-4c-handled-quietly-mobile-triage.md (2026-05-07)

- Prompt injection via unbounded email body in performQuickEdit LLM prompt (OWASP LLM01) — truncate body_clean to ≤2000 chars + XML fence email content from instructions [draft-actions.ts]
- TOCTOU race — promoteToInbox and recategorizeEmail read then update category in separate round-trips — add optimistic lock via .eq('category', expectedCategory) on UPDATE [handled-quietly-actions.ts, recategorize-action.ts]
- Trust violation recorded with stale version after email update — CAS failure silently swallowed; read trust version before email update or use atomic RPC [recategorize-action.ts, handled-quietly-actions.ts]
- updateEmailCategorization missing workspace_id scope — cross-tenant write vector for service-role callers; add workspaceId param + .eq('workspace_id', workspaceId) [packages/db/src/queries/inbox/email-queries.ts]
- isFiring ref in SwipeableCard resets before server action resolves — second swipe possible during in-flight action; wire disabled prop from parent isPending [swipeable-card.tsx]
- getHandledEmails returns full EmailRow including body_clean and headers — unnecessary PII over wire; replace .select('*') with field projection [email-queries.ts]

## Deferred from: code review of 4-5-unified-communication-timeline (2026-05-08)

- M1 — Class-based React error boundary cannot catch RSC streaming errors; Next.js App Router requires `error.tsx` for server errors [components/TimelineErrorBoundary.tsx]
- V1 — `buildMixedTimelineFixture` uses non-UUID IDs (`'email-0'`, `'run-0'`); safe for unit tests but would break integration tests [packages/test-utils/src/fixtures/timeline.ts]
- W1 — Optimistic category state can persist stale after filter navigation if React reuses component instance at same list position [components/EmailTimelineItem.tsx]
- X1 — React list key uses array index (`${kind}-${id}-${index}`); index tiebreaker prevents duplicate-key warnings at cost of unstable keys on re-order [components/ClientTimeline.tsx:79]
- AA1 — Relative time display (`"5m ago"`) is computed at mount, never refreshed for long-lived sessions [components/EmailTimelineItem.tsx:22, AgentActionTimelineItem.tsx:21]
- AB1 — `dateFrom` computed at RSC render time; theoretical mismatch if page revalidates across midnight boundary [page.tsx:TimelineSection]

## Deferred from: code review of 4-5-unified-communication-timeline pass 2 (2026-05-08)

- ECH-7 — `computeDateFrom` duplicated in `ClientTimeline.tsx` and `page.tsx:TimelineSection`; extract to shared utility to prevent divergence when new range values are added.
- ECH-4 — `dateTo` is recomputed at Load More click time; items created between initial render and Load More could appear out of order. Mitigated in practice by cursor-based pagination.
- ECH-10 — `TimelineErrorBoundary` holds class-level error state that would not reset on client navigation if the boundary were ever moved to a shared layout; add `key={clientId}` prop as a safeguard if/when refactored.
- ECH-12 — `formatRelativeTime` function is duplicated identically in `EmailTimelineItem.tsx` and `AgentActionTimelineItem.tsx`; extract to `@flow/ui` or a local `utils.ts`.
- ECH-13 — `supabase` prop in `TimelineSection` is typed as `any`, bypassing Supabase's generated type-safety; replace with the project's typed `SupabaseClient`.

## Deferred from: code review of 5-1-time-entry-data-model-manual-logging (2026-05-09)

- D5-1-1 — `passthrough()` on Zod row schemas in `packages/db/src/queries/time-entries/` and `packages/db/src/queries/projects/` silently accepts unknown DB columns; switch to `.strip()` for stricter type safety at schema evolution boundaries.
- D5-1-2 — `role` typed as `string` throughout query layer and components; introduce a `Role = 'owner' | 'admin' | 'member'` union type for exhaustiveness checking.
- D5-1-3 — `app_metadata` JWT claims in `apps/web/app/(workspace)/time/page.tsx:14-17` cast via `as string | undefined` without structural validation; add Zod parse or type guard consistent with other workspace pages.
- D5-1-4 — `member_client_access` fetched in a separate DB round-trip on every `listTimeEntries` call for member role; refactor to a JOIN or cache the access list at the session level.
- D5-1-5 — `getClientName` performs an O(n) linear scan per table row per render in `time-entry-list.tsx`; memoize as a `Map<string, string>` with `useMemo`.
- D5-1-6 — `createProject` catches all Postgres `23505` errors as `ProjectNameDuplicateError` regardless of which unique constraint fired; narrow to constraint name `projects_unique_name_per_client` for correctness.

## Deferred from: code review (Round 2) of 5-1-time-entry-data-model-manual-logging (2026-05-09)

- D5-1-R2-1 — `deleted_at` set via `new Date().toISOString()` in application code rather than DB-level `now()`; pre-existing pattern across the codebase; clock-skew risk negligible in practice. `tech-debt` `packages/db/src/queries/time-entries/soft-delete.ts`
- D5-1-R2-2 — Duplicate `projectRowSchema`/`mapProjectRow` defined identically in `create.ts` and `list.ts`; pre-existing pattern in clients module; extract to shared `row-schema.ts` in a code quality pass. `tech-debt` `packages/db/src/queries/projects/`
- D5-1-R2-3 — Duplicate `timeEntryRowSchema`/`mapTimeEntryRow` in `create.ts` and `list.ts`; same as D5-1-R2-2. `tech-debt` `packages/db/src/queries/time-entries/`
- D5-1-R2-4 — Projects `UPDATE` RLS `WITH CHECK` does not prevent `client_id` mutation; no current UI path changes `client_id`; address when full project management UI is built. `tech-debt` `supabase/migrations/20260510000001_create_projects_table.sql`
- D5-1-R2-5 — `AbortController` in `log-time-modal.tsx` has no effect on server actions (can't cancel); pattern still prevents stale state from being applied; acceptable as-is. `tech-debt` `apps/web/app/(workspace)/time/components/log-time-modal.tsx`
- D5-1-R2-6 — `createProject` catches all `23505` Postgres errors as name-duplicate regardless of which constraint fired; very low probability of false match; narrowing deferred. `tech-debt` `packages/db/src/queries/projects/create.ts`
- D5-1-R2-7 — `formatDuration` has no guard for negative or non-integer inputs; callers guaranteed valid input by DB CHECK (`duration_minutes > 0`) and Zod `.int().min(1)`. `tech-debt` `apps/web/lib/format-duration.ts`
- D5-1-R2-8 — `CREATE INDEX` in migration lacks `IF NOT EXISTS` guard; migrations are not re-run in standard workflow; low risk. `tech-debt` `supabase/migrations/20260510000002_evolve_time_entries.sql`
- D5-1-R2-9 — 500-entry `member_client_access` cap silently scopes member visibility; cap is a practical safety valve; acknowledged limitation, extremely rare at current scale. `tech-debt` `packages/db/src/queries/time-entries/list.ts`
- D5-1-R2-10 — Vitest `mockClient.from` mock implementation not reset between test suites in `beforeEach`; `vi.clearAllMocks()` resets call counts only; tests set their own mock where needed; works in practice. `test-debt` `packages/db/src/queries/time-entries/__tests__/queries.test.ts`
- D5-1-R2-11 — `parseInt("1.5e3", 10)` returns `1`, potentially bypassing the `min 1` duration guard; server-side Zod `.max(1440)` still catches out-of-range; extremely low real-world risk. `tech-debt` `apps/web/app/(workspace)/time/components/log-time-modal.tsx`

## Deferred from: code review of 5-2-persistent-sidebar-timer (2026-05-10)

- D5-2-R1-W1 — AC1: timer slot gated on agentCount ≥ 2; pre-existing sidebar architecture; requires product decision on sidebar visibility scope. `product-debt` `packages/ui/src/layouts/workspace-shell.tsx`
- D5-2-R1-W2 — no pagination on clients/projects list queries in timer picker; pre-existing pattern; becomes relevant at high client volume. `tech-debt` `apps/web/app/(workspace)/time/actions/list-clients-for-timer.ts`
- D5-2-R1-W3 — AC6: font-mono mapping to JetBrains Mono unverified in tailwind.config; pre-existing config concern applies across the codebase. `tech-debt` `tailwind.config`
- D5-2-R1-W4 — collapsed timer staleness hour count computed at render time only (not live); cosmetic; off by at most 1 hour in the warning text. `tech-debt` `packages/ui/src/components/timer/collapsed-timer.tsx`
- D5-2-R1-W5 — timer_state.notes field lacks DB-level length constraint (Zod-only at action boundary); intentional; consistent with other text fields in the schema. `tech-debt` `packages/db/src/schema/timer-state.ts`

## Deferred from: code review of 5-3-time-entry-editing-invoice-impact-warnings (2026-05-11)

- D5-3-R1-W1 — `previousValues` only captures scalar fields, not `updated_at`; minor for current use case (future undo/rollback may need it). `tech-debt` `apps/web/app/(workspace)/time/actions/update-time-entry.ts:105-110`
- D5-3-R1-W2 — Service role UPDATE policy has no guardrails (unrestricted UPDATE including on deleted rows and cross-workspace); intentional for Epic 2 agent operations. `by-design` `supabase/migrations/20260511000001_time_entries_update_policy.sql:29-33`
- D5-3-R2-W1 — `handleUpdated` doesn't update `projectName` in local state after edit; stale project name displayed until next fetch. Low impact (display-only). `tech-debt` `apps/web/app/(workspace)/time/components/time-entry-list.tsx:92-105`
- D5-3-R2-W2 — Update + edit-history insert not atomic (two separate Supabase calls); if history insert fails after update commits, audit trail is lost. RPC transaction deferred to D5 (first review decision). `tech-debt` `apps/web/app/(workspace)/time/actions/update-time-entry.ts:116-133`

## Deferred from: code review of 5-4-time-integrity-agent (2026-05-12)

⚠️ Note: 9 deferred items exceeds the 5-item cap rule. Recommend pruning W3/W4/W7/W8 (all low-impact by-design) to bring within cap — see notes below.

- D5-4-D1 — **MUST COMPLETE BEFORE EPIC 7** — Gap/overlap detectors deferred to story 5.4a: add `start_minutes`/`end_minutes` nullable columns to `time_entries`, update executor query, add optional time-pickers to manual-log UI. Without this, undetected billing overlaps reach invoice reconciliation (7-4) as a corrupted signal corpus. `spec-gap` `packages/agents/time-integrity/executor.ts, anomaly-detection.ts`
- D5-4-W1 — `confidence: 0.9` hardcoded for all anomaly proposals regardless of type; no spec differentiation required; calibrate per-type post-MVP when trust scoring is extended. `tech-debt` `packages/agents/time-integrity/executor.ts:196`
- D5-4-W2 — `detectLowHours` fires on weekends and public holidays generating noise signals; requires workspace settings infrastructure (working-days config) which is explicitly post-MVP. `spec-gap` `packages/agents/time-integrity/anomaly-detection.ts:116`
- D5-4-W3 — TOCTOU double-check: trigger fan-out and executor both call `getAgentConfiguration`; the second check is correct defensive behavior; no action needed unless DB round-trip cost becomes measurable. `by-design` `sweep-worker.ts`, `executor.ts`
- D5-4-W4 — `sweepDate` baked at trigger-time; delayed retries use original date; this is correct for idempotency; only a concern if sweepDate needs to be "today at retry time" which would break idempotency. `by-design` `packages/agents/orchestrator/sweep-worker.ts:43`
- D5-4-W5 — Negative gap / midnight-spanning entries produce wrong gap calculations when `start_time`/`end_time` eventually added to `time_entries`; revisit when schema evolution adds time-of-day support. `tech-debt` `packages/agents/time-integrity/anomaly-detection.ts:51`
- D5-4-W6 — Stale gap/overlap signals not auto-resolved when user fills the gap or removes the overlap; signal lifecycle management (mark resolved when anomaly no longer present) is post-MVP. `spec-gap`
- D5-4-W7 — `durationMinutes: 0` entries not guarded in anomaly detection; prevented by DB `CHECK (duration_minutes > 0)` constraint; guard only needed if entries are inserted bypassing the constraint. `by-design` `packages/agents/time-integrity/anomaly-detection.ts:118`
- D5-4-W8 — `workspaceId: 'system'` used in audit log for system-level sweep trigger events; pre-existing pattern in `factory.ts`; only a risk if `audit_log.workspace_id` is typed uuid at DB level. `by-design` `packages/agents/orchestrator/sweep-worker.ts:35`
- D5-4-W9 — NFR02 performance test measures in-memory detection CPU time only, not full DB sweep round-trips; full E2E timing requires integration test environment with DB; unit benchmark is appropriate for detection algorithm layer. `test-debt` `packages/agents/time-integrity/__tests__/anomaly-detection.test.ts:216`

## Deferred from: code review of 5-4a-time-of-day-gap-overlap-detection (2026-05-13)

- D5-4a-R1-W1 — `ENTRY_FETCH_LIMIT=5000` silently truncates; sweep returns `success: true` with no `isPartial` flag; add pagination or an explicit partial-result indicator at scale. `tech-debt` `packages/agents/time-integrity/executor.ts:14`
- D5-4a-R1-W2 — Orphan cleanup sets `dismissed_at` on transient `insertRun` DB error; signal permanently dismissed even on recoverable failures; revisit in Epic 10 error-handling story (10-4). `tech-debt` `packages/agents/time-integrity/executor.ts:~650`
- D5-4a-R1-W3 — Auto-duration effect gives no real-time hint when `end <= start`; user only receives feedback at server-side submit; add inline warning near time pickers in a UX polish pass. `tech-debt` `apps/web/app/(workspace)/time/components/log-time-modal.tsx, edit-time-entry-modal.tsx`

## Deferred from: code review round 2 of 5-4-time-integrity-agent (2026-05-12)

- D5-4-R2-D1 — Days with zero time entries never flagged (strongest low-hours case invisible); requires workspace calendar or working-days configuration to know which days should have entries. `spec-gap` `packages/agents/time-integrity/anomaly-detection.ts:116`
- D5-4-R2-D2 — `durationMinutes: NaN` or negative values silently corrupt low-hours detection; prevented by DB CHECK constraint at time_entries layer. `by-design` `packages/agents/time-integrity/anomaly-detection.ts:117`
- D5-4-R2-D3 — Trust client catch-all `catch {}` masks programming errors (TypeError, ReferenceError); narrow to expected error types only post-MVP. `tech-debt` `packages/agents/time-integrity/executor.ts:176-179`
- D5-4-R2-D4 — `getPendingIntegritySignals` limited to 50 results with no pagination; at scale older signals silently dropped. `tech-debt` `apps/web/lib/actions/time-integrity/actions.ts:107`
- D5-4-R2-D5 — Concurrent sweeps can produce stale signals from different entry snapshots; low risk due to pg-boss job dedup and 2am UTC timing; add advisory lock per workspace post-MVP. `tech-debt` `packages/agents/time-integrity/executor.ts:135-265`
- D5-4-R2-D6 — UTC date in sweep fan-out causes timezone mismatch for non-UTC workspaces; requires workspace timezone settings (post-MVP). `spec-gap` `packages/agents/orchestrator/sweep-worker.ts:43`
- D5-4-R2-D7 — Missing composite index for pending-signals query (workspace_id + resolved_at IS NULL + dismissed_at IS NULL); add partial index when signal volume grows. `tech-debt` `supabase/migrations/20260512000001_time_integrity_signals.sql`
- D5-4-R2-D8 — `preCheck` redundantly fetches agent config also fetched by execute; pre-existing defensive pattern acceptable for MVP. `by-design` `packages/agents/time-integrity/pre-check.ts:25`
- D5-4-R2-D9 — Auto-trust signals never audited in TriageInbox; signal gets resolved_at immediately with no agent_run; action is audit-logged but UI-invisible. `spec-gap` `packages/agents/time-integrity/executor.ts:261-263`
- D5-4-R2-D10 — `affected_entry_ids` references soft-deleted entries with no UI indication; entries deleted between sweep and display become invisible references. `tech-debt` `apps/web/lib/actions/time-integrity/actions.ts:119`

## Deferred from: code review of 6-3-booking-proposals-event-creation.md (2026-05-20)

- D6-3-R-M7 — CalendarTokenManager imported directly from google-calendar/token-manager.ts in action code (propose-booking-action.ts, create-event-action.ts). Same pattern in 6-1/6-2. Needs CalendarAuthProvider interface abstraction when adding second provider. Tagged Epic 2. `tech-debt`
- D6-3-R-RLS — Dead service_role RLS policy in scheduling_requests migration (line 74-78). `auth.role() = 'service_role'` with `TO authenticated` never matches — service_role bypasses RLS entirely. Harmless but misleading. Remove in cleanup pass. `tech-debt`
- D6-3-R-TIMEOUT — withTimeout utility duplicated in slot-finder.ts and create-event-action.ts. Extract to shared utility (packages/shared or within agents/shared). `tech-debt`
- D6-3-R-DYNIMPORT — Dynamic imports inside loop in slot-finder.ts loadCalendarProviders(). Convert to static imports for bundler compatibility. `tech-debt`

## Deferred from: code review of 6-4-bypass-detection-cascade-rescheduling.md (2026-05-24)

- D6-4-R-SRLS — Dead service_role RLS policies on calendar_bypass_metrics and calendar_event_relations. `TO authenticated` with `auth.role() = 'service_role'` never matches. Pre-existing pattern from earlier stories. `tech-debt`
- D6-4-R-WINDOW — bypass_metrics window_start filter (`.gte`) fragments metrics when 30-day rolling window shifts. Window management needs product input on strategy (merge? new row? truncate?). `product-decision`
- D6-4-R-MILLI — getRollingWindow() generates non-deterministic millisecond-precision boundaries causing unnecessary row creation. Coupled to D6-4-R-WINDOW. `tech-debt`
- D6-4-R-MINSAMPLE — First bypass event triggers immediate alert (rate=1.0 > 0.3 threshold). Product decision needed on minimum sample size before alerts fire. `product-decision`
- D6-4-R-DEADCODE — Cascade executor non-cancel update path sends empty provider payload. Currently unreachable but dead code. Blocked on move-to-vacated option implementation. `tech-debt`
- D6-4-R-EMPTYCATCH — Empty catch block without comment in cascade rollback path (cascade-executor.ts:793). Project rule violation. Coupled to rollback rework. `tech-debt`
- D6-4-R-PRECEDENCE — Operator precedence: `source ?? 'unknown' as const` in initial-sync.ts:121. `as const` binds tighter than `??` but TypeScript still infers correctly. Cosmetic. `tech-debt`

## Deferred from: code review of 7-3-partial-payments-balance-tracking (2026-05-26)

- D7-3-R-D1 — Idempotency key stored after RPC (not atomic inside transaction). If store fails after successful payment, retry produces duplicate. Accepted tradeoff for v1 — real-world probability negligible for single-VA billing. `tech-debt` `apps/web/lib/actions/invoices/record-payment-helpers.ts`
- D7-3-R-W1 — No generic toast system; success notification uses `alert()`. Toast infrastructure is a cross-cutting concern deferred to a dedicated story. `spec-gap` `apps/web/app/(workspace)/invoices/[invoiceId]/components/record-payment-modal.tsx:94`
- D7-3-R-W2 — `clientName` added as optional field on `InvoiceWithBalance` but not populated from DB in all query paths. Some consumers may see `undefined`. Populate consistently in a follow-up or remove optional field. `tech-debt` `packages/types/src/invoice-payment.ts:31`
- D7-3-R-W3 — Pre-existing `create-invoice-form.tsx` imports `./actions` which doesn't exist; not a 7-3 issue. `tech-debt` `apps/web/app/(workspace)/invoices/new/components/create-invoice-form.tsx:5`
- D7-3-R-W4 — Pre-existing `get-delivery-status.ts` type mismatch on `attemptLog` array (string vs optional fields). Not a 7-3 issue. `tech-debt` `apps/web/lib/actions/invoices/get-delivery-status.ts:63`
- D7-3-R-W5 — ATDD stubs (8 `test.skip()` in `7-3-partial-payments.spec.ts`) remain skipped; implement when feature is integration-tested. `test-debt` `apps/web/__tests__/acceptance/epic-7/7-3-partial-payments.spec.ts`
- D7-3-R-W6 — RPC `record_payment_with_concurrency` uses `RAISE EXCEPTION` for error signaling; no structured error code field in the exception message. Client parses error text to map codes. Consider adding `ERRCODE` or JSON payload in a hardening pass. `tech-debt` `supabase/migrations/20260529000001_invoice_payments.sql`
- D7-3-R-W7 — `invoice_payments` table has no index on `(invoice_id, created_at)` for payment history ordering by date. Add composite index when payment history query performance becomes measurable. `tech-debt` `supabase/migrations/20260529000001_invoice_payments.sql`
- D7-3-R-W8 — Balance recalculation in RPC uses `COALESCE(SUM(p.amount_cents), 0)` which scans all payments for the invoice on each payment. Acceptable at current scale. Consider materialized balance or trigger-based update at scale. `tech-debt` `supabase/migrations/20260529000001_invoice_payments.sql`
- D7-3-R-W9 — No Stripe webhook handler for `payment_intent.succeeded` to auto-record Stripe payments. Manual-only for v1 as specified. `spec-gap` (by design for Epic 7)
- D7-3-R-W10 — `formatCentsToDollar` in overpayment-confirmation.tsx passes raw cents number to template literal, not formatted string. Parent passes pre-formatted string. Verify at integration test time. `test-debt` `apps/web/app/(workspace)/invoices/[invoiceId]/components/overpayment-confirmation.tsx:17`
- D7-3-R-W11 — `record-payment-helpers.ts` at 245 lines is close to the 250-line limit. Further growth may require another split. `tech-debt` `apps/web/lib/actions/invoices/record-payment-helpers.ts`

## Deferred from: code review of 7-3a-time-entry-billing-computation (2026-05-26)

- D7-3a-R-D1 — Non-atomic delete-and-reinsert of line items in update-invoice. DELETE then INSERT without transaction. Concurrent read sees zero items. Pre-existing pattern from Story 7-1. `tech-debt` `apps/web/lib/actions/invoices/update-invoice.ts:192-213`
- D7-3a-R-D2 — Audit log inserts removed from record-payment.ts without server-side replacement in RPC. Pre-existing regression from 7-3 idempotency refactor. `tech-debt` `apps/web/lib/actions/invoices/record-payment.ts`
- D7-3a-R-D3 — Accessibility regression: `aria-describedby` removed from date input and error text emptied in record-payment-modal. Pre-existing from 7-3 patches. `tech-debt` `apps/web/app/(workspace)/invoices/[invoiceId]/components/record-payment-modal.tsx`

## Deferred from: code review of 7-4-void-credit-note-time-reconciliation (2026-05-27)

- D7-4-R-D1 — ATDD tests all `test.skip()` — no executable verification. Matches ATDD scaffold pattern used in other epics. `test-debt` `apps/web/__tests__/acceptance/epic-7/7-4-void-credit-note.spec.ts`
- D7-4-R-D2 — `set_credit_notes_updated_at` trigger unreachable due to no UPDATE RLS policy. Harmless dead code. `tech-debt` `supabase/migrations/20260531000001_credit_notes.sql:26-29`
- D7-4-R-D3 — Void modal payment linkage wording may be inaccurate — says "will no longer be linked to this invoice" but payments remain in invoice_payments. Cosmetic copy issue. `ux-polish` `apps/web/app/(workspace)/invoices/[invoiceId]/components/void-invoice-button.tsx:60`
- D7-4-R-D4 — Issue Credit Note button visible when maxCreditCents=0. Minor UX polish — should hide button when no credit can be issued. `ux-polish` `apps/web/app/(workspace)/invoices/[invoiceId]/page.tsx:92-98`
- D7-4-R-D5 — `voidInvoiceViaRpc`/`issueCreditNoteViaRpc` query wrappers unused by actions (actions call supabase.rpc directly). Wrappers available for future non-action callers. `tech-debt` `packages/db/src/queries/invoices/void-invoice.ts`, `issue-credit-note.ts`

## Deferred from: code review of 7-5-stripe-payment-failure-handling (2026-05-27)

- D7-5-R-D1 — `checkout.session.completed` with missing metadata marked `processed` instead of `failed`. Story 9-3 owns success path side effects. `scope-deferred` `apps/web/app/api/webhooks/stripe/route.ts:108-124`
- D7-5-R-D2 — No trace-level logging of full payloads per AC5. Not logging is safer than logging per PCI-DSS. `spec-deviation` `apps/web/app/api/webhooks/stripe/route.ts`
- D7-5-R-D3 — No explicit 5-second handler timeout per NFR05. Spec prohibits `Promise.race` and no alternative enforcement exists. Design gap. `design-gap` `apps/web/app/api/webhooks/stripe/route.ts`
- D7-5-R-D4 — Stuck `pending` webhook events past TTL never cleaned up. Cleanup only targets `processed`/`failed` rows. Need stale-pending sweeper. `tech-debt` `supabase/migrations/20260601000001_stripe_payment_failures.sql`
- D7-5-R-D5 — `amountCents` can be `NaN` if Stripe sends non-numeric string. Outer catch handles it but error message is cryptic. `edge-case` `apps/web/app/api/webhooks/stripe/route.ts:145`
- D7-5-R-D6 — Non-UUID metadata values cause FK violation on dedup insert → returns 500, Stripe retries event that will never succeed. Should validate UUID format and mark `failed` instead. `edge-case` `apps/web/app/api/webhooks/stripe/route.ts:86`
