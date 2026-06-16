# Adversarial Review — Story 9.2

**Review type:** Party-mode roundtable (Winston, Murat, Amelia). Sally attended but had no substantive UX objections beyond points already captured by Winston/Amelia.
**Date:** 2026-06-16
**Status of story under review:** `ready-for-dev` at start of review.

---

## Verdict

Story 9.2 is **NOT ready for dev** in its current form. The architecture is directionally correct, but multiple blockers must be resolved before the story can move to `in-progress`:

1. **Status mismatch:** the file claims `ready-for-dev` while an architectural sign-off is still marked `[pending final Winston confirmation]`.
2. **Schema gaps** make `payment_url` reuse/staleness (EC5) unimplementable and untestable.
3. **ATDD scaffold** uses the wrong route group (`(portal)` instead of `portal/[slug]`) and non-UUID IDs.
4. **Missing return-shape / RPC-grant / rate-limit / data-source specifications** will cause the dev agent to guess.
5. **Scope leakage** into Epic 7 (`send-invoice.ts`) and Epic 8 (`submit-weekly-report-run.ts`) must be clarified.

After resolution of the blockers below, the story should be re-tagged `ready-for-dev` (or kept in `review` until edits land).

**Update (2026-06-16):** The story file and ATDD scaffold were edited in this session. CB-1 through CB-10 and most major issues have been addressed in the updated 9-2.md. The remaining items are verification steps (run typecheck/tests, record red-phase SHA) that happen during implementation, not in the spec.

---

## Critical Blockers (must fix before in-progress)

### CB-1 — Status is internally inconsistent
- **Finding:** 9-2.md declares `Status: ready-for-dev`, but line 77 marks the portal mutation pattern as `[pending final Winston confirmation — noted as Decision-Needed]`.
- **Risk:** A critical architectural gate cannot be both pending and signed off.
- **Resolution:** Resolve the pending confirmation and update the sign-off line. This review itself serves as Winston confirmation; update the note to cite this review artifact.

### CB-2 — `payment_url` staleness cannot be detected
- **Finding:** AC3/EC5 require reusing the existing `payment_url` if "still valid" and refreshing it if stale. Epic 7's `invoices` table has only `payment_url`, with no `payment_url_expires_at` or `stripe_checkout_session_id` column. T3.1 references `expiresAt` but does not show how to obtain it.
- **Risk:** The dev agent will either always mint fresh sessions (wasteful, loses idempotency) or reuse expired URLs (payment fails).
- **Resolution:** Add to T1.2: persist `stripe_checkout_session_id text` and `payment_url_expires_at timestamptz`. Define staleness check in T3.1 as `payment_url IS NOT NULL AND payment_url_expires_at > now()`. Update existing `send-invoice.ts` to populate these columns, or add a T5.2-style note that this is a backfill trigger.

### CB-3 — ATDD scaffold routes and IDs are wrong
- **Finding:** The ATDD spec mocks `@/app/(portal)/invoices/[invoiceId]/page`, `@/app/(portal)/reports/[reportId]/page`, and `@/app/(portal)/components/ZeroThoughtTasksHero`. 9-1a/9-1b and project-context.md:126 moved the portal tree to `app/portal/[slug]/...`. The scaffold also uses `PORTAL_CTX = { clientId: 'cli-1', workspaceId: 'ws-1', tokenId: 'tok-1' }` — non-UUID strings will fail real Zod/DB validation.
- **Risk:** T7.1 reconciliation will happen late and tests may never truly assert real code.
- **Resolution:** Update the red-phase scaffold now (before any implementation) to mock `@/app/portal/[slug]/invoices/[invoiceId]/page`, `@/app/portal/[slug]/reports/[reportId]/page`, `@/app/portal/components/ZeroThoughtTasksHero`, and use realistic UUID values for `clientId`, `workspaceId`, `portalTokenId`.

### CB-4 — RPC return types and grants are unspecified
- **Finding:** T1.3/T1.4 use `RETURNS table(status text)`, a single-column table awkward for `.single()`. T1.5 returns `void` and cannot signal wrong-client. T4.1 says call via `getServerSupabase()` (anon) but the migration does not specify `GRANT EXECUTE` to `anon`.
- **Risk:** Dev will choose inconsistent signatures and the action will fail with permission denied.
- **Resolution:**
  - Change `approve_report_via_portal` / `request_report_changes_via_portal` to `RETURNS text` returning `'OK' | 'INVALID_STATE' | 'FORBIDDEN'`.
  - Change `refresh_portal_checkout_url` to `RETURNS text` returning `'OK' | 'FORBIDDEN'` and `RAISE` on internal errors, or keep `void` and explicitly document that wrong-client is a `RAISE`.
  - Add `GRANT EXECUTE ON FUNCTION ... TO anon, portal;` (or only `anon` if the action is server-side) for all three RPCs.

### CB-5 — `sendClientNotificationAction` lacks caller authorization
- **Finding:** AC5 defines `sendClientNotificationAction({ type, clientId, payload })` with no `portalCtx`. It is wired into Epic 7/8 workspace paths where any workspace role might call it. A bug or malicious caller could pass any `clientId`.
- **Risk:** Cross-client email leak or spam.
- **Resolution:** Require `portalCtx` when called from portal actions; for workspace-side triggers, add an internal `sendClientNotificationServerAction({ type, clientId, payload })` that verifies the caller is a workspace Server Action (via `requireTenantContext`) and that `clientId` belongs to the workspace. Do not expose the unguarded signature publicly.

### CB-6 — Scope leakage into Epic 7/8 is ambiguous
- **Finding:** T5.2 says "add the call" in `send-invoice.ts` (Epic 7) and `submit-weekly-report-run.ts` (Epic 8). This is out-of-scope modification of already-closed epics.
- **Risk:** Regression risk; tests for Epic 7/8 may fail.
- **Resolution:** Change T5.2 to: document the trigger points in 9-2, and add the calls behind a feature flag that defaults to off until 9-2 is green. Better: move the trigger wiring to 9-3a (`payment_confirmed`) and keep 9-2 focused on the notification action itself. For `invoice_created` and `report_shared`, the workspace-side trigger should be a one-line call to the guarded server action and must be covered by a regression test proving Epic 7/8 behavior is unchanged when the notification provider fails (EC12/EC13).

### CB-7 — No rate limiting on portal mutations
- **Finding:** 9-1a rate-limited token generation/validation. 9-2 has no rate limits on checkout minting, report approval, or change requests.
- **Risk:** Stripe API abuse, log spam, double-click races.
- **Resolution:** Add rate limiting per `portal_token_id`/`client_id` to `payInvoicePortalAction`, `approveReportAction`, and `requestReportChangesAction` using the existing `check_rate_limit` RPC (mirror 9-1a).

### CB-8 — Hero metric data source is undefined
- **Finding:** AC6/Dev Notes say count "completed `agent_runs` (or `signals` consumed) for the client's workspace where the client is the subject, in the current week". `agent_runs` has no `client_id` column; the join is hand-wavy.
- **Risk:** Component is unimplementable.
- **Resolution:** Define the MVP query explicitly. Recommended: count `signals` rows for the client's `workspace_id` with `created_at` in the current week and `consumed_at IS NOT NULL`, capped to this client via `signal_context->>'client_id'` if present. Add the exact SQL shape to Dev Notes.

### CB-9 — `weekly_report_sections` RLS policy is incomplete
- **Finding:** AC1 scopes the portal role to `client_id` on all five tables, but `weekly_report_sections` has no `client_id` column. T1.1's placeholder policy does not show the required `EXISTS (SELECT 1 FROM weekly_reports ...)` join.
- **Risk:** Policy fails at migration time or leaks data.
- **Resolution:** Expand T1.1 with explicit join policy for `weekly_report_sections` and `invoice_payments` (join through `invoices`).

### CB-10 — Value-receipt / next-week preview / message-VA lack query contracts
- **Finding:** AC7 says derive counts from line items and pull meetings/deadlines from "existing tables", but no column mapping, SQL shape, or types are specified.
- **Risk:** Untestable; dev will fabricate or under-implement.
- **Resolution:** Add query contracts to T6.4/T6.6:
  - Value receipt: `SELECT COUNT(*) FILTER (WHERE time_entry_id IS NOT NULL) AS tasks, COUNT(*) FILTER (WHERE calendar_event_id IS NOT NULL) AS meetings FROM invoice_line_items WHERE invoice_id = $1`.
  - Next-week preview: `SELECT ... FROM calendar_events ce WHERE ce.workspace_id = $1 AND ce.client_id = $2 AND ce.start_time BETWEEN now() AND now() + interval '7 days'`.
  - Message-VA response-time estimate: hardcoded SLA string for MVP ("typically within 4 business hours") with a TODO to source from workspace settings.

---

## Major Issues (must address during story, can be fixed before green)

### MJ-1 — Return-shape inconsistency
- AC3 says pay returns `{ success: true, data: { checkoutUrl } }`; T3.1 adds `PROVIDER_ERROR` which never appears in ACs.
- AC5 says notifications return `{ success: false }`, but EC13 demands `{ success: false, reason: 'NO_RECIPIENT' }`.
- **Resolution:** Define a single envelope for all actions: `ActionResult<{ checkoutUrl?: string; messageId?: string }>` with `error.code` from `FlowErrorCode` (confirm `FINANCIAL_INVALID_STATE`, `INVALID_STATE`, `PROVIDER_ERROR`, `FORBIDDEN`, `AUTH_REQUIRED`, `RATE_LIMITED` exist). Update AC5 and EC13 to match.

### MJ-2 — `draft` payment branch is unreachable
- AC2 hides `draft`/`voided` from clients via RLS, yet AC3/EC2 demands `FINANCIAL_INVALID_STATE` for draft. If RLS works, the draft branch in `payInvoicePortalAction` is dead code; if reachable, RLS is broken.
- **Resolution:** Keep the guard in the action (defense in depth) and add a comment noting it is a second-line check. Test EC2 by invoking the action directly with a draft invoice ID and a mock that bypasses RLS, or document that EC2 is covered by RLS + action guard integration test.

### MJ-3 — `trending` / `stillness` states are underspecified
- `trending` demands a 4-week sparkline but Dev Notes defer the real sparkline. `stillness` requires "no change since yesterday" but no data source is defined.
- **Resolution:** For MVP, implement `trending` as `static` plus an upward/downward trend arrow based on current-week vs previous-week counts. Implement `stillness` as "count === yesterday's count" using a simple cache or query. Document deferral of real sparkline to post-MVP.

### MJ-4 — Animation tests are flaky
- `ZeroThoughtTasksHero` uses `requestAnimationFrame`; tests asserting mid-animation values will be flaky without mocked `rAF`/`performance.now()`.
- **Resolution:** Provide a Vitest helper that stubs `requestAnimationFrame` and `performance.now()` deterministically, or test the component by skipping the animation frame and asserting final rendered state + `prefers-reduced-motion` branch.

### MJ-5 — File-size limits will break on first draft
- `pay-invoice.ts` must validate, query, check balance, call provider, call RPC, map errors in ≤50 lines. `notifications.ts` must build 3 email templates in ≤50 lines. `ZeroThoughtTasksHero` has 5 states in ≤80 lines.
- **Resolution:** Split `report-approval.ts` into `approve-report.ts` + `request-report-changes.ts`. Split `notifications.ts` into `client-notification.ts` (action) + `client-notification-templates.ts` (templates). Split hero states into sub-components (`CountingState`, `EmptyState`, etc.). Update Project Structure Notes accordingly.

### MJ-6 — Provider signature mismatch risk
- T3.1 lists `createCheckoutSession({ amountCents, currency, invoiceNumber, metadata, successUrl, cancelUrl, idempotencyKey })`. The dependency scan only references `send-invoice.ts:83-86`; it is unclear whether the provider accepts all these fields.
- **Resolution:** Verify the provider signature before dev starts. Add a reference to `packages/agents/providers/payment-provider.ts` lines 90-129.

### MJ-7 — No `successUrl`/`cancelUrl` routes defined
- T3.1 passes `successUrl`/`cancelUrl` to Stripe but never defines the portal routes they point to.
- **Resolution:** Define:
  - `successUrl`: `${portalOrigin}/portal/${slug}/invoices/${invoiceId}?status=success&session_id={CHECKOUT_SESSION_ID}`
  - `cancelUrl`: `${portalOrigin}/portal/${slug}/invoices/${invoiceId}?status=cancel`
  Add to AC3 or T3.1.

### MJ-8 — Idempotency key generation undefined
- T3.1 passes an `idempotencyKey` to the provider but provides no generation strategy.
- **Resolution:** Use `portal:${portalTokenId}:invoice:${invoiceId}:balance:${balanceCents}:${Math.floor(Date.now() / 3600000)}` (hour bucket) so repeated clicks within the same hour reuse the Stripe session, but balance changes break the key.

### MJ-9 — `currency` source undefined
- T3.1 passes `currency` to the provider but does not specify the invoice column.
- **Resolution:** Add `currency` (or `currency_code`) to the `Invoice` type and to the invoice query in T2.1/T2.2. Default to `'usd'`.

### MJ-10 — No notification log table specified
- AC5 says "Each send is logged" but no table/schema is defined.
- **Resolution:** Reuse the existing `email_logs` / `notification_logs` table or create `client_notification_logs(id, type, client_id, payload, provider_message_id, status, error, created_at)`. Add to T1.2.

### MJ-11 — `updated_at` not refreshed by RPCs
- T1.3/T1.4 transition report status but do not explicitly set `updated_at = now()`.
- **Resolution:** Add `updated_at = now()` to both RPCs. Verify `weekly_reports` has an `updated_at` column.

### MJ-12 — `clients.archived_at` not checked in portal RLS
- EC14 says archived clients are denied, relying on `validatePortalSessionWithDb()`. But 9-1a does not clearly show an `archived_at` check. If the session is still valid, RLS on `invoices`/`weekly_reports` should also join/filter by `clients.archived_at IS NULL`.
- **Resolution:** Add `AND EXISTS (SELECT 1 FROM clients c WHERE c.id = client_id AND c.archived_at IS NULL)` to portal policies, or ensure `validatePortalSessionWithDb` denies archived clients and document it.

### MJ-13 — `invoice_payments` may over-share
- AC1 grants full SELECT on `invoice_payments` to clients. Payment rows may contain method identifiers or partial card data.
- **Resolution:** Column-level decision: portal role only needs `amount_cents`, `paid_at`, `status`. Either create a view or restrict the select list in T2.2 and do not grant broad SELECT if sensitive columns exist. If the table has no sensitive columns, document that.

### MJ-14 — pgTAP coverage holes
- T8.1 omits tests for `refresh_portal_checkout_url` wrong-client guard, `workspace_id::text` cast, direct INSERT/UPDATE denial for the portal role, `client_feedback` length, and `GRANT EXECUTE` scoping.
- **Resolution:** Expand T8.1 with explicit cases for all three RPCs and table-level write denial.

### MJ-15 — EC10 concurrent approve is hard to test
- The matrix claims `SELECT ... FOR UPDATE` handles concurrency, but Vitest/pgTAP cannot deterministically simulate two simultaneous sessions without a harness.
- **Resolution:** Use a pgTAP test that opens two psql sessions with advisory locks / `pg_sleep` to serialize the race, or document that EC10 is covered by the RPC semantics + a code review checklist rather than automated test.

### MJ-16 — E2E incorrectly treated as optional
- This story covers financial mutation (payment redirect) and report approval. Relying only on stubbed unit tests is insufficient.
- **Resolution:** Move E2E smoke from "nice-to-have" to mandatory for green phase: at minimum "generate link → open → see invoice list → click pay CTA → redirect to Stripe Checkout".

### MJ-17 — No task to regenerate Supabase types
- After adding columns/RPCs, `supabase gen types` must be re-run.
- **Resolution:** Add to T8.2.

---

## Minor Issues / Polish

- **Migration filename placeholder:** `2026MMDD000001_portal_invoice_report_rls.sql` must be resolved to a date > 20260616 (e.g., `20260617000001_portal_invoice_report_rls.sql`).
- **Two barrels confusion:** The story wants both `portal-queries-index.ts` and `index.ts`. Consolidate to one barrel `index.ts` or rename `portal-queries-index.ts` to `queries/index.ts`.
- **Hero metric gold accent test:** Add a JSDOM assertion that no text node in `ZeroThoughtTasksHero` uses `--portal-accent` as `color`.
- **Use of `tokenId` vs `portalTokenId`:** Standardize on `portalTokenId` everywhere (including ATDD scaffold).
- **AC4 says "idempotent" but the behavior is state-machine rejection, not true idempotency.** Reword EC6: "second approve returns INVALID_STATE" rather than "idempotent — second click is a no-op error".
- **Route reconciliation in T7.1 is late.** Move route-path updates into the red-phase scaffold now (CB-3).

---

## What Is Good (preserve)

- Portal mutation pattern (SECURITY DEFINER RPCs, no `service_role` in Node) is the right approach.
- AC2 correctly excludes `requireTenantContext` from portal pages.
- Provider abstraction mandate is correct and consistent with AGENTS.md.
- Money-as-integers rule is explicit.
- Edge-case matrix is mandatory and comprehensive.
- Out-of-scope list is clear.

---

## Recommended Next Steps

1. Update 9-2.md with resolutions for CB-1 through CB-10 (schema additions, RPC signatures/grants, rate limits, data-source contracts, ATDD scaffold fixes, scope-leakage clarification).
2. Update the ATDD spec `apps/web/__tests__/acceptance/epic-9/9-2-portal-invoice-payment-report-approval.spec.ts` to use correct routes and UUIDs.
3. Keep story status at `review` until the edits land, then move to `ready-for-dev`.
4. Re-run this adversarial review (or a focused follow-up) on the edited story before assigning to Amelia.
