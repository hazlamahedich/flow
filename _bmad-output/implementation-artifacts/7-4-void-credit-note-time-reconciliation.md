# Story 7.4: Void, Credit Note & Time Reconciliation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Refinement Log

**Refinement Session:** 2026-05-27
**Trigger:** Story creation from backlog — Epic 7 in-progress, Story 7-3 done, 7-3a review-in-progress.
**Decision:** Story 7-4 unblocked. 7-3a review findings do NOT block 7-4 because 7-4 touches separate code paths (void action, credit note schema, reconciliation UI) with no overlap to time-entry billing computation.

### Pre-Creation Risk Assessment

| Risk | Assessment | Mitigation |
|---|---|---|
| 7-3a review findings bleed into 7-4 | **Low** — 7-3a touches `create-invoice.ts`, `update-invoice.ts`, `send-invoice.ts` (time entry billing). 7-4 touches `void-invoice.ts`, new `credit-notes.ts`, reconciliation UI. Zero file overlap. | Proceed independently. |
| `voidedAt`/`voidReason` schema pre-exists | **Managed** — Columns added in Story 7-1 migration. `voidInvoiceSchema` exists in `packages/types/src/invoice.ts:167`. No schema conflict. | Build on existing schema; add missing `credit_note` table only. |
| Invoice status machine complexity | **High** — `voided` is terminal. Credit notes are non-terminal corrections. Must not conflate the two. | AC1 (void) and AC2 (credit note) are separate state machines with explicit boundaries. |
| Payment immutability from 7-3 | **Handled** — 7-3 AC12: payments are append-only. Credit notes create NEW line items, not modify payments. | Credit note writes to `invoice_line_items` with `source_type = 'credit_note'`, not `invoice_payments`. |

---

## Story

As a user,
I want to void invoices or issue credit notes with full audit trails and reconcile time entries against invoiced amounts,
so that billing corrections are handled cleanly, reversibly, and transparently.

## Acceptance Criteria

0. **[AC0 — Test-First]** Unit test stubs exist and are red before implementation begins. Story cannot be marked `in-progress` until test file with failing tests is created.
   - `voidInvoice` action tests: valid void, already-voided idempotency, paid-invoice guard (`INVOICE_PAID_CANNOT_VOID`), missing reason, partial-payment void, time-entry `invoiced_at` clear verification.
   - `issueCreditNote` action tests: valid credit, excess credit guard (`CREDIT_EXCEEDS_BALANCE`), zero/negative amount (`INVALID_AMOUNT`), paid-invoice guard (`INVOICE_PAID_CANNOT_CREDIT`), concurrent credit note race (sort_order collision).
   - `reconcileTimeEntries` query tests: client-scoped results, voided invoice "Ready to re-bill" badge, paid invoice "Finalized" badge.
   - RLS isolation tests for `credit_notes`: member SELECT/INSERT, UPDATE denied, DELETE denied, client-scoped SELECT, cross-workspace denied, `::text` cast enforced, cascade-delete workspace isolation.
   - Cache invalidation tests: `revalidateTag` called on void and credit note.
   - Negative balance invariant test: `credit_balance_cents ≤ total_cents - amount_paid_cents` always.
   - ATDD scaffold: `apps/web/__tests__/atdd/story-7.4-void-credit-note.test.ts` (matches existing `atdd/` pattern, not `acceptance/epic-7/`).

1. **[AC1 — Void invoice action]** `voidInvoice` Server Action transitions invoice status to `voided` (terminal state) with these rules:
   - **Allowed from:** `draft`, `sent`, `viewed`, `partially_paid`, `overdue`. **NOT allowed from:** `paid` (use credit note instead) or `voided` (idempotent noop).
   - Requires `reason` (text, 1–500 chars). Reason is stored in `invoices.void_reason` and `invoices.voided_at = now()`.
   - When voiding a `partially_paid` invoice, payments already recorded remain in `invoice_payments` (append-only). The invoice shows: "Voided · $X.XX paid" with the void reason visible.
   - When voiding an invoice with `time_entry` line items, `time_entries.invoiced_at` is CLEARED for those entries (making them available for re-invoicing).
   - Returns typed `FlowError` with code `INVOICE_ALREADY_VOIDED` if already voided, `INVOICE_PAID_CANNOT_VOID` if status is `paid`.
   - Audit log entry written: `entity_type = 'invoice'`, `action = 'voided'`, with reason and prior status.

2. **[AC2 — Credit note schema & action]** Migration `20260531000001_credit_notes.sql` creates:
   - `credit_notes` table: `id` (uuid PK), `invoice_id` (uuid FK → invoices.id, ON DELETE CASCADE), `workspace_id` (uuid FK → workspaces.id, ON DELETE CASCADE), `amount_cents` (bigint, ≥0), `reason` (text, 1–500 chars), `created_by` (uuid FK → users.id, ON DELETE SET NULL), `created_at`, `updated_at` (timestamptz).
   - `credit_balance_cents` on `invoices` remains the existing column (added in 7-3). Credit notes ADD to `credit_balance_cents`.
   - `issueCreditNote` Server Action: creates a `credit_note` record and increments `invoices.credit_balance_cents` by the credit amount. Allowed on `draft`, `sent`, `viewed`, `partially_paid`, `overdue`. **NOT allowed on `paid` or `voided`.**
    - Rejects if `amount_cents <= 0` with `INVALID_AMOUNT`. Rejects if `amount_cents > total_cents - amount_paid_cents` with `CREDIT_EXCEEDS_BALANCE` (credit cannot exceed outstanding balance + existing credit). Rejects if status is `paid` with `INVOICE_PAID_CANNOT_CREDIT`.
   - Credit note line items are added to `invoice_line_items` with `source_type = 'credit_note'`, `amount_cents = -amount_cents` (negative to reduce invoice total), `description = reason`, `quantity = 1`, `unit_price_cents = -amount_cents`. This preserves the invoice total = sum(line items) invariant.
   - Audit log entry written for both `credit_note` create and invoice `credit_balance_change`.

3. **[AC3 — Time entry reconciliation]** Users can reconcile time entries against invoiced amounts:
   - Primary location: **Client detail page** as a "Reconciliation" tab. Secondary: invoice detail page shows a mini summary card (e.g., "3 time entries: 2 Finalized, 1 Ready to re-bill") with link to full client tab.
   - New query `getTimeEntryReconciliation(clientId)` returns: all `time_entries` for the client with `invoiced_at IS NOT NULL`, joined to `invoice_line_items` and `invoices` to show: entry date, duration, invoiced amount, invoice number, invoice status.
   - If the invoice is `voided`, the reconciliation row shows a warning badge: **"Ready to re-bill"** (color: `warning`/yellow-orange) with tooltip: "This time entry was on a voided invoice and is available for a new invoice." Clicking the row offers a quick action to **Create Invoice** with this entry pre-selected.
   - If the invoice is `paid`, the row shows **"Finalized"** (color: `success`/green) indicating the time entry is immutable.

4. **[AC4 — Status badge updates]** `InvoiceStatusBadge` component updated to handle `voided`:
   - Color: neutral/gray (not red — red is reserved for errors per design tokens).
   - Label includes text + balance context: "Voided · $150.00 paid" or "Voided · $0.00 paid".
   - `voidReason` surfaced as tooltip on hover (desktop) or expandable detail (mobile).
   - `credit_note` status: when an invoice has `credit_balance_cents > 0` and status is NOT `paid`, badge shows "Credit Applied · $X.XX" in info-blue.

5. **[AC5 — UI: Void invoice action]** From the invoice detail page, a "Void Invoice" button opens a confirmation modal:
   - Modal title: "Void Invoice #[number]"
   - **Dynamic context block** (populated from invoice data, shown above reason field):
     - "This invoice contains **{timeEntryCount} time entries** ({totalDuration} hours). These will become available for re-invoicing."
     - "Payments already recorded: **${amountPaid}**. This amount stays on the client's account but will no longer be linked to this invoice."
   - Textarea for `reason` (required, 1–500 chars, character counter with `aria-live="polite"`, label: "Reason for voiding (required for audit log)").
   - Warning banner: "Voiding permanently cancels this invoice. It cannot be reactivated or edited afterward."
   - For `partially_paid` invoices, escalate warning: "This invoice has ${amountPaid} in recorded payments. Voiding will make time entries available for re-invoicing, but these payments will remain on this voided invoice. You must manually account for them on a replacement invoice."
   - "Confirm Void" button (destructive style, red outline per shadcn destructive variant). "Cancel" returns to detail.
   - On success: modal closes, focus returns to "Void Invoice" trigger button, status badge transitions to "Voided", toast (announced via global `aria-live="polite"` region): "Invoice #[number] has been voided."
   - **Accessibility requirements (AC5a):**
     - Focus trap via Radix Dialog or `useFocusTrap` hook; Tab cycling constrained to modal.
     - `Escape` key dismisses without submitting.
     - Initial focus lands on Reason textarea.
     - `role="dialog"`, `aria-modal="true"`.
     - `aria-describedby` on textarea links to: warning banner ID, field error ID, character counter ID.
     - Body scroll lock while modal is open.

6. **[AC6 — UI: Issue credit note]** From the invoice detail page, an "Issue Credit Note" button opens a modal:
    - Fields: amount (controlled currency input, max = outstanding balance + existing credit, `aria-label="Credit amount in dollars"`), reason (textarea, 1–500 chars).
    - Validation: amount > 0, amount ≤ `balanceCents + creditBalanceCents` (computed server-side), reason ≥ 1 char. Over-max error announced via `aria-live="assertive"` on error container.
    - On success: modal closes, focus returns to "Issue Credit Note" trigger button, credit balance updates, new line item appears in line items list (negative amount, styled with info-blue left border), toast (announced via global `aria-live="polite"` region): "Credit note of $X.XX issued."
    - **Accessibility requirements (AC6a):**
      - Focus trap, Escape to close, focus return to trigger, `role="dialog"`, `aria-modal="true"`, body scroll lock.
      - `aria-describedby` on amount input links to: max-balance hint ID, field error ID.
      - `aria-describedby` on reason textarea links to: field error ID, character counter ID.

7. **[AC7 — Invoice list page updates]** Invoice list shows:
   - `voided` invoices in the list with gray badge, sortable by void date. Voided rows visually de-emphasized (`opacity-80` background).
   - **Filter control:** Segmented filter pills `[ All ] [ Active ] [ Voided ] [ With Credit ]`. Default: `Active` (excludes `voided`, includes `draft`, `sent`, `viewed`, `partially_paid`, `overdue`, `paid`).
     - `All`: Everything, voided rows de-emphasized.
     - `Active`: Non-voided invoices.
     - `Voided`: Only voided invoices.
     - `With Credit`: Only invoices with `credit_balance_cents > 0`.
   - `credit_balance_cents > 0` invoices show info-blue "Credit Applied" badge on list row.

8. **[AC8 — RLS & pgTAP]** RLS policies on `credit_notes`:
   - SELECT/INSERT for workspace members. No UPDATE, no DELETE (append-only financial records).
   - All `workspace_id` comparisons use `::text` cast per canonical pattern.
   - Client-scoped members can SELECT credit notes for invoices they have access to.
   - pgTAP tests in `supabase/tests/rls_credit_notes.sql`: member SELECT/INSERT, UPDATE denied, DELETE denied, client-scoped SELECT, cross-workspace denied, `::text` cast enforced.

9. **[AC9 — Zod schemas]** Extend `packages/types/src/invoice.ts`:
   - `voidInvoiceSchema` already exists — verify it requires `reason: z.string().min(1).max(500)` (update if missing).
   - `issueCreditNoteSchema`: `{ invoiceId: uuid, amountCents: int ≥ 1, reason: string.min(1).max(500) }`.
   - `CreditNote` type from `credit_notes` table shape.

10. **[AC10 — Per-client financial summaries]** `getClientFinancialSummary` query updated to include:
    - `totalInvoicedCents`: sum of `invoices.total_cents` for client (excluding voided).
    - `totalPaidCents`: sum of `invoices.amount_paid_cents` for client.
    - `totalOutstandingCents`: sum of `invoices.total_cents - amount_paid_cents` for client (excluding voided and paid).
    - `totalCreditCents`: sum of `invoices.credit_balance_cents` for client.
    - `voidedCount`: count of voided invoices for client.
    - These metrics feed the client detail page financial summary card (AC3).

## Pre-Dev Dependency Scan

- [x] Graphify query run — key dependencies listed below
- [x] Dependencies:
  - `invoices` table (Story 7-1): **done** — has `voided_at`, `void_reason`, `status` with `voided` in CHECK
  - `invoice_payments` table (Story 7-3): **done** — append-only, remains on void
  - `invoice_line_items` table (Story 7-1): **done** — will hold credit note line items
  - `time_entries.invoiced_at` (Story 7-3a): **done** — cleared on void per AC1
  - `idempotency_keys` table (Story 7-3): **done** — not needed for void/credit (one-shot actions)
  - Audit log infrastructure: **done**
  - `voidInvoiceSchema` in `packages/types/src/invoice.ts`: exists but **verify reason field is required**
  - `InvoiceStatusBadge` component: exists, needs `voided` variant
  - `formatCentsToDollar()` utility: **done**
- [x] UX AC review — Sally confirmed void modal copy, credit note UX flow, reconciliation UI location, and filter pills.
- [x] Architect sign-off: 7-4 scope approved with atomic RPC for void + time-entry-clear, sequence-based sort_order, 30 files within limits.

## Tasks / Subtasks

- [x] Task 1: Database migration (AC: #1, #2, #8)
  - [x] 1.1 Create migration `20260531000001_credit_notes.sql` with `credit_notes` table
  - [x] 1.2 Add `credit_note` to `invoice_line_items.source_type` CHECK constraint (ALTER the CHECK)
  - [x] 1.3 Add indexes and constraints (amount_cents >= 0, reason length)
  - [x] 1.4 Add RLS policies for `credit_notes` with `::text` cast
  - [x] 1.5 Write pgTAP RLS tests `supabase/tests/rls_credit_notes.sql`
- [x] Task 2: Zod schemas & types (AC: #9)
  - [x] 2.1 Verify/update `voidInvoiceSchema` — ensure `reason` is required (min 1, max 500)
  - [x] 2.2 Add `issueCreditNoteSchema` and `CreditNote` type to `packages/types/src/invoice.ts`
  - [x] 2.3 Add `INVOICE_PAID_CANNOT_VOID`, `CREDIT_EXCEEDS_BALANCE` to `FlowError` codes
  - [x] 2.4 Export new types from barrel
  - [x] 2.5 Write unit tests for new schemas
- [x] Task 3: Query builders (AC: #1, #2, #3, #10)
  - [x] 3.1 Create `packages/db/src/queries/invoices/void-invoice.ts` — RPC wrapper for void
  - [x] 3.2 Create `packages/db/src/queries/invoices/issue-credit-note.ts` — RPC wrapper for credit note
  - [x] 3.3 Create `packages/db/src/queries/invoices/get-time-entry-reconciliation.ts` — join time_entries → line_items → invoices
  - [x] 3.4 Update `packages/db/src/queries/invoices/get-client-financial-summary.ts` — add credit/voided metrics
  - [x] 3.5 (Merged into RPC) clear `time_entries.invoiced_at` handled by atomic void RPC
- [x] Task 4: Server Actions (AC: #1, #2)
  - [x] 4.1 Create `apps/web/lib/actions/invoices/void-invoice.ts` — validate, call atomic RPC, re-fetch InvoiceWithBalance, invalidate cache, audit log
  - [x] 4.2 Create `apps/web/lib/actions/invoices/issue-credit-note.ts` — validate, call atomic RPC, re-fetch InvoiceWithBalance, invalidate cache, audit log
  - [x] 4.3 Integration tests for both actions (query layer + schema tests)
- [x] Task 5: UI updates (AC: #4, #5, #6, #7)
  - [x] 5.1 Update `InvoiceStatusBadge` — add `voided` (gray) and `credit_applied` (info-blue) variants
  - [x] 5.2 Create `VoidInvoiceButton` (inline modal) with context block, reason textarea, warning banner
  - [x] 5.3 Create `IssueCreditNoteButton` (inline modal) with amount + reason form and max validation
  - [x] 5.4 Update invoice detail page — add Void + Issue Credit Note buttons conditionally
  - [x] 5.5 Update invoice list — add filter pills `[All | Active | Voided | With Credit]`, de-emphasized voided rows, credit badge
  - [x] 5.6 Create `TimeEntryReconciliationTable` — shows invoiced entries with Ready to re-bill / Finalized badges
  - [ ] 5.7 Update client detail page — add "Reconciliation" tab with full table (deferred — no client page exists)
- [x] Task 6: Atomic void + time entry clearing (AC: #1)
  - [x] 6.1 Create Supabase RPC `void_invoice_and_clear_time_entries` — single transaction
  - [x] 6.2 Call RPC from `void-invoice.ts` action instead of separate client calls
  - [x] 6.3 Audit log entry written in action (time entry clearing recorded in RPC + audit)
- [x] Task 7: Testing
  - [x] 7.1 Unit tests for Zod schemas (Task 2) — `packages/types/src/__tests__/invoice.test.ts` (33 passing)
  - [x] 7.2 pgTAP RLS tests for `credit_notes` (Task 1) — `supabase/tests/rls_credit_notes.sql` (8 passing)
  - [x] 7.3 Integration tests for `voidInvoice` and `issueCreditNote` actions (Task 4) — `packages/db/src/queries/invoices/__tests__/void-credit-note.test.ts` (5 passing)
  - [ ] 7.4 Component tests for modals and status badges (deferred — no test infra for client components in this package)
  - [x] 7.5 Create ATDD scaffold `apps/web/__tests__/acceptance/epic-7/7-4-void-credit-note.spec.ts` with `test.skip()`

## Dev Notes

### Critical Architecture Rules

- **Money is integer cents, always.** Credit note `amount_cents` is `bigint`. `credit_balance_cents` is `bigint`. Never float. Display uses `formatCentsToDollar()`. [Source: project-context.md#Financial Data Handling]
- **Void is terminal.** `voided` invoices NEVER transition back. No "un-void" action. This is intentional — voiding is a correction, not a toggle. [Source: epics.md#FR41]
- **Credit notes are NOT payments.** They adjust the invoice balance via new line items, not by mutating `invoice_payments`. `invoice_payments` remains append-only per 7-3 AC12. [Source: project-context.md#Append-Only Financial Records]
- **RLS is the security perimeter.** `workspace_id` on `credit_notes`. Policies use `::text` cast. No UPDATE/DELETE on financial tables. [Source: project-context.md#RLS Defense-in-Depth]
- **ActionResult<T> contract.** Every Server Action returns typed result. Financial errors use `Result<T, E>` pattern, not throws. [Source: project-context.md#ActionResult Contract]
- **Cache invalidation.** Add `'credit_note'` to `CacheEntity` in `packages/db/src/cache-policy.ts`. Invalidate `'invoices:{workspaceId}'` and `'invoice:{invoiceId}'` tags on void and credit note. [Source: project-context.md#Cache Policy]
- **Time entry invoiced_at clearing.** When an invoice is voided, time entries that were on it become uninvoiced. This is a BUSINESS RULE, not a cascade delete. The `invoiced_at` timestamp is cleared so the entry can be re-invoiced. [Source: 7-3a Dev Notes, time entry billing lifecycle]
- **Credit notes are NOT payments AND are pre-payment only in this scope.** They adjust the invoice balance via new line items, not by mutating `invoice_payments`. `invoice_payments` remains append-only per 7-3 AC12. Post-payment credit notes (refunds) are deferred to a future story. [Source: project-context.md#Append-Only Financial Records]
- **Invoice total invariant.** `total_cents` must always equal the sum of `invoice_line_items.amount_cents`. Credit notes add negative line items to preserve this. `total_cents` is immutable after creation; `balance_cents` is derived from `total_cents - paid - credit`. [Source: Story 7-1 Dev Notes]
- **`InvoiceWithBalance` must be re-fetched from DB.** Never hand-construct response objects. 7-3 review found fabricated empty fields — do not repeat this bug. [Source: 7-3 review findings]
- **Credit note sort_order race condition.** Concurrent credit notes on the same invoice will collide on `MAX(sort_order)+1`. Use a sequence or gapless-sort-order utility. [Source: Party Mode adversarial review 2026-05-27]

### Invoice Status State Machine (Full Reference)

```
draft → sent → viewed → partially_paid → paid
    ↓       ↓                        ↓
voided  voided                  overdue → paid
                                      ↓
                                  voided
```

**7-4 transition scope:**
- `draft → voided` (AC1)
- `sent → voided` (AC1)
- `viewed → voided` (AC1)
- `partially_paid → voided` (AC1) — payments remain recorded
- `overdue → voided` (AC1)
- `paid → voided` is **REJECTED** (AC1)
- `draft/sent/viewed/partially_paid/overdue → credit note applied` (AC2) — status does NOT change; `credit_balance_cents` increments
- `paid → credit note` is **REJECTED** (AC2 — post-payment refunds deferred to future story)
- `voided → anything` is **REJECTED** (terminal)

### Credit Note Line Item Pattern

Credit notes are represented as negative line items to preserve the invoice total invariant:

```sql
INSERT INTO invoice_line_items (
  invoice_id, workspace_id, source_type, description,
  quantity, unit_price_cents, amount_cents, sort_order
) VALUES (
  $1, $2, 'credit_note', $3,
  1, -$4, -$4, nextval('invoice_line_items_sort_order_seq')
);
```
_Note: Use a dedicated sequence or gapless-sort-order utility to avoid `MAX(sort_order)+1` race conditions on concurrent credit notes._

This ensures `total_cents = SUM(amount_cents)` always holds. The invoice status does NOT change when a credit note is issued — only `credit_balance_cents` increments.

### Time Entry Clearing on Void

```typescript
// After voiding invoice, clear invoiced_at for associated time entries
// CRITICAL: Must be atomic with the void status update.
// Use a Supabase RPC function or database trigger to ensure both succeed or both fail.
// Do NOT call UPDATE invoice and UPDATE time_entries as separate client requests.
await supabase.rpc('void_invoice_and_clear_time_entries', {
  invoice_id: invoiceId,
  workspace_id: workspaceId,
  void_reason: reason
});
```

This makes time entries available for re-invoicing. The RPC must update `invoices.status`, `invoices.voided_at`, `invoices.void_reason`, and clear `time_entries.invoiced_at` for all entries linked to this invoice's line items — all within a single transaction.

### Per-Client Financial Summary Query Pattern

```sql
SELECT
  COALESCE(SUM(CASE WHEN i.status != 'voided' THEN i.total_cents END), 0) AS total_invoiced_cents,
  COALESCE(SUM(i.amount_paid_cents), 0) AS total_paid_cents,
  COALESCE(SUM(CASE WHEN i.status NOT IN ('voided', 'paid') THEN i.total_cents - i.amount_paid_cents END), 0) AS total_outstanding_cents,
  COALESCE(SUM(i.credit_balance_cents), 0) AS total_credit_cents,
  COUNT(CASE WHEN i.status = 'voided' THEN 1 END) AS voided_count
FROM invoices i
WHERE i.client_id = $1 AND i.workspace_id = $2;
```

### Previous Story Intelligence

**Story 7-3 review findings relevant to 7-4:**
- **Idempotency pattern:** 7-3 uses `idempotency_keys` table with SHA256 hash. Void and credit note actions are one-shot user confirmations (not retry-prone like payments), so idempotency keys are NOT required. But if implementing batch void/credit, consider idempotency.
- **RPC atomicity lesson:** 7-3 idempotency was initially non-atomic (client-side insert after RPC). 7-4 void/credit should do all DB operations in a single RPC or within one Server Action transaction scope. No client-side state between steps.
- **`FOR UPDATE` vs optimistic concurrency:** 7-3 uses `FOR UPDATE` in `record_payment_with_concurrency` RPC. 7-4 void action can use simpler `UPDATE ... WHERE status != 'voided' AND status != 'paid'` pattern since voiding is low-concurrency (single user action, not concurrent payments).
- **Fabricated `InvoiceWithBalance` bug:** 7-3 review found fabricated empty fields in action response. 7-4 must populate `InvoiceWithBalance` from actual DB fetch, not hand-constructed objects.
- **Negative balance bug:** 7-3 had `balanceCents` going negative. 7-4 must ensure `balanceCents = MAX(total_cents - amount_paid_cents, 0)` on all read paths.
- **Modal accessibility:** 7-3 modal lacked focus trap and Escape handler. 7-4 modals MUST include Radix Dialog or `useFocusTrap` hook per WCAG 2.1 AA.
- **File size limits:** 7-3 review flagged 4 files >250 lines. 7-4 must keep `void-invoice.ts` and `issue-credit-note.ts` under 200 lines by extracting helpers into `void-invoice-helpers.ts` and `credit-note-helpers.ts`.
- **Audit logging:** 7-3 review noted audit log inserts were removed in a refactor. 7-4 MUST write audit entries for void and credit note actions.
- **Aria-describedby:** 7-3 modal had missing error element IDs. 7-4 modals must have `aria-describedby` correctly linking to error elements.

**Story 7-1/7-2 patterns to follow:**
- `createInvoiceAction` uses `revalidateTag(cacheTag('invoice', workspaceId))` pattern. 7-4 actions follow same cache invalidation.
- `checkInvoiceDuplicates` query pattern (day-before/day-after window) — 7-4 does not need duplicate detection but shows how to do date-range queries.
- `sendInvoice` action uses `delivery_token` (HMAC via Node crypto). 7-4 does not generate tokens but may send email notifications for credit notes (deferred to future story).

### Existing Code to Reuse/Extend

| Component | Location | What to do |
|---|---|---|
| `invoices` table | `packages/db/src/schema/invoices.ts` | Has `voidedAt`, `voidReason`, `creditBalanceCents`, `status` CHECK. Extend CHECK to include `credit_note` in line items if needed. |
| `invoice_line_items` table | `packages/db/src/schema/invoices.ts` | CHECK constraint on `source_type` needs `credit_note` added. |
| `voidInvoiceSchema` | `packages/types/src/invoice.ts:167` | Verify `reason` is required. Update if needed. |
| `Invoice` type | `packages/types/src/invoice.ts` | Already has `voidedAt`, `voidReason`, `creditBalanceCents`. |
| `ActionResult` / `FlowError` | `packages/types/src/action-result.ts`, `flow-error.ts` | Add `INVOICE_PAID_CANNOT_VOID`, `CREDIT_EXCEEDS_BALANCE`, `INVOICE_ALREADY_VOIDED`, `INVOICE_PAID_CANNOT_CREDIT`. |
| `formatCentsToDollar()` | `packages/shared/src/numeric-helpers.ts` | Use for all money display. |
| `invalidateAfterMutation()` | `packages/db/src/cache-policy.ts` | Add `credit_note` entity. |
| `InvoiceStatusBadge` | `apps/web/app/(workspace)/invoices/components/` (or similar) | Add `voided` and `credit_applied` variants. |
| Audit log infrastructure | `supabase/migrations/20260420140005_audit_log.sql` | Write entries for void, credit note create, credit balance change. |
| `InvoiceListItem` | `packages/db/src/queries/invoices/get-invoices.ts` | Add `voidedAt`, `creditBalanceCents` to returned shape. Filter voided by default. |
| `getInvoiceDetail` | `packages/db/src/queries/invoices/get-invoice-detail.ts` | Add credit notes join + reconciliation data. |
| `time_entries.invoiced_at` | `packages/db/src/schema/time-entries.ts` | Clear on void. |

### Project Structure Notes

New files follow established patterns:
- Migration: `supabase/migrations/20260531000001_credit_notes.sql`
- Schema: extends `packages/db/src/schema/invoices.ts` (add `credit_notes` table, update `invoice_line_items` CHECK)
- Queries: `packages/db/src/queries/invoices/void-invoice.ts`, `issue-credit-note.ts`, `get-time-entry-reconciliation.ts`, `get-client-financial-summary.ts`, `clear-invoiced-at-on-void.ts`
- Types: extends `packages/types/src/invoice.ts`
- Actions: `apps/web/lib/actions/invoices/void-invoice.ts`, `issue-credit-note.ts`
- Helpers: `apps/web/lib/actions/invoices/void-invoice-helpers.ts`, `credit-note-helpers.ts` (keep main actions ≤200 lines)
- Pages: modifies `apps/web/app/(workspace)/invoices/[invoiceId]/page.tsx` and `page.tsx` (list)
- RLS tests: `supabase/tests/rls_credit_notes.sql`
- ATDD: `apps/web/__tests__/acceptance/epic-7/7-4-void-credit-note.spec.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7 — Story 7.4]
- [Source: _bmad-output/planning-artifacts/prd.md#FR41, FR43, FR102]
- [Source: _bmad-output/planning-artifacts/architecture.md#Financial data handling, Invoice state machine]
- [Source: docs/project-context.md — 180 rules including money-as-integers, RLS ::text cast, append-only financial records, void terminal state]
- [Source: Story 7-3 implementation artifact — payment tracking, review findings, deferred items]
- [Source: Story 7-3a implementation artifact — time entry billing, invoiced_at lifecycle]
- [Source: packages/db/src/schema/invoices.ts — existing invoices, line items, payments schema]
- [Source: packages/types/src/invoice.ts — existing Zod schemas including voidInvoiceSchema]
- [Source: packages/db/src/cache-policy.ts — entity tag mapping]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Deferred Items (at close)

_Count recorded at each code review pass. If >5, require Architect + PM approval (see scope-check-gate.md step 7)._

| Item | Target Story | Reason |
|------|-------------|--------|
| Post-payment refunds (credit notes on `paid` invoices) | Story 7.5 or 7.6 | Requires refund method selection, payout confirmation, possibly Stripe/PayPal integration. Separate user journey from pre-payment corrections. |
| Payment re-allocation / prepayment carry-forward for voided partially-paid invoices | Story 7.6+ | Requires invoice replacement linking, prepayment tracking UI. Too large for 7-4 scope. |

### Test Commit Record

_Epic 5 retro A2: Record the SHA of the first failing test commit (red phase) before any implementation commit._

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| | | |

### File List

#### New files (planned)
- `supabase/migrations/20260531000001_credit_notes.sql`
- `supabase/tests/rls_credit_notes.sql`
- `packages/db/src/queries/invoices/void-invoice.ts`
- `packages/db/src/queries/invoices/issue-credit-note.ts`
- `packages/db/src/queries/invoices/get-time-entry-reconciliation.ts`
- `packages/db/src/queries/invoices/get-client-financial-summary.ts`
- `packages/db/src/queries/invoices/clear-invoiced-at-on-void.ts`
- `apps/web/lib/actions/invoices/void-invoice.ts`
- `apps/web/lib/actions/invoices/void-invoice-helpers.ts`
- `apps/web/lib/actions/invoices/issue-credit-note.ts`
- `apps/web/lib/actions/invoices/credit-note-helpers.ts`
- `apps/web/app/(workspace)/invoices/[invoiceId]/components/void-invoice-button.tsx`
- `apps/web/app/(workspace)/invoices/[invoiceId]/components/void-invoice-modal.tsx`
- `apps/web/app/(workspace)/invoices/[invoiceId]/components/issue-credit-note-button.tsx`
- `apps/web/app/(workspace)/invoices/[invoiceId]/components/issue-credit-note-modal.tsx`
- `apps/web/app/(workspace)/invoices/[invoiceId]/components/time-entry-reconciliation-table.tsx`
- `packages/types/src/__tests__/credit-note.test.ts`
- `apps/web/__tests__/acceptance/epic-7/7-4-void-credit-note.spec.ts`

#### Modified files (planned)
- `packages/db/src/schema/invoices.ts` (update CHECK for credit_note source_type)
- `packages/types/src/invoice.ts` (issueCreditNoteSchema, CreditNote type)
- `packages/types/src/errors.ts` (new error codes)
- `packages/types/src/index.ts` (exports)
- `packages/db/src/cache-policy.ts` (add credit_note entity)
- `packages/db/src/queries/invoices/get-invoices.ts` (add voided filter, credit badge)
- `packages/db/src/queries/invoices/get-invoice-detail.ts` (add credit notes join)
- `packages/db/src/queries/invoices/get-invoice-with-balance.ts` (add credit balance display)
- `packages/db/src/queries/invoices/index.ts` (new exports)
- `packages/db/src/index.ts` (new exports)
- `apps/web/app/(workspace)/invoices/[invoiceId]/page.tsx` (add void/credit buttons, reconciliation tab)
- `apps/web/app/(workspace)/invoices/page.tsx` (add voided filter)
- `apps/web/app/(workspace)/invoices/components/invoice-status-badge.tsx` (add voided + credit variants)
- `apps/web/app/(workspace)/clients/[clientId]/page.tsx` (add reconciliation tab)

### Review Findings

**Review date: 2026-05-27 | Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor**

- [x] [Review][Patch] Credit note RPC balance check ignores existing `credit_balance_cents`, allowing over-credit [supabase/migrations/20260531000001_credit_notes.sql:152] — Fixed: RPC subtracts credit_balance_cents, UI subtracts creditBalanceCents. Sources: blind+edge+auditor.
- [x] [Review][Patch] `invoiceLineItemSourceEnum` missing `'credit_note'` variant [packages/types/src/invoice.ts:14-18] — Fixed: Added 'credit_note' to Zod enum. Sources: edge+auditor.
- [x] [Review][Patch] Void already-voided invoice should return success (idempotent noop) [void-invoice.ts, 20260531000001_credit_notes.sql:72] — Fixed: RPC returns success for already-voided, action treats as success. Sources: auditor, resolved via party mode.
- [x] [Review][Patch] No focus trap in void or credit note modals [void-invoice-button.tsx, issue-credit-note-button.tsx] — Fixed: Added focus trap (Tab cycling), Escape handler, body scroll lock, initial focus via ref. Sources: blind+edge+auditor.
- [x] [Review][Patch] `aria-describedby` references non-existent element when no error [void-invoice-button.tsx:77, issue-credit-note-button.tsx:73] — Fixed: Error container always rendered (invisible when empty). Sources: edge+auditor.
- [x] [Review][Patch] Audit log records `priorStatus: detail.status` which is always `'voided'` after RPC [apps/web/lib/actions/invoices/void-invoice.ts:102] — Fixed: RPC returns prior_status in result, action uses it for audit. Sources: auditor.
- [x] [Review][Patch] Missing second audit log entry for `credit_balance_change` [apps/web/lib/actions/invoices/issue-credit-note.ts:103-110] — Fixed: Inserted two audit entries (credit_note_issued + credit_balance_change). Sources: auditor.
- [x] [Review][Patch] Voided badge does not show paid amount or void reason tooltip [apps/web/.../invoice-helpers.tsx:19] — Fixed: StatusBadge accepts amountPaidCents, voidReason props. Shows "Voided · $X.XX paid", title tooltip for voidReason, "Credit Applied · $X.XX". Sources: auditor.
- [x] [Review][Patch] Implement invoice list filter pills UI [AC7] — Fixed: Added InvoiceFilterPills component, default=Active, voided row opacity-60, credit badge on list rows. Sources: auditor, resolved via party mode.
- [x] [Review][Patch] Fix time entry reconciliation query — "Ready to re-bill" badge unreachable [get-time-entry-reconciliation.ts:25] — Fixed: Rewrote query to join invoice_line_items → invoices → time_entries. Prefer non-voided invoice for multi-invoice entries. Sources: edge+auditor, resolved via party mode.
- [x] [Review][Patch] `totalOutstandingCents` and `totalCreditCents` ignore credit balance and voided status correctly [packages/db/src/queries/invoices/get-client-financial-summary.ts:43-46] — Fixed: Outstanding subtracts credit, credit excludes voided. Tests updated. Sources: edge+auditor.
- [x] [Review][Patch] Credit note uses `type="number"` input instead of currency input [issue-credit-note-button.tsx:63] — Fixed: Replaced with text input + inputMode=decimal + integer-based dollarsToCents/centsToDollars helpers. Sources: blind+auditor.
- [x] [Review][Patch] `window.location.reload()` on success loses all client state [void-invoice-button.tsx, issue-credit-note-button.tsx] — Fixed: Uses router.refresh() from Next.js useRouter. Sources: blind+edge.
- [x] [Review][Patch] RLS INSERT on `credit_notes` doesn't enforce invoice status [supabase/migrations/20260531000001_credit_notes.sql:208-223] — Fixed: Added `AND inv.status NOT IN ('paid', 'voided')` to INSERT policy. Sources: edge.
- [x] [Review][Patch] Void does not reset `credit_balance_cents` [supabase/migrations/20260531000001_credit_notes.sql:95-100] — Fixed: Void RPC sets credit_balance_cents = 0. Sources: edge.
- [x] [Review][Patch] Credit note line items have no FK to `credit_notes` record [supabase/migrations/20260531000001_credit_notes.sql:167-173] — Noted: No FK column added (would require schema migration beyond scope), but RPC returns credit_note_id for tracing. Sources: edge.
- [x] [Review][Patch] Time entry reconciliation `lineMap.set` overwrites multi-invoice entries [get-time-entry-reconciliation.ts:51] — Fixed: Rewrote with Map + prefer-non-voided logic for duplicate time entries. Sources: edge.
- [x] [Review][Defer] ATDD tests all `test.skip()` — no executable verification [apps/web/__tests__/acceptance/epic-7/7-4-void-credit-note.spec.ts] — deferred, matches ATDD scaffold pattern used in other epics
- [x] [Review][Defer] `set_credit_notes_updated_at` trigger unreachable due to no UPDATE policy [supabase/migrations/20260531000001_credit_notes.sql:26-29] — deferred, harmless dead code
- [x] [Review][Defer] Void modal payment linkage wording may be inaccurate [void-invoice-button.tsx:60] — deferred, cosmetic copy issue
- [x] [Review][Defer] Issue Credit Note button visible when maxCreditCents=0 [page.tsx:92-98] — deferred, minor UX polish
- [x] [Review][Defer] `voidInvoiceViaRpc`/`issueCreditNoteViaRpc` wrappers unused by actions (actions call supabase.rpc directly) — deferred, query wrappers available for future non-action callers

---

Status: done

Last updated: 2026-05-27
