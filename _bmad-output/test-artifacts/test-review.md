---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation']
lastStep: 'step-03-quality-evaluation'
lastSaved: '2026-04-23'
workflowType: 'testarch-test-review'
inputDocuments:
  - 'playwright.config.ts'
  - 'apps/web/vitest.config.ts'
  - 'packages/auth/vitest.config.ts'
  - 'packages/db/vitest.config.ts'
  - 'packages/shared/vitest.config.ts'
  - 'packages/types/vitest.config.ts'
  - 'packages/tokens/vitest.config.ts'
  - 'packages/ui/vitest.config.ts'
  - 'packages/test-utils/vitest.config.ts'
---

# Test Quality Review: Flow OS Suite

**Quality Score**: 50/100 (Needs Improvement)
**Review Date**: 2026-04-23
**Review Scope**: Suite (~90+ test files across monorepo)
**Reviewer**: TEA Agent (Murat)
**Files Deep-Reviewed**: 29 representative files

---

## Executive Summary

**Overall Assessment**: Needs Improvement

**Recommendation**: Request Changes

### Key Strengths

✅ Package-layer unit tests (db, shared, types) properly import and test real production code
✅ UI component tests use React Testing Library with proper providers and accessibility assertions
✅ No `waitForTimeout` or `sleep()` calls found anywhere in the test suite
✅ Most files stay well under the 300-line limit
✅ Test isolation is generally good — no cross-test state leakage detected

### Key Weaknesses

❌ **CRITICAL**: 5 files reimplement production logic inline instead of importing real modules (RBAC, middleware, UA parsing)
❌ **CRITICAL**: All 3 ATDD tests are tautological — zero production code is exercised
❌ 4 files contain `expect(CONSTANT).toBe(CONSTANT)` assertions that always pass
❌ Integration layer has only 2 files, both testing empty workspace state only
❌ E2E `settings.spec.ts` has 8 conditional skip blocks indicating broken auth fixture

### Summary

The Flow OS test suite has a solid foundation in the packages layer where unit tests properly import and verify real code. However, the ATDD layer is fundamentally broken — all 3 files labeled as acceptance tests are actually unit-level schema/constant validations that never exercise production code. The integration layer is dangerously thin (2 files, empty state only), providing no real RLS validation. The E2E layer works but has authentication reliability issues in the settings spec. The fastest path to improved quality is (1) deleting tautological tests, (2) rewriting ATDD files to test through server actions or API routes, and (3) adding seeded integration tests for RLS validation.

---

## Quality Criteria Assessment

| Criterion | Status | Violations | Notes |
|---|---|---|---|
| Hard Waits (sleep, waitForTimeout) | ✅ PASS | 0 | No instances found across entire suite |
| Determinism (no conditionals) | ⚠️ WARN | 5 files | `if/else` in settings.spec.ts (8x), profile.test.ts (5x), device-trust.test.ts (1x), update-profile.test.ts (3x) |
| Isolation (cleanup, no shared state) | ✅ PASS | 0 | Tests appear properly isolated |
| Fixture Patterns | ⚠️ WARN | 3 files | workspace-shell.test.ts manually manages DOM lifecycle |
| Data Factories | ⚠️ WARN | 7+ files | Hardcoded IDs/emails instead of generated data |
| Network-First Pattern | ✅ PASS | N/A | E2E tests use proper waitFor patterns |
| Explicit Assertions | ❌ FAIL | 4 files | Tautological `expect(CONST).toBe(CONST)` in ATDD/middleware/device tests |
| Test Length (≤300 lines) | ⚠️ WARN | 1 file | auth/device-trust.test.ts at 324 lines |
| Test Level Appropriateness | ❌ FAIL | 5 files | ATDD tests are unit-level; "concurrency" tests test JS runtime |
| Reimplemented Logic | ❌ FAIL | 5 files | Production code rewritten inline instead of imported |

**Total Violations**: 3 Critical, 5 High, 6 Medium, 2 Low

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     3 × 10 = -30
High Violations:         5 × 5 = -25
Medium Violations:       6 × 2 = -12
Low Violations:          2 × 1 = -2

Bonus Points:
  No Hard Waits:         +5
  Good Isolation:        +5
  Package Unit Tests:    +5
  RTL Component Tests:   +5
                         --------
Total Bonus:             +20

Final Score:             51/100
Grade:                   Needs Improvement
```

---

## Critical Issues (Must Fix)

### 1. Reimplemented Production Logic — Tests Pass Even When Code Breaks

**Severity**: P0 (Critical)
**Location**: 5 files
**Criterion**: Explicit Assertions / Test Level Appropriateness
**Knowledge Base**: [test-quality.md]

**Issue Description**:
Five test files copy production logic into the test file instead of importing and testing the real implementation. If the production code changes, these tests still pass, providing false confidence.

**Affected Files**:
- `apps/web/__tests__/atdd/story-1.3-magic-link-auth.test.ts:35-43` — reimplements `checkRateLimit()`
- `apps/web/__tests__/workspace-rbac.test.ts:23-26` — reimplements RBAC permission checks
- `apps/web/__tests__/middleware.test.ts:4-11` — reimplements `shouldSkip()` middleware logic
- `apps/web/__tests__/device-trust.test.ts:40-67` — reimplements `parseUserAgent()` (67 lines!)
- `apps/web/__tests__/atdd/story-1.7-dashboard.test.ts` — tests hardcoded constants, no production code

**Recommended Fix**:
```typescript
// ❌ Bad (current) — logic reimplemented in test
const canViewSessions = role === 'owner';
expect(canViewSessions).toBe(true);

// ✅ Good — import and test real module
import { checkPermission } from '@flow/auth';
expect(checkPermission(role, 'sessions:view')).toBe(true);
```

---

### 2. Tautological ATDD Tests — Zero Production Code Exercised

**Severity**: P0 (Critical)
**Location**: `apps/web/__tests__/atdd/` (all 3 files)
**Criterion**: Test Level Appropriateness
**Knowledge Base**: [test-levels-framework.md]

**Issue Description**:
All 3 ATDD files define constants inline and then assert those constants against themselves. No production modules are imported or tested. These tests provide zero regression protection.

**Examples**:
- `story-1.7-dashboard.test.ts:23-24` — `expect(DASHBOARD_LOAD_BUDGET_MS).toBe(3000)` where the constant was just defined as `3000`
- `story-1.10-day1-wizard.test.ts:35-36` — `expect(WIZARD_BUDGET_MS).toBe(300000)` — tautology
- `story-1.3-magic-link-auth.test.ts:82-84` — `expect(TRUSTED_SESSION_MS).toBe(604800000)` — derived from same arithmetic

**Recommended Fix**:
Rewrite as true acceptance tests that exercise server actions or API routes:
```typescript
// ✅ Real ATDD test — imports and invokes production server action
import { sendMagicLink } from '@/app/(auth)/login/actions/send-magic-link';
import { createMockSupabase } from '@flow/test-utils';

it('should rate-limit after 3 magic link requests', async () => {
  const { supabase, mockRpc } = createMockSupabase();
  // First 3 succeed
  for (let i = 0; i < 3; i++) {
    const result = await sendMagicLink({ email: 'test@example.com' }, supabase);
    expect(result.success).toBe(true);
  }
  // 4th is rate-limited
  const result = await sendMagicLink({ email: 'test@example.com' }, supabase);
  expect(result.success).toBe(false);
  expect(result.error).toContain('rate');
});
```

---

### 3. Integration Layer Too Thin — No Real RLS Validation

**Severity**: P0 (Critical)
**Location**: `apps/web/tests/integration/` (2 files)
**Criterion**: Test Level Appropriateness
**Knowledge Base**: [test-levels-framework.md]

**Issue Description**:
Only 2 integration test files exist, and both test empty workspace state only. No seeded data (clients, invoices, approvals) is tested. The `dashboard-rls.integration.test.ts` file compares two empty workspace arrays and concludes RLS works — this provides no real validation.

**Recommended Fix**:
Add integration tests with seeded cross-tenant data:
```typescript
it('should not leak cross-tenant client data', async () => {
  // Seed client in workspace A
  await seedClient(wsA, { name: 'Acme Corp', revenue: 50000 });
  // Query from workspace B
  const { data } = await supabaseB.from('clients').select('*');
  expect(data).toHaveLength(0); // RLS blocks cross-tenant access
});
```

---

## Recommendations (Should Fix)

### 4. Fix E2E Auth Fixture Reliability

**Severity**: P1 (High)
**Location**: `tests/e2e/settings.spec.ts` (8 conditional skips)
**Criterion**: Determinism (no conditionals)
**Knowledge Base**: [test-quality.md]

**Issue**:
Every test in `settings.spec.ts` has `if (url.includes('/login')) { test.skip(); return; }` — 8 instances. This means the `ownerPage` fixture fails to authenticate roughly half the time.

**Fix**: Debug the auth fixture in `tests/e2e/global-setup.ts` to ensure storage state is saved correctly.

---

### 5. Replace Fragile CSS Selectors

**Severity**: P2 (Medium)
**Location**: 2 files
**Criterion**: Selector Resilience
**Knowledge Base**: [selector-resilience.md]

- `packages/ui/src/components/command-palette/command-palette.test.tsx:103` — `.bg-black\\/50`
- `tests/e2e/settings.spec.ts:27` — `.flex-col.lg\\:flex`

**Fix**: Add `data-testid="backdrop"` and `data-testid="settings-layout"` to the components.

---

### 6. Use Generated Test Data

**Severity**: P2 (Medium)
**Location**: 7+ files
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md]

Replace hardcoded `'ws-1'`, `'user-1'`, `'test@test.com'` with `crypto.randomUUID()` and generated emails across:
- `packages/auth/src/__tests__/transfer-executor.test.ts`
- `packages/db/src/rls-helpers.test.ts`
- `packages/types/src/workspace.test.ts`
- `apps/web/__tests__/workspace-concurrency.test.ts`
- `apps/web/app/(workspace)/settings/profile/__tests__/update-profile.test.ts`
- `apps/web/app/(workspace)/settings/team/actions/__tests__/invite-member.test.ts`
- `tests/e2e/auth.spec.ts`

---

### 7. Extract Shared Mock Factories

**Severity**: P2 (Medium)
**Location**: Multiple files
**Criterion**: Fixture Patterns
**Knowledge Base**: [data-factories.md]

`createMockSupabase()` is 33 lines of deeply nested mock setup in `packages/auth/src/__tests__/device-trust.test.ts`. Extract to `packages/test-utils/src/mocks/` for reuse.

---

### 8. Remove Placeholder Test

**Severity**: P3 (Low)
**Location**: `packages/auth/src/__tests__/index.test.ts`
**Criterion**: Explicit Assertions

`expect(true).toBe(true)` — delete and replace with real module export validation.

---

### 9. Fix `if (!result.success)` Pattern

**Severity**: P3 (Low)
**Location**: 5 files
**Criterion**: Determinism (no conditionals)
**Knowledge Base**: [test-quality.md]

Replace:
```typescript
if (!result.success) { expect(result.error).toContain('...'); }
```
With:
```typescript
expect(result.success).toBe(false);
// TypeScript now narrows the type
if (!result.success) {
  expect(result.error).toContain('...');
}
```
This ensures the assertion runs unconditionally and the conditional is only for type narrowing.

---

### 10. Split Oversized File

**Severity**: P3 (Low)
**Location**: `packages/auth/src/__tests__/device-trust.test.ts` (324 lines)
**Criterion**: Test Length (≤300 lines)

Split into `device-trust-core.test.ts` and `device-trust-session.test.ts`.

---

## Best Practices Found

### 1. Dashboard Greeting Component Test

**Location**: `packages/ui/src/components/dashboard/dashboard-greeting.test.tsx`
**Pattern**: Thorough boundary testing with proper fake timer cleanup

This file is the best example in the suite — 13 test cases covering boundary conditions (midnight, leap year, time-of-day greetings), proper `vi.useFakeTimers()` with cleanup, and tests real rendered component behavior.

### 2. Conflict Detection Tests

**Location**: `packages/db/src/queries/undo/conflict-detection.test.ts`
**Pattern**: Clean imports, real function testing

Imports and tests actual production functions with no inline reimplementation. 10 test cases with clear, descriptive names.

### 3. Onboarding Storage Tests

**Location**: `apps/web/__tests__/onboarding/storage.test.ts`
**Pattern**: Proper mocking with `vi.mock`, tests real imported functions

Clean mock setup, tests real `getStepIndex()` and step progression logic.

---

## Test Level Distribution

| Level | Files | Test Cases | Correct? | Gap |
|---|---|---|---|---|
| **ATDD** | 3 | 25 | **NO** | All are unit-level constant/schema tests |
| **Unit** | 19 | ~130 | YES | Packages properly test real code |
| **Component** | 3 | ~34 | YES | RTL with providers |
| **Integration** | 2 | 6 | **PARTIAL** | Only empty state, no seeded data |
| **E2E** | 2 | 15 | **PARTIAL** | Auth fixture unreliable |

**Pyramid Assessment**: The test pyramid is inverted at the ATDD layer. The strongest coverage is in unit tests (packages). The acceptance and integration layers need the most investment.

---

## Appendix: Per-File Scores

| File | Lines | Tests | Rating |
|---|---|---|---|
| `atdd/story-1.3-magic-link-auth.test.ts` | 101 | 10 | NEEDS_IMPROVEMENT |
| `atdd/story-1.7-dashboard.test.ts` | 52 | 4 | POOR |
| `atdd/story-1.10-day1-wizard.test.ts` | 99 | 11 | NEEDS_IMPROVEMENT |
| `workspace-rbac.test.ts` | 191 | 20 | NEEDS_IMPROVEMENT |
| `workspace-concurrency.test.ts` | 116 | 6 | NEEDS_IMPROVEMENT |
| `workspace-invitation.test.ts` | 235 | 16 | GOOD |
| `middleware.test.ts` | 83 | 9 | NEEDS_IMPROVEMENT |
| `device-trust.test.ts` | 108 | 10 | NEEDS_IMPROVEMENT |
| `device-trust-concurrency.test.ts` | 52 | 4 | NEEDS_IMPROVEMENT |
| `auth/__tests__/index.test.ts` | 7 | 1 | POOR |
| `auth/__tests__/device-trust.test.ts` | 324 | 15 | GOOD |
| `auth/__tests__/transfer-executor.test.ts` | 170 | 7 | GOOD |
| `db/__tests__/config.test.ts` | 76 | 4 | GOOD |
| `db/queries/undo/conflict-detection.test.ts` | 169 | 10 | GOOD |
| `db/rls-helpers.test.ts` | 103 | 6 | GOOD |
| `shared/shortcuts/registry.test.ts` | 266 | 25 | GOOD |
| `types/workspace.test.ts` | 204 | 18 | GOOD |
| `types/profile.test.ts` | 132 | 12 | NEEDS_IMPROVEMENT |
| `ui/command-palette.test.tsx` | 134 | 9 | GOOD |
| `ui/dashboard-greeting.test.tsx` | 172 | 13 | EXCELLENT |
| `ui/workspace-shell.test.tsx` | 145 | 12 | GOOD |
| `integration/dashboard-rls.integration.test.ts` | 34 | 2 | NEEDS_IMPROVEMENT |
| `integration/dashboard.integration.happy-path.test.ts` | 55 | 4 | NEEDS_IMPROVEMENT |
| `e2e/auth.spec.ts` | 70 | 7 | GOOD |
| `e2e/settings.spec.ts` | 123 | 6 | NEEDS_IMPROVEMENT |
| `onboarding/storage.test.ts` | 91 | 7 | GOOD |
| `onboarding/steps-config.test.ts` | 104 | 12 | GOOD |
| `update-profile.test.ts` | 95 | 3 | NEEDS_IMPROVEMENT |
| `invite-member.test.ts` | 172 | 6 | GOOD |

**Suite Average**: 51/100 (Needs Improvement)

---

## Decision

**Recommendation**: Request Changes

> Test quality needs improvement with 51/100 score. Three critical issues must be addressed: (1) ATDD tests must be rewritten to exercise real production code, (2) reimplemented inline logic must be replaced with proper imports, and (3) integration tests must add seeded data scenarios. The package-layer unit tests are solid and should be used as the quality standard for rewriting the ATDD layer.

---

## Next Steps

### Immediate Actions (Before Sprint Commitment)

1. **Delete tautological tests** — Remove `expect(CONST).toBe(CONST)` from ATDD and middleware files
2. **Fix ATDD files** — Rewrite to import and test real server actions/modules
3. **Fix settings.spec.ts auth fixture** — Debug the ownerPage fixture to eliminate conditional skips

### Follow-up Actions (Next Sprint)

1. **Add seeded integration tests** — RLS with cross-tenant data, happy path with clients/invoices
2. **Extract shared mock factories** — `createMockSupabase()` to test-utils package
3. **Replace hardcoded test data** — Use `crypto.randomUUID()` and faker across 7+ files

---

## Review Metadata

**Generated By**: BMad TEA Agent (Murat)
**Workflow**: testarch-test-review v4.0
**Review ID**: test-review-suite-20260423
**Timestamp**: 2026-04-23
**Version**: 1.0
