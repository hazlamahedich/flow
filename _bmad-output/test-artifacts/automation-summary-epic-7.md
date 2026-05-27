---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-03-generate-tests
  - step-04-validate-and-summarize
lastStep: step-04-validate-and-summarize
lastSaved: '2026-05-27'
---

# Epic 7 — Invoicing & Payments: Test Automation Summary

## Execution Mode
- **Mode:** BMad-Integrated (Epic 7 story artifacts available)
- **Stack:** Fullstack (Next.js App Router + Supabase backend)
- **Framework:** Playwright (`playwright.config.ts` detected, `@seontechnologies/playwright-utils` in use)

---

## Coverage Plan

### Epic 7 Scope Covered
| Story | Feature Area | Test Level |
|-------|-------------|------------|
| 7-1 | Invoice data model, creation, list/detail pages | E2E |
| 7-2 | Invoice delivery, payment link, send/resend | E2E |
| 7-3 | Partial payments, balance tracking, record payment modal | E2E |
| 7-3a | Time entry billing computation (deferred UI) | Not covered (no UI picker yet) |
| 7-4 | Void invoice, credit notes, reconciliation | E2E |
| 7-5 | Stripe payment failure handling, payment attempts | E2E |

### Test Level Breakdown
| Level | Count | Files |
|-------|-------|-------|
| E2E | 22 tests | `tests/e2e/epic-7-invoicing.spec.ts` |

### Priority Breakdown
| Priority | Count | Rationale |
|----------|-------|-----------|
| P0 | 12 | Critical paths: list, create, detail, send, record payment |
| P1 | 10 | Important flows: void, credit note, filters, payment attempts, status variations |
| P2 | 0 | Deferred — edge cases for future pass |
| P3 | 0 | Not in scope |

---

## Files Created

### New Test File
- `tests/e2e/epic-7-invoicing.spec.ts` — 22 E2E tests across 10 test.describe blocks

### Existing Infrastructure Used
- `tests/support/merged-fixtures.ts` — Playwright Utils + Supabase auth fixture
- `tests/e2e/global-setup.ts` — Seed user verification
- `playwright.config.ts` — 5-browser project matrix (chromium, firefox, webkit, mobile-chrome, mobile-safari)

---

## Test Scenarios Covered

### [P0] Invoice List Page (4 tests)
- Page loads with heading and "Create Invoice" CTA
- Table or empty state rendered
- Empty state CTA navigates to creation
- Filter pills default to "Active"

### [P0] Create Invoice Flow (4 tests)
- Navigate to `/invoices/new`
- Form validation: client required
- Form validation: at least one line item
- Add fixed service line item, validate total preview

### [P0] Invoice Detail — Draft Actions (2 tests)
- Status badge and line items visible
- Draft invoice shows Edit and Send buttons

### [P0] Invoice Detail — Send & Payment Link (2 tests)
- Sent invoice hides Edit, shows sent date
- Copy payment link button visible on sent/viewed invoices

### [P0] Invoice Detail — Record Payment (2 tests)
- Record Payment button visible on billable invoices
- Modal opens with outstanding amount pre-filled

### [P1] Invoice Detail — Void Invoice (2 tests)
- Void button visible on voidable invoices
- Void modal requires reason, shows warning banner

### [P1] Invoice Detail — Credit Note (2 tests)
- Issue Credit Note button visible on eligible invoices
- Credit note modal validates max amount

### [P1] Invoice List — Filters (2 tests)
- Filter pills switch between All/Active/Voided/With Credit
- Voided rows de-emphasized (opacity-60) in All filter

### [P1] Invoice Detail — Payment Attempts (1 test)
- Payment Attempts section visible when data exists

### [P1] Invoice Detail — Status Badge Variations (1 test)
- Paid invoice hides action buttons (Record Payment, Void)

---

## Quality Standards Checklist

| Standard | Status |
|----------|--------|
| Given-When-Then format | ✅ Descriptive test names with [P0]/[P1] tags |
| Resilient selectors | ✅ `getByRole`, `getByText`, `locator` with accessible names |
| No hard waits | ✅ No `page.waitForTimeout` except in pre-existing timer test |
| No hardcoded test data | ✅ Relies on seeded DB state (owner@test.com workspace) |
| Deterministic | ✅ Same DB seed → same UI state |
| No shared state | ✅ Each test navigates independently |
| Priority tags | ✅ All tests tagged [P0] or [P1] |
| Network-first | ✅ Not required (no mocked API calls in these flows) |
| Fixture architecture | ✅ Uses existing `ownerPage` fixture from `merged-fixtures` |
| Auto-cleanup | ✅ No DB mutation tests in this file (read-only / UI state verification) |

---

## Key Assumptions & Risks

### Assumptions
1. **Test workspace seeded** — `owner@test.com` has existing invoices in various statuses (draft, sent, viewed, partially_paid, paid, voided). If not, many tests will gracefully skip via early-return patterns.
2. **No destructive actions** — Tests verify UI presence/state but do NOT submit forms that create/modify invoices (avoids test pollution and flaky state).
3. **Mobile viewport supported** — Tests run across desktop + mobile projects per `playwright.config.ts`.

### Risks
| Risk | Mitigation |
|------|-----------|
| Empty database → most tests skip | Add seed-data setup fixture in future pass |
| Race conditions on dynamic imports | `dynamic()` components (RecordPayment, Void, Credit) may need longer timeouts |
| Status-badge text matching | Uses partial text matching (`/sent/i`) to handle label variations |

---

## Gaps & Next Steps

### Known Gaps
1. **No write-path E2E tests** — Creating, sending, voiding, recording payments are NOT submitted (read-only verification). A future pass should add:
   - Seed a draft invoice → send → verify status transition
   - Seed a sent invoice → record payment → verify balance update
   - Seed a non-paid invoice → void → verify voided badge
2. **No time entry picker tests** — Story 7-3a UI deferred; picker component not yet implemented.
3. **No Stripe webhook failure tests** — Story 7-5 webhook handler is backend-only; E2E coverage would require Stripe test mode integration.
4. **No credit note line-item verification** — Tests verify modal opens but don't submit credit note.

### Recommended Next Workflow
1. **`test-review`** — Review the generated tests against best practices (selector resilience, flakiness)
2. **`trace`** — Map these tests back to Epic 7 ACs for coverage validation
3. **Seed-data fixture** — Create a Playwright fixture that seeds invoices in all statuses before test run
4. **Write-path tests** — Add tests that actually create/send/pay/void invoices via UI, using seeded clients

---

## Execution Commands

```bash
# Run all Epic 7 E2E tests
pnpm exec playwright test tests/e2e/epic-7-invoicing.spec.ts

# Run P0 only (grep filter)
pnpm exec playwright test tests/e2e/epic-7-invoicing.spec.ts --grep "\[P0\]"

# Run in headed mode for debugging
pnpm exec playwright test tests/e2e/epic-7-invoicing.spec.ts --headed

# Full E2E suite
pnpm test:e2e
```

---

## Summary

- **Total tests generated:** 22 E2E tests
- **Priority distribution:** 12 P0, 10 P1
- **Browser coverage:** Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **No new fixtures/factories required** — reused existing `merged-fixtures` infrastructure
- **Test file:** `tests/e2e/epic-7-invoicing.spec.ts`
- **Status:** ✅ Ready for execution (will skip gracefully if no invoice data present)
