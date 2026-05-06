# Deferred Work

Generated from Story 2.6a adversarial code review (2026-04-26).
Updated: Epic 3 retrospective (2026-04-27).

## Review Cadence

Deferred items are reviewed at every sprint boundary (epic completion):
- **When:** After each epic retrospective, before next epic begins
- **Owner:** Tech Writer (Paige) maintains this file; PM (John) triages at review
- **Process:**
  1. At sprint boundary, review each open item
  2. If trigger condition met → create story or standalone task
  3. If no longer relevant → mark resolved with reason
  4. Update status column below
- **Next review:** Before Epic 4 sprint planning

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

**Open item counts:** 0 total — 0 spec-gap, 0 tech-debt, 0 test-debt
**Resolved this polish sprint:** 21 items (all)
**Descoped:** 0 items
**Epic 2 remaining:** 0 (all resolved)
**Epic 3 items resolved:** 21 of 21 (100%)
**Closure rate:** 100% — clear for Epic 4

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
