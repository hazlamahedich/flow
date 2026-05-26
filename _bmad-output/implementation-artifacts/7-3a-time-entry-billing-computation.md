# Story 7.3a: Time Entry Billing Computation

Status: backlog

## Story

As a user,
I want to bill time entries directly onto invoices,
so that I don't have to manually calculate hours × rate for every entry.

## Context

This story was **split from Story 7-3** during the 2026-05-26 Party Mode adversarial review. The original Story 7-3 bundled payment tracking with time entry billing enablement — a scope contamination that would have blown estimates and produced a half-baked billing engine. Payment tracking (Story 7-3) now ships cleanly while this story handles the deferred billing computation.

**Dependencies:**
- Story 7-3 (Partial Payments & Balance Tracking) — **must be done**
- Story 5-1 (Time Entry Data Model) — **done**
- Story 3-2 (Retainer Agreements) — **done** (hourly rate source)

---

## Acceptance Criteria

0. **[AC0 — Test-First]** Unit test stubs are red before implementation. Minimum: `computeTimeEntryAmount` tests (valid, missing rate, retainer precedence, rounding edge cases), `createInvoice` integration tests with `time_entry` items, `updateInvoice` integration tests with `time_entry` items.

1. **[AC1 — Hourly rate resolution]** When a `time_entry` line item is submitted in `createInvoice` or `updateInvoice`, the Server Action resolves `hourly_rate_cents` in this precedence order:
   - Active retainer agreement for the client with `hourly_rate_cents > 0`
   - Client's `hourly_rate_cents` column
   - If neither exists, reject with `NO_HOURLY_RATE` error code.

2. **[AC2 — Amount computation]** For each `time_entry` line item:
   - Look up `duration_minutes` from `time_entries` table by `timeEntryId`
   - Compute `quantity = duration_minutes / 60` (numeric, precision 10,2)
   - Compute `amount_cents = ROUND(hourly_rate_cents * quantity)` (standard rounding, half-up)
   - Set `unit_price_cents = hourly_rate_cents`
   - Set `source_type = 'time_entry'`
   - The client does NOT submit `amountCents` or `unitPriceCents` for `time_entry` items — these are server-derived.

3. **[AC3 — Invoice total recalculation]** After adding/removing `time_entry` line items, `total_cents` on the invoice is recomputed as the sum of all line item `amount_cents`. This is identical to the existing `fixed_service` total recalculation pattern.

4. **[AC4 — Time entry picker UI]** Invoice creation/edit form includes a "Add Time Entries" section showing **uninvoiced** time entries for the selected client:
   - Columns: date, duration, notes
   - Checkbox per row for multi-select
   - "Add Selected" button populates line items with computed amounts
   - Time entries already invoiced (referenced by `invoice_line_items.time_entry_id`) are filtered out
   - Empty state: "No uninvoiced time entries for this client."

5. **[AC5 — Invoiced flag]** When a `time_entry` line item is successfully added to an invoice, the corresponding `time_entries` row is marked with `invoiced_at` (timestamptz) on invoice send (not on draft creation — same as fixed_service items).

6. **[AC6 — Update invoice with time entries]** `updateInvoice` action supports adding/removing `time_entry` line items following the same computation rules as AC1–AC2. When a time entry line item is removed, its `invoiced_at` flag is cleared (if invoice is still draft).

7. **[AC7 — Edge cases]**
   - Time entry with `duration_minutes = 0` → `amount_cents = 0`, line item shows "$0.00 (0 min)"
   - Time entry with `duration_minutes = 1` → `quantity = 0.0167`, `amount_cents = ROUND(hourly_rate_cents * 0.0167)`
   - Multiple time entries from same client on same invoice → each is a separate line item

8. **[AC8 — Schema updates]** Remove `NOT_IMPLEMENTED` error from `createInvoice`/`updateInvoice` actions (installed by Story 7-3 AC9a/AC13). Update `recordPaymentSchema` validation: `time_entry` line items in sent/partially_paid invoices do NOT trigger re-computation — amounts are locked at invoice send time.

9. **[AC9 — RLS & Access]** Time entry picker only shows entries the current user has access to (via `time_entries` RLS). Client-scoped members see entries for their assigned clients only.

## Pre-Dev Dependency Scan

- [ ] Story 7-3 (Partial Payments & Balance Tracking) — **blocked** until 7-3 completes
- [ ] Story 5-1 (Time Entry Data Model) — **done**
- [ ] Story 3-2 (Retainer Agreements) — **done** (needs `hourly_rate_cents` on retainer)
- [ ] `time_entries` table has `duration_minutes` — **confirmed**
- [ ] `clients` table has `hourly_rate_cents` — **verify**
- [ ] `retainer_agreements` table has `hourly_rate_cents` — **verify**

## Tasks / Subtasks

- [ ] Task 1: Rate resolution logic (AC: #1)
  - [ ] 1.1 Create `packages/db/src/queries/invoices/resolve-hourly-rate.ts` — retainer → client fallback
  - [ ] 1.2 Add `NO_HOURLY_RATE` to `FlowError` codes
- [ ] Task 2: Amount computation (AC: #2)
  - [ ] 2.1 Create `packages/shared/src/time-entry-billing.ts` — `computeTimeEntryAmount(durationMinutes, hourlyRateCents)`
  - [ ] 2.2 Unit tests for rounding edge cases (0 min, 1 min, 59 min, 60 min, 61 min)
- [ ] Task 3: Update create-invoice action (AC: #2, #3, #8)
  - [ ] 3.1 Remove `NOT_IMPLEMENTED` guard
  - [ ] 3.2 For each `time_entry` item: resolve rate → compute amount → append line item
  - [ ] 3.3 Recalculate invoice total
- [ ] Task 4: Update update-invoice action (AC: #6)
  - [ ] 4.1 Remove `NOT_IMPLEMENTED` guard
  - [ ] 4.2 Handle add/remove of time entry line items
  - [ ] 4.3 Clear `invoiced_at` when removed from draft invoice
- [ ] Task 5: Time entry picker UI (AC: #4)
  - [ ] 5.1 Create `TimeEntryPicker` client component (modal or inline section)
  - [ ] 5.2 Query uninvoiced entries for selected client
  - [ ] 5.3 Multi-select + "Add Selected" button
  - [ ] 5.4 Auto-populate line items with computed amounts
- [ ] Task 6: Invoiced flag (AC: #5)
  - [ ] 6.1 Update `sendInvoice` action to set `time_entries.invoiced_at = now()` for referenced entries
  - [ ] 6.2 Update `voidInvoice` (Story 7-4) to clear `invoiced_at` — deferred to 7-4
- [ ] Task 7: Testing (AC: #0)
  - [ ] 7.1 Unit tests for `computeTimeEntryAmount`
  - [ ] 7.2 Integration tests for `createInvoice` with time entry items
  - [ ] 7.3 Integration tests for `updateInvoice` with time entry items
  - [ ] 7.4 Component tests for `TimeEntryPicker`

## Dev Notes

### Critical Architecture Rules

- **Money is integer cents, always.** `amount_cents` computed via `ROUND(hourly_rate_cents * duration_minutes / 60)`. PostgreSQL `ROUND()` is standard half-up. [Source: project-context.md#Financial Data Handling]
- **Rate precedence is business-critical.** Retainer rate overrides client rate. If neither exists, reject — don't default to $0 (that would silently under-bill). [Source: Story 5-3 Dev Notes]
- **Time entry amounts are locked at invoice send.** Once an invoice is `sent`, time entry line item amounts are immutable (same as fixed_service). Computed amounts live in `invoice_line_items`, not in `time_entries`. [Source: Story 7-1 Dev Notes]

### Rate Resolution Query Pattern

```sql
-- Priority 1: Active retainer with hourly_rate_cents
SELECT ra.hourly_rate_cents
FROM retainer_agreements ra
WHERE ra.client_id = $1
  AND ra.status = 'active'
  AND ra.hourly_rate_cents IS NOT NULL
  AND ra.hourly_rate_cents > 0
ORDER BY ra.created_at DESC
LIMIT 1;

-- Priority 2: Client's own hourly_rate_cents
SELECT c.hourly_rate_cents
FROM clients c
WHERE c.id = $1;

-- If both return NULL or 0 → NO_HOURLY_RATE error
```

### Amount Computation

```typescript
export function computeTimeEntryAmount(
  durationMinutes: number,
  hourlyRateCents: number
): number {
  const quantity = durationMinutes / 60; // e.g., 0.5 for 30 min
  return Math.round(hourlyRateCents * quantity);
}
```

PostgreSQL equivalent (for RPC):
```sql
ROUND(hourly_rate_cents * (duration_minutes / 60.0))
```

### Time Entry Picker Query

```sql
SELECT id, date, duration_minutes, notes
FROM time_entries
WHERE client_id = $1
  AND workspace_id = $2
  AND deleted_at IS NULL
  AND invoiced_at IS NULL
ORDER BY date DESC, created_at DESC;
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7 — Story 7.3 (parent story)]
- [Source: Story 7-3 refinement log — reason for split]
- [Source: packages/db/src/schema/time-entries.ts — time_entries table shape]
- [Source: packages/types/src/invoice.ts — time_entry line item schema (after 7-3 unblock)]
- [Source: apps/web/lib/actions/invoices/create-invoice.ts — existing create action]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### Deferred Items (at close)

| Item | Target Story | Reason |
|------|-------------|--------|
| Void invoice clears `invoiced_at` | Story 7-4 | Requires void action; out of scope for billing computation |

### Test Commit Record

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| | | |

### File List

#### New files (expected)
- `packages/shared/src/time-entry-billing.ts`
- `packages/shared/src/__tests__/time-entry-billing.test.ts`
- `packages/db/src/queries/invoices/resolve-hourly-rate.ts`
- `apps/web/app/(workspace)/invoices/new/components/time-entry-picker.tsx`
- `apps/web/app/(workspace)/invoices/new/components/__tests__/time-entry-picker.test.tsx`
- `apps/web/__tests__/acceptance/epic-7/7-3a-time-entry-billing.spec.ts`

#### Modified files (expected)
- `packages/types/src/invoice.ts` (remove `NOT_IMPLEMENTED` guard from schemas)
- `apps/web/lib/actions/invoices/create-invoice.ts` (remove NOT_IMPLEMENTED, add billing computation)
- `apps/web/lib/actions/invoices/update-invoice.ts` (remove NOT_IMPLEMENTED, add billing computation)
- `apps/web/lib/actions/invoices/send-invoice.ts` (set `invoiced_at` on referenced time entries)
- `apps/web/app/(workspace)/invoices/new/components/create-invoice-form.tsx` (add TimeEntryPicker section)
- `packages/db/src/queries/invoices/create-invoice.ts` (handle time_entry line items)
