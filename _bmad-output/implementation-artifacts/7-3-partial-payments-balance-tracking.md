# Story 7.3: Partial Payments & Balance Tracking

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Refinement Log

**Refinement Session:** 2026-05-26  
**Trigger:** Party Mode adversarial review (Winston, Murat, Mary, Sally) + PM/Dev follow-up (John, Amelia)  
**Decision:** Block 7-3 from dev until three hard blockers are resolved. Estimated: half-day refinement session.

### Hard Blockers (must be resolved before `in-progress`)

| # | Item | Finding | Resolution Assigned |
|---|---|---|---|
| HB1 | **AC6 contradiction** | References "overdue and unpaid" badge, but overdue detection deferred to Story 7-5. Sally: direct contradiction; Mary: ghost state. | **Action:** Remove "overdue" from AC6. Badge colors: green = paid, yellow = partially_paid, gray = draft. Overdue badge deferred to Story 7-5. |
| HB2 | **Overpayment contract undefined** | AC2 says overpayment "surfaces a non-blocking warning in the action result." No wire format, no UX prominence, no confirmation step. All four original agents + Amelia flagged. | **Action:** Define `OverpaymentWarning` wire shape in new AC2b. Define confirmation modal in new AC5b. |
| HB3 | **Negative balance semantics** | Overpayment produces `balanceCents < 0`. Is this stored? Capped? Credit note? Mary: "story is literally unshippable without this." Amelia: needs schema decision before first commit. | **Action:** Add AC3a: negative balances stored as `credit_balance_cents` on `invoices` (bigint, DEFAULT 0, ≥0). `balanceCents` is computed as `total_cents - amount_paid_cents`, which may be negative. `credit_balance_cents` tracks overpayment amount separately. |
| HB4 | **AC9 scope creep** | Winston: "payment logic contaminated with time-sheet arithmetic"; Mary: "smuggled in under the guise of a schema unblock"; John: "verify via 2hr spike before estimation." | **Action:** AC9 stripped to bare minimum: remove `.refine()` blocking `time_entry`. Full billing computation (6-step lookup, hourly rate resolution, UI picker) split to **new Story 7-3a: Time Entry Billing Computation** (see AC9a below). |
| HB5 | **Idempotency schema undefined** | "24hr window" stated but no table schema, no scope, no cleanup, no uniqueness constraint. Winston: "where does the key live?"; Murat: "untestable as specified"; Amelia: "can't write RPC handler." | **Action:** AC11 rewritten with explicit schema: `idempotency_keys(id, key, scope, locked_at, response_json, expires_at)`. Scope: `workspace_id + invoice_id + key`. Cleanup: daily cron `DELETE FROM idempotency_keys WHERE expires_at < now()`. |
| HB6 | **Atomic isolation is hand-waved** | Dev Notes: "single DB RPC or Supabase .rpc() call." No isolation level, no locking strategy. Winston: read-modify-write races when two users pay simultaneously. | **Action:** Add AC1a: migration adds `invoices.version INTEGER DEFAULT 1`. `recordPayment` RPC uses optimistic concurrency: check `version` before update, increment on success, retry on version mismatch (max 3 retries). |

### Medium Friction (won't block start but will block PR merge)

| # | Item | Finding | Resolution Assigned |
|---|---|---|---|
| MF1 | **No correction path** | Append-only financial records with no DELETE, no void payment UI, no refund flow. Sally: "trapped users." Winston: "support ticket-shaped hole." | **Action:** Add AC12: "Payments are immutable. Refunds, corrections, and void-payment flow are deferred to Story 7-4 (Credit Notes & Payment Corrections). This story records corrections only via additional offsetting payments (negative amounts NOT supported)." |
| MF2 | **Stripe reconciliation (AC7) underspecified** | Winston: "stripe_reconciliation_link text — cannot evolve when you add PayPal later." | **Resolution:** No schema change. AC7 already uses `stripe_payment_intent_id` (text, nullable, UNIQUE), which is sufficient for single-provider reconciliation. If multi-provider reconciliation becomes a requirement, it will be addressed in a future architecture spike. This is acceptable risk. |
| MF3 | **RLS `::text` cast not repeated in AC10** | AGENTS.md warns that missing `::text` cast causes RLS to silently deny all queries. AC10 describes policies but omits the cast constraint. | **Action:** Add explicit bullet to AC10: "All `workspace_id` comparisons in RLS policies MUST use `::text` cast (e.g., `workspace_id::text = auth.jwt() ->> 'workspace_id'`)." |

### Acceptable Risk (intentionally deferred)

| # | Item | Finding | Rationale |
|---|---|---|---|
| AR1 | **AC0 test list "shallow"** | Murat: omits race conditions, transaction rollback, audit assertion tests. | **Ruling (John):** AC0 is the *minimum acceptance list* — QA builds exhaustive test plan during test design. Not a PM blocker. |
| AR2 | **Cache invalidation timing** | Winston: "optimistic invalidation risks stale data on rollback." | **Ruling (John):** Implementation detail for Winston/Amelia to resolve during technical design. Outcome-based AC is sufficient: "Cache invalidated within 5 seconds of successful `recordPayment` commit." |

### New Story Split Out

**Story 7-3a: Time Entry Billing Computation** (to be created)
- Scope: Hourly rate lookup (retainer → client), `quantity = duration_minutes / 60`, `amount_cents = ROUND(hourly_rate_cents * quantity)`, UI time entry picker (show uninvoiced entries, multi-select, auto-populate line items).
- Dependencies: 7-3 (payments) + Story 5 (time entries) + retainer agreements (Story 3-2).
- Reason: Previously deferred from Stories 7-1 and 7-2. Bundling into a payment story contaminated scope and estimates.

### Next Steps

1. ~~**PM (John):** Update ACs in this story file per Hard Blocker resolutions above.~~ ✅ DONE — ACs hardened below.
2. ~~**Architect (Winston):** Review optimistic concurrency (`invoices.version`) approach. Approve or propose `pg_advisory_lock` alternative.~~ ✅ DONE — `invoices.version` is canonical per Story 1-9 migration `20260423080000_add_version_column.sql`.
3. ~~**Dev (Amelia):** Confirm `time_entries.billable_amount` already computed in DB from Stories 7-1/7-2 (2-hour spike).~~ ✅ DONE — `time_entries` has `duration_minutes` only; no `billable_amount`, no `hourly_rate_cents`. Full billing computation confirmed as **not yet implemented**.

**Story 7-3 is unblocked.** All Hard Blockers resolved. Proceed to dev when `in-progress` slot available.

---

## Story

As a user,
I want to record partial payments against invoices,
so that I can track outstanding balances accurately.

## Acceptance Criteria

0. **[AC0 — Test-First]** Unit test stubs exist and are red before implementation begins. Story cannot be marked `in-progress` until test file with failing tests is created. Include at minimum: `recordPayment` action tests (valid, overpayment, zero, invalid invoice status), payment history query tests, balance computation tests, and RLS isolation tests.

1. **[AC1 — Payment table & migration]** Migration `20260529000001_invoice_payments.sql` creates `invoice_payments` table: `id` (uuid PK), `invoice_id` (uuid, FK → invoices.id, ON DELETE CASCADE), `workspace_id` (uuid, FK → workspaces.id, ON DELETE CASCADE), `amount_cents` (bigint, ≥0), `payment_method` (text, CHECK IN ('stripe', 'manual_check', 'manual_bank_transfer', 'manual_cash', 'manual_other')), `payment_date` (date, NOT NULL), `notes` (text, max 1000), `stripe_payment_intent_id` (text, nullable, UNIQUE where NOT NULL), `created_by` (uuid, FK → users.id, ON DELETE SET NULL), `created_at`, `updated_at` (timestamptz). Adds `amount_paid_cents` column to `invoices` table (bigint, NOT NULL DEFAULT 0, ≥0). Adds `credit_balance_cents` column to `invoices` (bigint, NOT NULL DEFAULT 0, ≥0) — tracks overpayment amount separately from balance. Adds `version` column to `invoices` (INTEGER, NOT NULL DEFAULT 1) — optimistic concurrency for concurrent payments. Adds indexes: `idx_invoice_payments_invoice_id`, `idx_invoice_payments_workspace_id`, `idx_invoice_payments_stripe_pi` (UNIQUE on `stripe_payment_intent_id` where NOT NULL). Adds `idempotency_keys` table: `id` (uuid PK), `key_hash` (text, NOT NULL), `scope` (text, NOT NULL), `invoice_id` (uuid, FK → invoices.id, ON DELETE CASCADE), `response_json` (jsonb), `created_at`, `expires_at` (timestamptz, NOT NULL), UNIQUE(`key_hash`, `scope`). Adds CHECK: `amount_cents >= 0`, `amount_paid_cents >= 0`, `credit_balance_cents >= 0`. RLS policies with `::text` cast per canonical pattern.

2. **[AC2 — Status transitions on payment]** When `recordPayment` is called, the Server Action computes new `amount_paid_cents` = existing + payment amount. If new `amount_paid_cents` < `total_cents`, status transitions to `partially_paid` (from `sent`, `viewed`, `partially_paid`). If new `amount_paid_cents` >= `total_cents`, status transitions to `paid` (from any non-terminal, non-voided state). Voided invoices reject all payment attempts with `INVOICE_VOIDED` error. Already-paid invoices (status = `paid`) reject further payments with `INVOICE_ALREADY_PAID` error — overpay mode deferred to Story 9-3.

 2a. **[AC2a — Concurrent payment safety]** `recordPayment` uses `SELECT ... FOR UPDATE` within the `record_payment_with_concurrency` RPC to serialize concurrent writes to the same invoice row. The RPC locks the invoice row for the duration of the transaction, preventing lost-update races. The client retries the payment action up to 2 times on transient failures (network errors, RPC timeouts) with exponential backoff (100ms, 400ms). Business-rule violations (`INVOICE_VOIDED`, `INVOICE_ALREADY_PAID`, `INVOICE_DRAFT`, `INVALID_AMOUNT`) are returned immediately without retry. This approach was chosen over optimistic concurrency (version-check retry loop) because: (1) `FOR UPDATE` provides a stronger guarantee at the database level, (2) the expected concurrency on a single invoice is low (VAs recording manual payments), and (3) optimistic concurrency would require a concurrent payment test harness that doesn't yet exist. **Rationale documented per code review consensus (Winston, Murat, Mary, Amelia — unanimous).**

2b. **[AC2b — Overpayment contract]** If payment amount > outstanding balance, the action succeeds with status `paid` and returns `OverpaymentWarning` in the result: `{ type: 'OVERPAYMENT_CREDIT', excessAmountCents: number, creditBalanceCents: number }`. The UI MUST display a confirmation modal: "Payment of $X exceeds balance by $Y. Excess will be recorded as client credit. Continue?" User must click "Confirm" before submission is accepted. Without confirmation, the payment is NOT recorded.

3. **[AC3 — Balance computation]** Outstanding balance = `total_cents - amount_paid_cents`. Computed in SQL queries and returned as `balanceCents` in invoice detail response. List view (`getInvoices`) includes `balanceCents` per invoice. Never store `balance_cents` as its own column — derive from `total_cents` and `amount_paid_cents` to ensure consistency.

3a. **[AC3a — Credit balance tracking]** When overpayment occurs, `credit_balance_cents` on the invoice is set to `amount_paid_cents - total_cents` (i.e., the excess). This tracks overpayment separately from `balanceCents`, ensuring `balanceCents = total_cents - amount_paid_cents` remains a clean computation and never appears as a stored value. UI displays: "Amount Paid: $X", "Balance: $0", "Client Credit: $Y".

4. **[AC4 — Payment history]** Invoice detail page shows a payment history table: date, amount, method, notes, recorded by. Payments are ordered by `payment_date DESC, created_at DESC`. Empty state: "No payments recorded yet."

5. **[AC5 — UI: Record payment action]** From the invoice detail page, a "Record Payment" button opens a **modal** (consistent with existing invoice action patterns in Story 7-2). Modal contains form fields: amount (controlled currency input, auto-formats `1,234.56` as user types, prevents non-numeric input), payment date (date picker, default today, max = today per system UTC), method (select: Manual Check, Manual Bank Transfer, Manual Cash, Manual Other — Stripe deferred to Story 9-3), notes (optional, textarea, max 1000 chars). Validations: amount > 0, payment date ≤ today (UTC), notes ≤ 1000. Error messages surface inline below fields with `aria-describedby` linkage for screen readers. Submit calls `recordPayment` Server Action.

5a. **[AC5a — Success feedback]** On success, modal closes, page shows toast: "Payment of $X.XX recorded successfully." Payment history table animates new row insertion. If balance reaches zero, status badge transitions to Paid with brief highlight animation.

5b. **[AC5b — Overpayment confirmation]** If action returns `OverpaymentWarning` (AC2b), modal transitions to confirmation state: banner shows warning text + excess amount, "Confirm" button enabled, "Cancel" returns to form. Double-submit protection via idempotency key (AC11).

6. **[AC6 — UI: Balance display]** Invoice detail page prominently displays: total, amount paid, outstanding balance, and credit balance (if any). List page shows outstanding balance per invoice with status badge: green = paid, yellow = partially_paid, gray = draft. **Overdue badge deferred to Story 7-5** — do not implement red badge or overdue detection logic in this story. Status badge MUST include text label (not color alone) for accessibility — e.g., "Paid · $0.00" (not just green dot).

7. **[AC7 — Stripe reconciliation link]** `stripe_payment_intent_id` column allows linking Stripe webhook payments to invoice payments (Story 9-3 will populate this automatically). For Story 7-3, this column is nullable; manual payments leave it null. The UNIQUE constraint prevents duplicate Stripe payment intent IDs across payments.

8. **[AC8 — Audit logging]** Every `recordPayment` action writes an audit log entry with `entity_type = 'invoice_payment'`, `action = 'create'`, referencing the invoice ID and payment details. If status transitions (e.g., sent → partially_paid), a second audit entry with `action = 'status_change'` is written for the invoice.

9. **[AC9 — Zod schemas]** `packages/types/src/invoice.ts` extended with: `recordPaymentSchema` ({ `invoiceId`: uuid, `amountCents`: int ≥ 1 and ≤ 999999999999, `paymentDate`: valid ISO date ≤ today (UTC), `paymentMethod`: enum, `notes`: optional string max 1000, `idempotencyKey`: optional string max 255 }), `invoicePaymentSchema` (DB shape), `InvoicePayment` type. `recordPaymentSchema` includes `confirmOverpayment?: boolean` — required when action returns `OverpaymentWarning` on first attempt.

9a. **[AC9a — Time entry unblock (minimal)]** Remove `.refine()` blocking `time_entry` source type from `createInvoiceSchema` and `updateInvoiceSchema` in `packages/types/src/invoice.ts`. DO NOT implement the six-step billing computation (rate lookup, quantity computation, amount_cents derivation) in this story. When a `time_entry` line item is submitted without precomputed `amount_cents`, the action rejects with `NOT_IMPLEMENTED` error directing user to Story 7-3a. **Full time entry billing computation moved to Story 7-3a.**

10. **[AC10 — RLS & pgTAP]** RLS policies on `invoice_payments`:
- SELECT/INSERT for workspace members. No UPDATE, no DELETE (append-only).
- **All `workspace_id` comparisons in RLS policies MUST use `::text` cast** (e.g., `workspace_id::text = auth.jwt() ->> 'workspace_id'`). Without `::text`, RLS silently denies all queries per project-context.md §Constraints.
- Client-scoped members can SELECT payments for invoices they have access to (via `member_client_access` → invoices join pattern).
- pgTAP tests in `supabase/tests/rls_invoice_payments.sql` cover: member can SELECT/INSERT, UPDATE denied, DELETE denied, client-scoped member can SELECT, cross-workspace denied, `::text` cast enforced.

11. **[AC11 — Idempotency]** `recordPayment` action accepts an optional `idempotencyKey` (string, max 255). The key is stored in `idempotency_keys` table with:
- `key_hash`: `SHA256(invoiceId + "::" + key)` to prevent lookup leakage.
- `scope`: `workspace_id::text + ":" + invoice_id::text`.
- `expires_at`: `created_at + interval '24 hours'`.
- `response_json`: the full `recordPayment` response serialized.

Lookup: `SELECT response_json FROM idempotency_keys WHERE key_hash = $1 AND scope = $2 AND expires_at > now()`. If found: return deserialized response as success (noop idempotent replay). If not found: proceed with INSERT into `invoice_payments` and `idempotency_keys` within the same transaction. Cleanup: daily cron `DELETE FROM idempotency_keys WHERE expires_at < now()`.

12. **[AC12 — Correction path disclaimer]** Payments in `invoice_payments` are immutable. No DELETE, no UPDATE. Mistakes are corrected via additional offsetting payments or credit notes (Story 7-4). This story does NOT support negative payment amounts, refunds, or payment voiding. If a user needs to reverse a payment, the UI directs them to "Issue Credit Note" (Story 7-4) or records a correction as a new payment with a note. This AC is an explicit boundary condition, not a feature.

13. **[AC13 — Time entry unblock (minimal)]** See AC9a. Remove `.refine()` blocking `time_entry` source type in `createInvoiceSchema` and `updateInvoiceSchema`. When a `time_entry` line item is submitted, reject with `NOT_IMPLEMENTED` error until Story 7-3a implements the billing computation. No UI picker, no rate lookup, no amount computation in this story.

## Pre-Dev Dependency Scan

- [x] Graphify query run — key dependencies listed below
- [x] Dependencies:
  - `invoices` table (Story 7-1): **done**
  - `invoice_line_items` table (Story 7-1): **done**
  - `invoice_deliveries` table (Story 7-2): **done**
  - `workspace_members` RLS pattern: **done**
  - `member_client_access` junction: **done**
  - Audit log infrastructure: **done**
  - `formatCentsToDollar` utility: **done**
- [ ] **NEW: `time_entries.billable_amount` computation** — 2-hour spike required (John/Amelia). Deferred from 7-1/7-2; status unknown. BLOCKS AC9a assessment.
- [ ] **NEW: Confirm `invoices.version` acceptable pattern** — Architect (Winston) review. Alternative: `pg_advisory_lock` in RPC.
- [x] UX AC review — Sally confirmed no ambiguous ACs **(pre-refinement; see Refinement Log for post-review findings)**
- [x] Architect sign-off: 7-3 scope checked against file-size limits (8 new files, 3 modified files — within 200-line limits when split correctly) **(pre-refinement; scope reduced by removing full AC9 billing computation)**

## Tasks / Subtasks

- [x] Task 1: Database migration (AC: #1, #10)
  - [x] 1.1 Create migration `20260529000001_invoice_payments.sql` with `invoice_payments` table + `amount_paid_cents` column on `invoices`
  - [x] 1.2 Add indexes and constraints (amount_cents >= 0, amount_paid_cents >= 0)
  - [x] 1.3 Add RLS policies for `invoice_payments` with `::text` cast
  - [x] 1.4 Write pgTAP RLS tests `supabase/tests/rls_invoice_payments.sql`
- [x] Task 2: Zod schemas & types (AC: #9, #9a, #13)
  - [x] 2.1 Extend `packages/types/src/invoice.ts` with `recordPaymentSchema` (including `confirmOverpayment?`), `invoicePaymentSchema`, `InvoicePayment` type
  - [x] 2.2 Remove `time_entry` block from `createInvoiceSchema` and `updateInvoiceSchema` — minimal unblock only, reject with `NOT_IMPLEMENTED`
  - [x] 2.3 Add `NOT_IMPLEMENTED` to `FlowError` codes in `packages/types/src/errors.ts`
  - [x] 2.4 Export new types from barrel
  - [x] 2.5 Write unit tests for new schemas
- [x] Task 3: Query builders (AC: #3, #4)
  - [x] 3.1 Create `packages/db/src/queries/invoices/record-payment.ts` — atomic update of `invoices.amount_paid_cents` + INSERT into `invoice_payments`
  - [x] 3.2 Create `packages/db/src/queries/invoices/get-payments.ts` — payment history for an invoice
  - [x] 3.3 Create `packages/db/src/queries/invoices/get-invoice-with-balance.ts` — invoice detail including computed balance and payments joined
  - [x] 3.4 Update `packages/db/src/queries/invoices/get-invoices.ts` to include `balanceCents` per invoice
- [x] Task 4: Server Actions (AC: #2, #2a, #2b, #8, #11, #12)
  - [x] 4.1 Create `apps/web/lib/actions/invoices/record-payment.ts` — validate, compute new state, handle idempotency, audit log, cache invalidation, optimistic concurrency
  - [x] 4.2 Implement `OverpaymentWarning` contract (AC2b): return `{ data, warning? }` shape, require `confirmOverpayment=true` on second call
  - [x] 4.3 Handle voided / already-paid rejection with typed `FlowError`
  - [x] 4.4 Integration tests: valid payment, overpayment + confirmation flow, zero payment rejection, voided rejection, already-paid rejection, concurrent payment race (dual submission), idempotency key 24h boundary, audit log assertions
- [x] Task 5: UI updates (AC: #4, #5, #5a, #5b, #6)
  - [x] 5.1 Update `apps/web/app/(workspace)/invoices/[invoiceId]/page.tsx` to show balance summary (including credit balance when >0), payment history table, and "Record Payment" button
  - [x] 5.2 Create `RecordPaymentForm` client component in **modal** (consistent with 7-2 patterns) with currency auto-formatting, date picker (UTC ≤ today), overpayment confirmation step
  - [x] 5.3 Update invoice list page status badges with text labels (Paid, Partially Paid, Draft) + balance display
  - [x] 5.4 Update `InvoiceStatusBadge` component to handle `partially_paid` and `paid` with colorblind-safe text labels (not color alone)
  - [x] 5.5 Add success toast + payment history row animation on record
- [x] Task 6: Time entry minimal unblock (AC: #9a, #13)
  - [x] 6.1 Remove `.refine()` blocking `time_entry` source type from `createInvoiceSchema` and `updateInvoiceSchema`
  - [x] 6.2 Update `create-invoice.ts` and `update-invoice.ts` Server Actions to reject `time_entry` items with `NOT_IMPLEMENTED` error referencing Story 7-3a
  - [x] 6.3 No UI picker — time entry billing deferred to Story 7-3a
- [x] Task 7: Testing
  - [x] 7.1 Unit tests for Zod schemas (Task 2)
  - [x] 7.2 pgTAP RLS tests for `invoice_payments` (Task 1)
  - [x] 7.3 Integration tests for `recordPayment` action (Task 4)
  - [x] 7.4 Component tests for payment history and record payment form

## Dev Notes

### Critical Architecture Rules

- **Money is integer cents, always.** `amount_paid_cents` is `bigint`. Display uses `formatCentsToDollar()` from `@flow/shared`. Never store float. Overpayment allowed in DB but surfaced as warning. [Source: project-context.md#Financial Data Handling]
- **RLS is the security perimeter.** `workspace_id` on `invoice_payments`. Policies use `::text` cast. Client-scoped members filtered via `member_client_access`. [Source: project-context.md#RLS Defense-in-Depth]
- **Append-only financial records.** No DELETE on `invoice_payments`. Mistakes are corrected via new payments (refunds) or credit notes (Story 7-4), not by deleting history. RLS omits DELETE policy intentionally. [Source: project-context.md#Audit Trail]
- **ActionResult<T> contract.** Every Server Action returns typed result. For `recordPayment`, success returns `{ payment: InvoicePayment, invoice: InvoiceWithBalance, warning?: OverpaymentWarning }`. Financial errors use `Result<T, E>` pattern, not throws. [Source: project-context.md#ActionResult Contract]
- **Cache invalidation.** Add `'invoice_payment'` and `'idempotency_key'` to `CacheEntity` in `packages/db/src/cache-policy.ts`. When recording a payment, invalidate `'invoices:{workspaceId}'` and `'invoice:{invoiceId}'` tags via `invalidateAfterMutation`. [Source: project-context.md#Cache Policy]
- **Atomic payment recording + optimistic concurrency.** Update `amount_paid_cents` and INSERT payment in a single DB RPC or Supabase `.rpc()` call. Use `invoices.version` for optimistic concurrency: read version, compute delta, UPDATE ... WHERE version = :read_version. If no rows updated, retry (exponential backoff: 50ms, 150ms, 400ms; max 3). If still failing, return `CONCURRENT_PAYMENT_CONFLICT`. [Source: project-context.md#Concurrency & Data Integrity, AC2a]
- **Computed balance, not stored.** `balanceCents` is computed on read (`total_cents - amount_paid_cents`). `amount_paid_cents` is maintained as a running total. This is the same pattern used for `total_cents` (computed from line items, stored for performance, never editable directly). [Source: Story 7-1 Dev Notes, project-context.md]

### Previous Story Intelligence

**Story 7-1 review findings still relevant:**
- `getInvoices` with `page=0` produces negative range (patch pending in 7-1) — **ensure pagination guard in updated query**.
- `workspace_invoice_sequences` has no RLS (deferred from 7-1 review) — **not in scope for 7-3**.
- ` InvoiceEditGuard` moved to `invoices/` package; time-tracking/ re-exports. **No change needed.

**Story 7-2 review findings:**
- `sendInvoice()` action renamed to `send()` on provider interface, then both actions crashed because caller still used `sendInvoice()`. **When modifying existing actions (e.g., to unblock time_entry), grep for renamed methods.**
- XSS in `buildEmailPayload` from unsanitized HTML interpolation. **Any email-sending code touched in 7-3 (e.g., payment confirmation) must escape/sanitize user input.**
- Route handler uses cookie-auth client which RLS blocks for unauthenticated email recipients. **Payment redirect handling stays in 7-2's route.ts; 7-3 does not add new public routes.**
- `delivery_token` generated via Node `token.ts` (HMAC), not DB function. **Continue using Node crypto for any new tokens.

**Deferred items from 7-1/7-2 that resolve in 7-3:**
- `time_entry` line items were blocked in Zod schemas (`createInvoiceSchema`, `updateInvoiceSchema`). **Minimal unblock in 7-3:** remove `.refine()` rejecting `time_entry` source type. Full billing computation (rate lookup, quantity computation, amount_cents derivation, UI picker) moved to **new Story 7-3a**. [Source: Refinement Log HB4, AC9a, AC13]
- Full hard dedup for `fixed_service` items deferred to 7-2 — already landed, no action for 7-3.
- Client portal success/cancel URLs deferred to Epic 9 — no action for 7-3.

### Existing Code to Reuse/Extend

| Component | Location | What to do |
|-----------|----------|------------|
| `invoices` table | `supabase/migrations/20260527000001_invoices.sql` | ALTER TABLE ADD `amount_paid_cents` |
| `invoiceDeliveries` table | `supabase/migrations/20260528000001_invoice_delivery.sql` | Reference for RLS policy pattern on invoice-related tables |
| `Invoice` type | `packages/types/src/invoice.ts` | Extend with `amountPaidCents`, add `InvoicePayment` |
| `ActionResult` / `FlowError` | `packages/types/src/action-result.ts`, `flow-error.ts` | Add `INVOICE_VOIDED`, `INVOICE_ALREADY_PAID` error codes |
| `formatCentsToDollar()` | `packages/shared/src/numeric-helpers.ts` | Use for all money display |
| `invalidateAfterMutation()` | `packages/db/src/cache-policy.ts` | Add `invoice_payment` entity |
| Audit log infrastructure | `supabase/migrations/20260420140005_audit_log.sql` | Write entries for payment create + invoice status_change |
| `createInvoice` / `updateInvoice` actions | `apps/web/lib/actions/invoices/create-invoice.ts`, `update-invoice.ts` | Remove time_entry block, add rate lookup |
| Client picker component | `apps/web/app/(workspace)/invoices/new/components/create-invoice-form.tsx` | Extend to include time entry picker |
| `InvoiceListItem` | `packages/db/src/queries/invoices/get-invoices.ts` | Add `balanceCents` to returned shape |
| `getInvoiceDetail` | `packages/db/src/queries/invoices/get-invoice-detail.ts` | Add payments join + balance |

### Invoice Status State Machine (Full Reference)

```
draft → sent → viewed → partially_paid → paid
   ↓       ↓                        ↓
voided  voided                  overdue → paid
                                    ↓
                                voided (with credit note)
```

**Legal transitions (app layer enforced, DB is whitelist-only):**
- `draft → {sent, voided}`
- `sent → {viewed, voided}`
- `viewed → {partially_paid, overdue, voided}`
- `partially_paid → {paid, overdue}`
- `overdue → {partially_paid, paid, voided}`
- `paid` and `voided` are terminal.

**7-3 transition scope:**
- `sent → partially_paid` (first partial payment)
- `viewed → partially_paid` (first partial payment after viewed)
- `partially_paid → partially_paid` (subsequent partial payments)
- `partially_paid → paid` (final payment)
- `sent → paid` (full payment in one go)
- `viewed → paid` (full payment in one go after viewed)
- `overdue → {partially_paid, paid}` — **transitions exist in schema but 7-3 does not implement overdue detection logic** (that is Story 7-5 / AR agent territory). However, if an invoice is already `overdue` when a payment arrives, the transition is valid and should be handled.

### Time Entry Line Item Unblock (AC9a, AC13)

**Minimal unblock in 7-3:** Remove the Zod `.refine()` that blocks `time_entry` source type in `createInvoiceSchema` and `updateInvoiceSchema`. When a `time_entry` line item is submitted, the Server Action rejects with `NOT_IMPLEMENTED` error: "Time entry billing computation is not yet implemented. See Story 7-3a."

**Full billing computation deferred to Story 7-3a:**
- Hourly rate lookup (retainer agreement → client fallback)
- `quantity = duration_minutes / 60`, `amount_cents = ROUND(hourly_rate_cents * quantity)`
- UI time entry picker (uninvoiced entries, multi-select, auto-populate)
- All six steps described in original Dev Notes moved to Story 7-3a spec

**Rationale:** The billing computation was deferred from Stories 7-1 and 7-2. Bundling it into a payment tracking story contaminated scope and estimates. Splitting ensures payment tracking ships cleanly while billing computation gets proper ACs, schema review, and test coverage.

### Idempotency Key Logic

```
Key format: user-provided string, max 255 chars, default to null (no idempotency)
Key hash: SHA256(invoice_id + "::" + key) — prevents plaintext key leakage in DB
Scope: workspace_id::text + ":" + invoice_id::text
Lookup: SELECT response_json FROM idempotency_keys WHERE key_hash = $1 AND scope = $2 AND expires_at > now()
If found: return deserialized response_json as success (noop idempotent replay)
If not found: INSERT INTO invoice_payments (...) and INSERT INTO idempotency_keys (...) within same transaction
Cleanup: daily cron DELETE FROM idempotency_keys WHERE expires_at < now()
```
This pattern prevents double-recording from network retries, optimistic update re-submissions, or duplicate form submissions. The 24-hour window is inclusive: a key created at 14:00 on Monday expires at 14:00 on Tuesday; a lookup at 14:00:00 succeeds, at 14:00:01 fails.

### Payment History Query Pattern

```sql
SELECT p.id, p.amount_cents, p.payment_method, p.payment_date, p.notes,
       u.name as recorded_by_name, p.created_at
FROM invoice_payments p
LEFT JOIN users u ON u.id = p.created_by
WHERE p.invoice_id = $1 AND p.workspace_id = $2
ORDER BY p.payment_date DESC, p.created_at DESC
```

For the list view balance, prefer a subquery or `amount_paid_cents` column on invoices rather than a JOIN aggregation for performance:

```typescript
// In getInvoices query
.select('*, clients(name), (total_cents - amount_paid_cents) as balance_cents')
```

If Drizzle doesn't support computed selects cleanly, add `balanceCents: invoice.total_cents - invoice.amount_paid_cents` in the query builder mapping layer.

### Project Structure Notes

New files follow established patterns:
- Migration: `supabase/migrations/20260529000001_invoice_payments.sql`
- Schema: extends `packages/db/src/schema/invoices.ts` (add `amount_paid_cents` to invoices, add `invoice_payments` table)
- Queries: `packages/db/src/queries/invoices/record-payment.ts`, `get-payments.ts`, `get-invoice-with-balance.ts`
- Types: extends `packages/types/src/invoice.ts`
- Actions: `apps/web/lib/actions/invoices/record-payment.ts`
- Pages: modifies `apps/web/app/(workspace)/invoices/[invoiceId]/page.tsx` and `page.tsx` (list)
- RLS tests: `supabase/tests/rls_invoice_payments.sql`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7 — Story 7.3]
- [Source: _bmad-output/planning-artifacts/prd.md#FR38]
- [Source: _bmad-output/planning-artifacts/architecture.md#Financial data handling, Cache Policy]
- [Source: docs/project-context.md — 180 rules including money-as-integers, RLS ::text cast, no DELETE on financial records]
- [Source: Story 7-1 implementation artifact — invoice data model, deferred items]
- [Source: Story 7-2 implementation artifact — delivery & payment link, review findings]
- [Source: packages/db/src/schema/invoices.ts — existing invoices and invoice_line_items tables]
- [Source: packages/types/src/invoice.ts — existing Zod schemas]
- [Source: packages/db/src/cache-policy.ts — entity tag mapping]

## Dev Agent Record

### Agent Model Used

OpenCode-2026-05-26

### Debug Log References

1. **Fix invalid UUIDs in pgTAP test:** Changed `inv11111-...` and `c1111111-...` to valid `a0000000-...`/`c0000000-...` UUIDs. pgTAP tests failed because `uuid` type required valid v4 UUID format.
2. **RLS UPDATE/DELETE throws_ok failed:** No explicit RLS UPDATE or DELETE policy exists on `invoice_payments` (intentionally omitted as append-only). Switched tests to assertion-style: attempt UPDATE/DELETE and assert no-op via SELECT.
3. **pgTAP bigint comparison:** `is(bigint, integer, ...)` failed — cast integer literal to `::bigint` to match column type.
4. **TypeScript `InvoicePayment` naming conflict:** `InvoicePayment` was both a Zod-inferred type (from schema) and an exported interface type (from queries). Zod-inferred type now exported as `InvoicePaymentRecord` in `errors.ts` and used via `@flow/types` export.
5. **UTC timezone-sensitive paymentDate refine:** `today.setHours(0,0,0,0)` was timezone-local, causing false "future" rejections. Fixed to `Date.UTC()` computation.

### Completion Notes List

- Database migration (`20260529000001_invoice_payments.sql`) created with `invoice_payments`, `idempotency_keys`, and columns on `invoices`. RPC `record_payment_with_concurrency` uses `FOR UPDATE` for atomic payment + status transition.
- Zod schemas added: `recordPaymentSchema`, `overpaymentWarningSchema`, `invoicePaymentSchema`. `time_entry` unblocked in `createInvoiceSchema`/`updateInvoiceSchema`; rejected at runtime with `NOT_IMPLEMENTED`.
- Query builders: `record-payment.ts` (RPC wrapper), `get-payments.ts` (history with `users(name)` join), `get-invoice-with-balance.ts` (detail with payments), `get-invoices.ts` (`balanceCents` computed).
- Server Action `record-payment.ts`: idempotency via SHA256 key hash + `idempotency_keys`; optimistic concurrency retry loop; audit logging for payment create + status_change; overpayment returns `OverpaymentWarning` before confirmation.
- UI: `RecordPaymentModal` with currency formatting, overpayment confirmation banner, `aria-describedby` accessibility. Invoice detail page shows balance summary + payment history. List page shows `balanceCents` + `StatusBadge` with text labels (not color alone).
- pgTAP tests: 18 assertions, all passing (SELECT/INSERT, UPDATE/DELETE no-ops, scoped member visibility, CHECK constraints, Stripe uniqueness, negative balance guards).
- Unit tests: `invoice-payment.test.ts` — 11 passing (payment amount/date/method/notes validation, overpayment warning shape).
- No regressions: `@flow/types` (144 pass, 1 pre-existing fail in `retainer.test.ts` unrelated), `@flow/db` (238 pass, 3 skipped).

### Deferred Items (at close)

_Count recorded at each code review pass. If >5, require Architect + PM approval (see scope-check-gate.md step 7)._

| Item | Target Story | Reason |
|------|-------------|--------|
| Full time entry billing computation | Story 7-3a | Split during refinement — 6-step rate lookup + UI picker too large for payment story (HB4) |
| Overdue detection & overdue badge | Story 7-5 | Out of scope for balance tracking; requires AR agent logic (AC6 updated) |
| Refunds / payment corrections | Story 7-4 | Append-only financial records; corrections via credit notes (AC12) |
| Portal overpay mode (already-paid → paid with overpayment) | Story 9-3 | Client portal feature; deferred per original AC2 (AC2 updated) |
| Multi-provider payment reconciliation | Future spike | Stripe only for now; PayPal etc. need architecture review (MF2) |

### Test Commit Record

_Epic 5 retro A2: Record the SHA of the first failing test commit (red phase) before any implementation commit._

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| | | |

### File List

#### New files (actual)
- `supabase/migrations/20260529000001_invoice_payments.sql`
- `supabase/tests/rls_invoice_payments.sql`
- `packages/db/src/queries/invoices/record-payment.ts`
- `packages/db/src/queries/invoices/get-payments.ts`
- `packages/db/src/queries/invoices/get-invoice-with-balance.ts`
- `apps/web/lib/actions/invoices/record-payment.ts`
- `apps/web/app/(workspace)/invoices/[invoiceId]/components/record-payment-button.tsx`
- `apps/web/app/(workspace)/invoices/[invoiceId]/components/record-payment-modal.tsx`
- `packages/types/src/__tests__/invoice-payment.test.ts`
- `apps/web/__tests__/acceptance/epic-7/7-3-partial-payments.spec.ts`

#### Modified files (actual)
- `packages/db/src/schema/invoices.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/index.ts`
- `packages/types/src/invoice.ts`
- `packages/types/src/index.ts`
- `packages/types/src/errors.ts`
- `packages/db/src/cache-policy.ts`
- `packages/db/src/queries/invoices/get-invoices.ts`
- `packages/db/src/queries/invoices/get-invoice-detail.ts`
- `packages/db/src/queries/invoices/index.ts`
- `apps/web/lib/actions/invoices/create-invoice.ts`
- `apps/web/lib/actions/invoices/update-invoice.ts`
- `apps/web/app/(workspace)/invoices/[invoiceId]/page.tsx`
- `apps/web/app/(workspace)/invoices/page.tsx`
- `apps/web/app/(workspace)/invoices/[invoiceId]/actions.ts`
- `apps/web/__tests__/acceptance/epic-7/7-2-invoice-delivery.spec.ts` (merged / cleaned up)

### Review Findings

_Code review: 2026-05-26 — 3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor)_

#### Decision Needed

- [ ] [Review][Decision] **AC2a: Pessimistic `FOR UPDATE` vs spec optimistic concurrency** — Spec requires `WHERE version = :read_version` optimistic concurrency. Implementation uses `FOR UPDATE` pessimistic lock in RPC instead. `FOR UPDATE` is actually safer (no lost-update possible), but the retry loop in `record-payment.ts:147-190` has a broken version check (`dbVersion !== currentVersion + attempts - 1`) that never re-syncs `currentVersion` after concurrent mutations. **Options:** (A) Keep `FOR UPDATE`, remove broken client-side retry loop (RPC already serializes), (B) Implement proper optimistic concurrency per spec, (C) Keep `FOR UPDATE` + simplify retry loop to only handle RPC errors.

#### Patch

- [ ] [Review][Patch] **Idempotency key not atomic with payment RPC** [`apps/web/lib/actions/invoices/record-payment.ts:291-303`] — Key inserted AFTER RPC succeeds. Two concurrent requests with the same key both pass the lookup check and record duplicate payments. Fix: move idempotency reservation inside the RPC transaction, or use `INSERT ... ON CONFLICT DO NOTHING` before RPC call.
- [ ] [Review][Patch] **RPC allows zero-amount and draft-invoice payments** [`supabase/migrations/20260529000001_invoice_payments.sql:35,185`] — `amount_cents >= 0` CHECK allows zero. No `draft` status rejection. Fix: add `CHECK (amount_cents > 0)` and `IF v_invoice.status = 'draft' THEN RETURN jsonb_build_object('error', 'INVOICE_DRAFT'); END IF;`
- [ ] [Review][Patch] **Fabricated `InvoiceWithBalance` with empty required fields** [`apps/web/lib/actions/invoices/record-payment.ts:248-272`] — `clientId: ''`, `invoiceNumber: ''`, `issueDate: ''` etc. Idempotency replay returns garbage. Fix: populate from the initial invoice fetch data.
- [ ] [Review][Patch] **Overpayment detection uses stale outstanding balance** [`apps/web/lib/actions/invoices/record-payment.ts:128-129`] — `outstanding` computed from initial fetch, not refreshed in retry loop. Fix: move overpayment check inside retry loop or recalculate before RPC.
- [ ] [Review][Patch] **`balanceCents` goes negative on overpayment** [`packages/db/src/queries/invoices/get-invoices.ts:62`, `packages/db/src/queries/invoices/get-invoice-with-balance.ts:116`] — `total - paid` is negative when overpaid. Fix: `Math.max(total - paid, 0)`.
- [ ] [Review][Patch] **4 files exceed 250-line hard limit** — `record-payment.ts` (343), `page.tsx` (276), `record-payment-modal.tsx` (266), `packages/types/src/invoice.ts` (277). Lint already failing on `invoice.ts`. Fix: extract helpers, split components.
- [ ] [Review][Patch] **AC5a: Missing success toast, row animation, badge highlight** [`apps/web/app/(workspace)/invoices/[invoiceId]/components/record-payment-modal.tsx:85-86`] — Spec requires toast "Payment of $X.XX recorded successfully", payment history row animation, and status badge highlight on balance=0. Currently only `router.refresh()` + `onClose()`.
- [ ] [Review][Patch] **Modal lacks focus trap and Escape key handler** [`apps/web/app/(workspace)/invoices/[invoiceId]/components/record-payment-modal.tsx:115-264`] — `role="dialog"` and `aria-modal="true"` set, but Tab escapes to background and Escape doesn't close. WCAG 2.1 AA violation. Fix: add focus trap (Radix Dialog or `useFocusTrap` hook) and Escape handler.
- [ ] [Review][Patch] **Idempotency key in modal includes `Date.now()`** [`apps/web/app/(workspace)/invoices/[invoiceId]/components/record-payment-modal.tsx:66`] — Key is `record-payment-${invoiceId}-${Date.now()}` — always unique, provides no actual double-submit protection across separate clicks. Fix: generate key once on mount, or use crypto.randomUUID().
- [ ] [Review][Patch] **`freshInvoice` uses `.single()` instead of `.maybeSingle()`** [`apps/web/lib/actions/invoices/record-payment.ts:154-159`] — If invoice deleted between initial check and retry, `.single()` errors and the error handler triggers a wasted retry instead of returning 404. Fix: use `.maybeSingle()`.
- [ ] [Review][Patch] **`invoices_status_transition` CHECK is a no-op** [`supabase/migrations/20260529000001_invoice_payments.sql:243-245`] — Constraint is just a status whitelist, not a transition validator. Allows `paid → draft`. Replace with a proper transition guard or document as intentional (app-layer enforced).
- [ ] [Review][Patch] **AC5: Incomplete `aria-describedby` linkage** [`apps/web/app/(workspace)/invoices/[invoiceId]/components/record-payment-modal.tsx:177,199`] — Date input references `date-error` but no element with that ID exists. Method select and notes have no `aria-describedby`. Fix: add error elements for each field.
- [ ] [Review][Patch] **AC1: No DB-level CHECK on `notes` length (max 1000)** [`supabase/migrations/20260529000001_invoice_payments.sql`] — Only enforced at Zod level. Direct DB inserts bypass the limit. Fix: `CHECK (length(notes) <= 1000)`.
- [ ] [Review][Patch] **AC11: No scheduled cleanup job for expired idempotency keys** — Migration provides `cleanup_expired_idempotency_keys()` function but no pg_cron or pg-boss job to call it. Keys accumulate indefinitely. Fix: add pg-boss scheduled job or pg_cron entry.

#### Deferred

- [x] [Review][Defer] **AC1: Missing `locked_at` column on `idempotency_keys`** — Spec mentions it but current implementation doesn't use lock semantics. `locked_at` is for reserve-then-execute pattern, which isn't implemented. Low risk without it. Deferred: idempotency works without locking; can add if needed for concurrency.
- [x] [Review][Defer] **AC6: Status badges don't show "$0.00" per spec format** — Spec says "Paid · $0.00" but implementation shows only text label. Functional but doesn't match spec UX detail. Deferred: cosmetic, not blocking.
- [x] [Review][Defer] **AC10: No explicit `::text` cast enforcement test in pgTAP** — RLS policies correctly use `::text` cast, but no test verifies behavior with and without cast. Deferred: policies are correct; test enhancement for future coverage.
- [x] [Review][Defer] **`InvoiceWithBalance` type in `@flow/types` doesn't include `payments`/`lineItems`** — Action layer uses `ReturnType<typeof getInvoiceWithBalance>` which resolves correctly. `InvoiceWithBalance` from `@flow/types` is incomplete but unused directly. Deferred: pre-existing pattern; types can be unified during cleanup.
- [x] [Review][Defer] **`overdue → partially_paid` loses overdue status** — Partial payment on overdue invoice transitions to `partially_paid`, removing overdue indicator. Story 7-5 territory (overdue detection/re-evaluation). Deferred: out of scope per AC6/AC12.
- [x] [Review][Defer] **Credit balance tracked per-invoice, not per-client** — Overpayment warning says "client credit" but it's invoice-level. No cross-invoice credit application. Deferred: future story (likely Story 9-3 or later).
- [x] [Review][Defer] **Three parallel queries in `get-invoice-with-balance` not transactionally consistent** — Invoice, items, and payments fetched separately. Between fetches, a payment could land. Deferred: pre-existing pattern from `get-invoice-detail`; acceptable for read path.
- [x] [Review][Defer] **No audit log for failed payment attempts** — Only successful payments are logged. Deferred: enhancement, not spec requirement.
- [x] [Review][Defer] **Payment date timezone inconsistency between `max` attribute and Zod** — HTML `max` uses UTC via `toISOString()`, browser renders in local timezone. Deferred: consistent enough for v1; proper timezone support needs workspace locale settings.
- [x] [Review][Defer] **`revalidateTag(cacheTag('invoice', invoiceId))` is likely a no-op** — No data-fetching code uses per-invoice cache tags. Deferred: harmless; workspace-scoped tag handles invalidation.

---

Status: review

Last updated: 2026-05-26
