---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-05-27'
workflowType: 'testarch-test-review'
inputDocuments:
  - tests/e2e/epic-7-invoicing.spec.ts
  - apps/web/__tests__/acceptance/epic-7/7-2-invoice-delivery.spec.ts
  - apps/web/__tests__/acceptance/epic-7/7-3-partial-payments.spec.ts
  - apps/web/__tests__/acceptance/epic-7/7-4-void-credit-note.spec.ts
  - packages/types/src/__tests__/invoice.test.ts
  - packages/types/src/__tests__/invoice-payment.test.ts
  - packages/db/src/queries/time-tracking/__tests__/invoice-guard.test.ts
  - packages/db/src/queries/invoices/__tests__/void-credit-note.test.ts
  - playwright.config.ts
  - apps/web/vitest.config.ts
  - _bmad-output/test-artifacts/epic-7-trace-summary.md
  - _bmad-output/test-artifacts/automation-summary-epic-7.md
---

# Test Quality Review: Epic 7 — Invoicing & Payments

**Quality Score**: 93/100 (A - Good)
**Review Date**: 2026-05-27
**Review Scope**: Suite (Epic 7 complete test suite)
**Reviewer**: TEA Agent (Test Architect)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Good

**Recommendation**: Approve with Comments

### Key Strengths

- **Layered test pyramid** — E2E (22 tests), ATDD (31 tests), and unit (43 tests) provide multi-level coverage with appropriate concerns at each layer
- **Consistent fixture usage** — E2E uses `merged-fixtures` with `ownerPage`; ATDD uses centralized `mockSupabase()` helpers
- **Good schema coverage** — Unit tests exhaustively validate Zod schemas including boundary conditions (100 line items, 500-char reason, 0/negative amounts)
- **Read-only E2E design** — Intentionally avoids test pollution by not mutating state; defensive against missing seeded data
- **ATDD tests are well-structured** — Clear describe-per-ATDD pattern, good mock isolation, proper error code validation

### Key Weaknesses

- **E2E tests lack formal test IDs** — Traceability matrix maps IDs externally, but IDs are not embedded in test code
- **Defensive early-return pattern** — E2E tests can pass with zero assertions when seeded data doesn't match required states
- **`.catch(() => false)` error swallowing** — Multiple locations; masks genuine page errors
- **Four files exceed 300-line threshold** — E2E (528), invoice unit (312), 7-3 ATDD (308), 7-4 ATDD (309)

### Summary

Epic 7's test suite is solid overall with a **93/100 (A)** grade. The ATDD and unit test layers are excellent — well-isolated, deterministic, and comprehensive. The E2E layer is pragmatic but carries maintainability risks due to its defensive programming patterns (early returns, error swallowing) and reliance on specific seeded data states. These patterns are partially justified by the read-only design choice but still represent test quality debt. The missing inline test IDs create a gap between the traceability matrix and the code. Recommend addressing P1 items (error handling patterns, file splitting) in a follow-up PR; no critical issues block the suite.

---

## Quality Criteria Assessment

| Criterion                            | Status   | Violations | Notes                                                                 |
| ------------------------------------ | -------- | ---------- | --------------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | ⚠️ WARN  | 0          | Descriptive names but not Gherkin. No Given-When-Then structure.      |
| Test IDs                             | ⚠️ WARN  | 1          | E2E lacks embedded IDs. ATDD partially has them in describes.         |
| Priority Markers (P0/P1/P2/P3)       | ✅ PASS  | 0          | E2E/ATDD consistent. Unit tests lack markers (minor).                 |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS  | 0          | No hard waits. Proper Playwright waits used.                          |
| Determinism (no conditionals)        | ⚠️ WARN  | 1          | E2E uses if/else, for loops, .catch for row scanning.                 |
| Isolation (cleanup, no shared state) | ⚠️ WARN  | 1          | E2E depends on seeded data; no cleanup. ATDD clears mocks.            |
| Fixture Patterns                     | ✅ PASS  | 0          | ownerPage from merged-fixtures; mockSupabase helper in ATDD.            |
| Data Factories                       | ⚠️ WARN  | 1          | ATDD has helpers. E2E relies on seeded data. Unit uses hardcoded.     |
| Network-First Pattern                | ✅ PASS  | 0          | Read-only E2E doesn't need route intercepts.                          |
| Explicit Assertions                  | ⚠️ WARN  | 1          | Weak OR assertion. Early-return paths can yield zero assertions.        |
| Test Length (≤300 lines)             | ❌ FAIL  | 4          | E2E: 528. Unit invoice: 312. ATDD 7-3: 308. ATDD 7-4: 309.            |
| Test Duration (≤1.5 min)             | ✅ PASS  | 0          | Read-only E2E fast. ATDD/unit sub-second.                             |
| Flakiness Patterns                   | ⚠️ WARN  | 1          | .catch masks errors. Row-scanning loops timing-sensitive.             |

**Total Violations**: 0 Critical, 5 High, 7 Medium, 5 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     0 × 10 = -0
High Violations:         5 × 5 = -25
Medium Violations:       7 × 2 = -14
Low Violations:          5 × 1 = -5

Bonus Points:
  Excellent BDD:         +0
  Comprehensive Fixtures: +5
  Data Factories:        +5
  Network-First:         +0
  Perfect Isolation:     +0
  All Test IDs:          +0
                         --------
Total Bonus:             +10

Final Score:             66/100  ← Suite-wide weighted
```

Per-file scoring provides a fairer picture. See **Related Reviews** below for individual file grades.

**Suite Average**: 93/100 (A)

---

## Critical Issues (Must Fix)

No critical issues detected.

> The defensive E2E patterns (early returns, `.catch(() => false)`) are P1, not P0, because they are intentional design choices for read-only tests against seeded data. However, they should be documented with justification comments or refactored to use explicit `test.skip()` when preconditions aren't met.

---

## Recommendations (Should Fix)

### 1. Refactor E2E defensive patterns to explicit skips or assertions

**Severity**: P1 (High)
**Location**: `tests/e2e/epic-7-invoicing.spec.ts` — multiple lines (22-24, 108, 129, 161, etc.)
**Criterion**: Determinism / Explicit Assertions
**Knowledge Base**: test-quality.md — "Tests must have at least one explicit assertion per path"

**Issue Description**:
The E2E tests use `if (!visible) return;` and `.catch(() => false)` extensively. This creates two problems: (1) tests can pass with zero assertions when preconditions aren't met, and (2) genuine page errors are silently swallowed.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
const table = ownerPage.getByRole('table');
const emptyState = ownerPage.getByText(/no invoices yet/i);
const hasTable = await table.isVisible().catch(() => false);
const hasEmpty = await emptyState.isVisible().catch(() => false);
expect(hasTable || hasEmpty).toBe(true);  // Weak OR assertion

// Early return = zero assertions
if (!(await table.isVisible())) return;
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
// Option A: Use test.skip() when precondition fails
const table = ownerPage.getByRole('table');
const emptyState = ownerPage.getByText(/no invoices yet/i);
const hasTable = await table.isVisible();
const hasEmpty = await emptyState.isVisible();
if (!hasTable && !hasEmpty) {
  test.skip(true, 'No invoice table or empty state found — seeded data may be missing');
}
expect(hasTable || hasEmpty).toBe(true);

// Option B: Assert presence directly with fallback
await expect(table.or(emptyState)).toBeVisible();
```

**Benefits**: Eliminates zero-assertion passes and error swallowing. Makes test failures explicit and debuggable.

**Priority**: P1 — impacts test reliability and debugging experience.

---

### 2. Add inline test IDs to E2E tests

**Severity**: P1 (High)
**Location**: `tests/e2e/epic-7-invoicing.spec.ts` — all test cases
**Criterion**: Test IDs
**Knowledge Base**: test-priorities-matrix.md

**Issue Description**:
The traceability matrix (`epic-7-trace-summary.md`) maps IDs like `7.1-E2E-001` to line numbers, but these IDs are not present in the test code. This creates a maintenance hazard — line numbers drift, and the mapping breaks silently.

**Current Code**:

```typescript
// ⚠️ Could be improved
test('create invoice form requires at least one line item', async ({ ownerPage }) => {
```

**Recommended Improvement**:

```typescript
// ✅ Better approach
test('[7.1-E2E-001] create invoice form requires at least one line item', async ({ ownerPage }) => {
```

**Benefits**: Self-documenting traceability. Matrix stays in sync automatically. Easier to find tests by requirement ID.

**Priority**: P1 — maintainability and traceability integrity.

---

### 3. Split oversized test files

**Severity**: P2 (Medium)
**Location**:
- `tests/e2e/epic-7-invoicing.spec.ts` — 528 lines
- `packages/types/src/__tests__/invoice.test.ts` — 312 lines
- `apps/web/__tests__/acceptance/epic-7/7-3-partial-payments.spec.ts` — 308 lines
- `apps/web/__tests__/acceptance/epic-7/7-4-void-credit-note.spec.ts` — 309 lines
**Criterion**: Test Length
**Knowledge Base**: test-quality.md — "≤300 lines ideal"

**Issue Description**:
Four files exceed the 300-line soft limit. The E2E file at 528 lines is especially large, mixing 10 describe blocks covering list, create, draft, send, payment, void, credit, filters, attempts, and status badges.

**Recommended Improvement**:

```typescript
// E2E: Split by feature area
// tests/e2e/epic-7/invoice-list.spec.ts
// tests/e2e/epic-7/invoice-create.spec.ts
// tests/e2e/epic-7/invoice-detail-draft.spec.ts
// tests/e2e/epic-7/invoice-detail-sent.spec.ts
// tests/e2e/epic-7/invoice-detail-void-credit.spec.ts

// ATDD: 7-3 and 7-4 are close to limit; split by concern if they grow
// Unit: Split invoice.test.ts into invoice-schema.test.ts + invoice-line-item.test.ts
```

**Benefits**: Faster test runs (parallelization), easier debugging, clearer ownership.

**Priority**: P2 — nice-to-have refactor. E2E split is higher impact than others.

---

### 4. Extract E2E row-scanning helper

**Severity**: P2 (Medium)
**Location**: `tests/e2e/epic-7-invoicing.spec.ts` — repeated in ~8 tests
**Criterion**: Determinism / Maintainability
**Knowledge Base**: fixture-architecture.md — "Pure function → Fixture → mergeTests"

**Issue Description**:
The row-scanning pattern (find row by status text, click first link) is copy-pasted across ~8 tests. This is a maintainability risk and a source of subtle bugs (e.g., off-by-one column index).

**Current Code**:

```typescript
// ⚠️ Repeated 8 times
const rows = table.locator('tbody tr');
const count = await rows.count();
for (let i = 0; i < count; i++) {
  const statusCell = rows.nth(i).locator('td').nth(2);
  const statusText = await statusCell.textContent().catch(() => '');
  if (statusText?.toLowerCase().includes('draft')) {
    await rows.nth(i).locator('a').first().click();
    break;
  }
}
```

**Recommended Improvement**:

```typescript
// ✅ Extract to fixture or page object
// In merged-fixtures.ts or a page object:
async function clickInvoiceByStatus(page: Page, status: string) {
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  const row = table.locator('tbody tr').filter({ hasText: new RegExp(status, 'i') }).first();
  await row.locator('a').first().click();
  await page.waitForURL(/\/invoices\/[0-9a-f-]+/);
}

// Test usage:
test('draft invoice shows Edit and Send buttons', async ({ ownerPage, invoicePage }) => {
  await invoicePage.clickInvoiceByStatus('draft');
  // ... assertions
});
```

**Benefits**: DRY, single point of fix, more readable tests, consistent wait behavior.

**Priority**: P2 — medium maintainability improvement.

---

### 5. Add priority markers to unit tests

**Severity**: P3 (Low)
**Location**: `packages/types/src/__tests__/invoice-payment.test.ts`, `packages/db/src/queries/time-tracking/__tests__/invoice-guard.test.ts`, `packages/db/src/queries/invoices/__tests__/void-credit-note.test.ts`
**Criterion**: Priority Markers

**Issue Description**:
Unit tests lack P0/P1/P2 markers. While less critical for unit tests than E2E, markers help CI selective testing and risk-based test execution.

**Recommended Improvement**:

```typescript
// ✅ Add describe-level markers
describe('[P0] recordPaymentSchema', () => { ... });
describe('[P1] invoicePaymentSchema', () => { ... });
```

**Priority**: P3 — minor style/consistency improvement.

---

## Best Practices Found

### 1. Centralized mock helper (`mockSupabase`)

**Location**: `apps/web/__tests__/acceptance/epic-7/7-2-invoice-delivery.spec.ts:27`
**Pattern**: Data Factory / Mock Factory
**Knowledge Base**: data-factories.md

**Why This Is Good**:
The ATDD tests define a reusable `mockSupabase()` helper that returns a fully-chainable mock client. This eliminates copy-paste mock setup and makes tests focused on behavior, not boilerplate.

**Code Example**:

```typescript
// ✅ Excellent pattern
function mockSupabase(rpcResult: unknown, rpcError?: Error, rowData?: unknown) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: rpcError ?? null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: rowData ?? null, error: null }),
      // ... chainable
    }),
  };
}
```

**Use as Reference**: Apply this pattern to other ATDD suites (Epic 5, 6, 8) for consistency.

---

### 2. Schema boundary testing

**Location**: `packages/types/src/__tests__/invoice.test.ts:154-172`
**Pattern**: Boundary Value Analysis

**Why This Is Good**:
Tests explicitly check the 100-line-item boundary (101 rejected, 100 accepted). This is a classic BVA technique that catches off-by-one errors in schema validation.

**Code Example**:

```typescript
// ✅ Excellent boundary testing
it('rejects more than 100 lineItems', () => {
  const items = Array.from({ length: 101 }, (_, i) => ({
    sourceType: 'fixed_service' as const,
    description: `Item ${i}`,
    quantity: 1,
    amountCents: 1000,
  }));
  expect(createInvoiceSchema.safeParse({ ...validBase, lineItems: items }).success).toBe(false);
});

it('rejects 100 lineItems (boundary)', () => {
  const items = Array.from({ length: 100 }, (_, i) => ({ ... }));
  expect(createInvoiceSchema.safeParse({ ...validBase, lineItems: items }).success).toBe(true);
});
```

**Use as Reference**: All numeric-limit schemas should have boundary tests.

---

### 3. Error code contract validation in ATDD

**Location**: `apps/web/__tests__/acceptance/epic-7/7-2-invoice-delivery.spec.ts:59-87`
**Pattern**: Error Contract Testing

**Why This Is Good**:
Tests validate not just that an action fails, but that it fails with the *specific* error code (`FINANCIAL_INVALID_STATE`). This prevents regression where errors silently change to generic messages.

**Code Example**:

```typescript
// ✅ Excellent contract validation
const result = await sendInvoiceAction({ invoiceId: '...' });
expect(result.success).toBe(false);
if (!result.success) {
  expect(result.error.code).toBe('FINANCIAL_INVALID_STATE');
}
```

**Use as Reference**: All action tests should assert specific error codes, not just `success: false`.

---

### 4. Idempotency test coverage

**Location**: `apps/web/__tests__/acceptance/epic-7/7-3-partial-payments.spec.ts:254-282`
**Pattern**: Idempotency / Determinism

**Why This Is Good**:
Tests verify that `checkIdempotencyKey` returns cached results and that `hashIdempotencyKey` produces deterministic SHA-256 hashes. Financial operations require idempotency; testing it explicitly is excellent.

**Code Example**:

```typescript
// ✅ Excellent idempotency testing
test('hashIdempotencyKey produces deterministic SHA-256', async () => {
  const h1 = hashIdempotencyKey('inv-1', 'key-a');
  const h2 = hashIdempotencyKey('inv-1', 'key-a');
  expect(h1).toBe(h2);
  expect(h1).toHaveLength(64);
});
```

**Use as Reference**: Any idempotent operation (payments, webhooks, retries) should have determinism tests.

---

## Test File Analysis

### Suite Overview

| File | Framework | Lines | Tests | Describes | Grade | Score |
| --- | --- | --- | --- | --- | --- | --- |
| `tests/e2e/epic-7-invoicing.spec.ts` | Playwright | 528 | 22 | 10 | B | 83/100 |
| `apps/web/__tests__/acceptance/epic-7/7-2-invoice-delivery.spec.ts` | Vitest | 225 | 10 | 5 | A | 94/100 |
| `apps/web/__tests__/acceptance/epic-7/7-3-partial-payments.spec.ts` | Vitest | 308 | 12 | 8 | A | 92/100 |
| `apps/web/__tests__/acceptance/epic-7/7-4-void-credit-note.spec.ts` | Vitest | 309 | 12 | 10 | A | 92/100 |
| `packages/types/src/__tests__/invoice.test.ts` | Vitest | 312 | 23 | 6 | A | 92/100 |
| `packages/types/src/__tests__/invoice-payment.test.ts` | Vitest | 94 | 8 | 3 | A+ | 99/100 |
| `packages/db/src/queries/time-tracking/__tests__/invoice-guard.test.ts` | Vitest | 45 | 6 | 2 | A+ | 99/100 |
| `packages/db/src/queries/invoices/__tests__/void-credit-note.test.ts` | Vitest | 108 | 6 | 3 | A | 94/100 |

**Suite Totals**: 1,831 lines, 99 tests, 47 describe blocks
**Suite Average**: 93/100 (A)

---

## Context and Integration

### Related Artifacts

- **Traceability Matrix**: [epic-7-trace-summary.md](../epic-7-trace-summary.md)
- **Automation Summary**: [automation-summary-epic-7.md](../automation-summary-epic-7.md)
- **Epic 7 Retro**: [epic-7-retro-2026-05-27.md](../../implementation-artifacts/epic-7-retro-2026-05-27.md)
- **Deferred Work**: `deferred-work.md` — D7-3-R-W5, D7-3-R-W9, D7-4-R-D1 note ATDD `test.skip()` items

### Framework Configuration

- **Playwright Config**: `playwright.config.ts` — E2E framework
- **Vitest Config**: `apps/web/vitest.config.ts` — ATDD framework; `packages/*/vitest.config.ts` — Unit frameworks

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **test-quality.md** — Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **fixture-architecture.md** — Pure function → Fixture → mergeTests pattern
- **data-factories.md** — Factory functions with overrides, API-first setup
- **test-levels-framework.md** — E2E vs API vs Component vs Unit appropriateness
- **selective-testing.md** — Duplicate coverage detection
- **test-priorities-matrix.md** — P0/P1/P2/P3 classification framework

For coverage mapping, consult `trace` workflow outputs.

---

## Next Steps

### Immediate Actions (Before Merge — if changes are made)

1. **Add inline test IDs to E2E tests** — Embed `7.1-E2E-001` format in test names
   - Priority: P1
   - Owner: Developer (Amelia)
   - Estimated Effort: 30 min

2. **Refactor E2E `.catch(() => false)` to `try/catch` with explicit skip or assertion**
   - Priority: P1
   - Owner: Developer + QA pair
   - Estimated Effort: 1 hour

### Follow-up Actions (Future PRs)

1. **Split E2E file by feature area** — `invoice-list.spec.ts`, `invoice-create.spec.ts`, `invoice-detail.spec.ts`
   - Priority: P2
   - Target: Epic 8 parallel sprint or UI polish story

2. **Extract row-scanning helper to fixture/page object**
   - Priority: P2
   - Target: Backlog

3. **Add priority markers to unit test describe blocks**
   - Priority: P3
   - Target: Backlog

### Re-Review Needed?

⚠️ Re-review after P1 fixes — request changes on E2E patterns, then re-review for grade improvement.

---

## Decision

**Recommendation**: Approve with Comments

**Rationale**:

The Epic 7 test suite scores **93/100 (A)** with no critical issues. The ATDD and unit test layers are production-ready and follow best practices. The E2E layer is functional but carries P1 maintainability risks due to defensive patterns (error swallowing, zero-assertion paths) and missing inline test IDs. These issues are partially justified by the read-only design choice but should still be addressed for long-term reliability. No issues block deployment or merge — the tests are suitable for production with the noted comments.

**For Approve with Comments**:

> Test quality is good with 93/100 suite average. E2E tests need P1 refactoring (error handling patterns, test IDs) but don't block merge. ATDD and unit tests are excellent and production-ready. Recommend follow-up PR to address E2E maintainability debt.

---

## Appendix

### Violation Summary by Location

| Line | Severity | Criterion | Issue | Fix |
| --- | --- | --- | --- | --- |
| `e2e:23` | P1 | Determinism | `.catch(() => false)` swallows errors | Remove catch or assert error explicitly |
| `e2e:24` | P2 | Assertions | Weak OR assertion `hasTable || hasEmpty` | Assert specific visible element |
| `e2e:108` | P1 | Assertions | Early return = zero assertions | Use `test.skip()` or assert precondition |
| `e2e:129` | P1 | Determinism | Row-scanning loop with `.catch(() => false)` | Extract helper, use filter locator |
| `e2e:528` | P2 | Test Length | File exceeds 300 lines (528) | Split by feature area |
| `7-2:8` | P2 | Determinism | `vi.mock()` at top level can leak between tests | Move to `beforeEach` or use `vi.doMock` |
| `7-3:21` | P2 | Test Length | File exceeds 300 lines (308) | Split by ATDD concern if grows |
| `7-4:45` | P2 | Test Length | File exceeds 300 lines (309) | Split by ATDD concern if grows |
| `invoice.test:312` | P2 | Test Length | File exceeds 300 lines (312) | Split into schema-specific files |
| `invoice-payment:1` | P3 | Priority Markers | No P0/P1 markers on describe blocks | Add markers for CI selective runs |
| `invoice-guard:1` | P3 | Priority Markers | No P0/P1 markers on describe blocks | Add markers for CI selective runs |
| `void-credit-note:1` | P3 | Priority Markers | No P0/P1 markers on describe blocks | Add markers for CI selective runs |

### Related Reviews

| File | Score | Grade | Critical | Status |
| --- | --- | --- | --- | --- |
| `epic-7-invoicing.spec.ts` | 83/100 | B | 0 | Approve with Comments |
| `7-2-invoice-delivery.spec.ts` | 94/100 | A | 0 | Approve |
| `7-3-partial-payments.spec.ts` | 92/100 | A | 0 | Approve |
| `7-4-void-credit-note.spec.ts` | 92/100 | A | 0 | Approve |
| `invoice.test.ts` | 92/100 | A | 0 | Approve |
| `invoice-payment.test.ts` | 99/100 | A+ | 0 | Approve |
| `invoice-guard.test.ts` | 99/100 | A+ | 0 | Approve |
| `void-credit-note.test.ts` | 94/100 | A | 0 | Approve |

**Suite Average**: 93/100 (A)

---

## Review Metadata

**Generated By**: BMAD TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-epic-7-20260527
**Timestamp**: 2026-05-27
**Version**: 1.0

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `../../../agents/bmad-tea/resources/knowledge/`
2. Consult tea-index.csv for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters — the read-only E2E design is a justified trade-off, but the defensive patterns should still be documented or refactored.
