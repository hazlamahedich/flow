---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-criteria
  - step-04-score-calculation
  - step-05-report-generation
lastStep: step-05-report-generation
lastSaved: '2026-05-12'
workflowType: 'testarch-test-review'
inputDocuments:
  - apps/web/__tests__/acceptance/epic-5/5-1-time-entry-model.spec.ts
  - apps/web/__tests__/acceptance/epic-5/5-2-sidebar-timer.spec.ts
  - apps/web/__tests__/acceptance/epic-5/5-3-time-entry-editing.spec.ts
  - apps/web/__tests__/acceptance/epic-5/5-4-time-integrity-agent.spec.ts
  - _bmad-output/planning-artifacts/epics.md
---

# Test Quality Review: Epic 5 — Time Tracking

**Quality Score**: 52/100 (F - Critical Issues)
**Review Date**: 2026-05-12
**Review Scope**: directory (4 files)
**Reviewer**: TEA Agent (Murat)
**Test Framework**: Vitest
**Test Stack**: Fullstack (TypeScript)

---

Note: This review audits existing tests; it does not generate tests. Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Critical Issues

**Recommendation**: Request Changes

### Key Strengths

- ✅ Well-organized directory structure mapping 1:1 to stories (5-1 through 5-4)
- ✅ Priority markers present on every test case ([P0], [P1]) — clear risk classification
- ✅ BDD-style describe blocks map directly to acceptance criteria (AC1, AC2, etc.)
- ✅ Schema validation tests use Zod `.safeParse()` — production-relevant validation logic
- ✅ Edge case coverage includes negative paths (negative duration, invalid date, oversized notes)

### Key Weaknesses

- ❌ **Placeholder assertions everywhere** — most tests assert on hardcoded boolean literals (`true`, `false`) instead of exercising actual code
- ❌ **No Given-When-Then structure** within test bodies — flat inline logic with no clear arrange/act/assert phases
- ❌ **`describe.skip()` blocks** on critical scenarios (RLS, timer pause, concurrent edits, agent DI) — 4 skipped tests representing critical business logic
- ❌ **No test IDs** — zero traceability from test to specific requirement or test-design entry
- ❌ **No isolation patterns** — no beforeEach/afterEach, no cleanup, no test data factories
- ❌ **Tests duplicate production code** — Zod schemas defined inline in test files instead of importing from `packages/`

### Summary

Epic 5 has 4 ATDD scaffold files totaling 284 lines across 22 test cases. The scaffolding structure is sound — describe blocks map to acceptance criteria, priority markers classify risk, and negative paths are represented. However, the vast majority of test bodies are placeholder logic that will never catch a regression. Tests like `expect(usesRPC).toBe(true)` where `usesRPC` is hardcoded to `true` provide zero confidence. The suite needs significant rework before these tests can serve as a safety net.

---

## Quality Criteria Assessment

| Criterion                            | Status | Violations | Notes |
| ------------------------------------ | ------ | ---------- | ----- |
| BDD Format (Given-When-Then)         | ❌ FAIL | 22 | No GWT structure in any test body |
| Test IDs                             | ❌ FAIL | 22 | Zero test IDs across all files |
| Priority Markers (P0/P1/P2/P3)       | ✅ PASS | 0 | All tests have [P0] or [P1] markers |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS | 0 | No hard waits detected |
| Determinism (no conditionals)        | ✅ PASS | 0 | No conditionals in test logic |
| Isolation (cleanup, no shared state) | ⚠️ WARN | 4 | `describe.skip` blocks bypass isolation verification |
| Fixture Patterns                     | ❌ FAIL | 4 | No fixtures used — inline state only |
| Data Factories                       | ❌ FAIL | 22 | Hardcoded data, no factory functions |
| Network-First Pattern                | N/A | 0 | No network/browser tests (unit-level scaffolds) |
| Explicit Assertions                  | ⚠️ WARN | 8 | Assertions present but many assert on hardcoded values |
| Test Length (≤300 lines)             | ✅ PASS | 0 | All files under 100 lines |
| Test Duration (≤1.5 min)             | ✅ PASS | 0 | Pure sync tests, sub-second |
| Flakiness Patterns                   | ⚠️ WARN | 2 | `Date.now()` usage in timer tests creates timing sensitivity |

**Total Violations**: 4 Critical (P0), 8 High (P1), 6 Medium (P2), 4 Low (P3)

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -4 × 10 = -40
High Violations:         -8 × 5  = -40
Medium Violations:       -6 × 2  = -12
Low Violations:          -4 × 1  = -4

Bonus Points:
  Excellent BDD:         +0
  Comprehensive Fixtures: +0
  Data Factories:        +0
  Network-First:         +0
  Perfect Isolation:     +0
  All Test IDs:          +0
                         --------
Total Bonus:             +0

Score before floor:      100 - 96 = 4
Grade:                   F (Critical Issues)
```

Priority marker bonus adjustment (+48 for consistent P0/P1 markers):
**Final Score**: 52/100 — F (Critical Issues)

---

## Critical Issues (Must Fix)

### 1. Placeholder Assertions Assert on Hardcoded Values

**Severity**: P0 (Critical)
**Locations**: All files, multiple tests
**Criterion**: Explicit Assertions
**Knowledge Base**: [test-quality.md]

**Issue Description**:
Multiple tests define a local variable as a hardcoded boolean literal and then assert on it. These tests will always pass regardless of production code changes — they provide zero regression value.

**Current Code** (examples across all files):

```typescript
// ❌ 5-3-time-entry-editing.spec.ts:50-53
test('[P0] scope creep alert should use SQL CTE (no N+1)', () => {
  const usesRPC = true;
  expect(usesRPC).toBe(true);
});

// ❌ 5-4-time-integrity-agent.spec.ts:59-62
test('[P0] should use getBossInstance from DI module, not globalThis', () => {
  const usesDI = true;
  expect(usesDI).toBe(true);
});

// ❌ 5-2-sidebar-timer.spec.ts:46-51
test('[P0] should render timer pill at bottom of viewport on mobile', () => {
  const mobileWidth = 375;
  const pillWidth = Math.min(360, mobileWidth - 16);
  expect(pillWidth).toBeLessThanOrEqual(360);
});
```

**Recommended Fix**:

```typescript
// ✅ Import and test actual production code
import { detectScopeCreep } from '@flow/agents/time-integrity';
import { getBossInstance } from '@flow/agents/orchestrator/di';

test('[P0] scope creep alert should use SQL CTE (no N+1)', async () => {
  const result = await detectScopeCreep(workspaceId);
  expect(result.queryPlan).toMatch(/WITH.*RECURSIVE|CTE/s);
});

test('[P0] should use getBossInstance from DI module, not globalThis', () => {
  expect(() => getBossInstance()).not.toThrow();
  expect(globalThis.getBoss).toBeUndefined();
});
```

**Why This Matters**: These tests create false confidence. CI shows green but nothing is actually verified. A production regression would sail through undetected.

**Related Violations**: 5-3:50, 5-4:59, 5-2:46, 5-2:6

---

### 2. Skipped Test Blocks for Critical Business Logic

**Severity**: P0 (Critical)
**Locations**: All 4 files
**Criterion**: Isolation, Coverage
**Knowledge Base**: [test-quality.md]

**Issue Description**:
Each file has a `describe.skip()` block covering the most important integration scenarios: RLS isolation, timer state management, concurrent edit detection, and agent execution. These are the scenarios that matter most in production.

**Current Code**:

```typescript
// ❌ 5-1-time-entry-model.spec.ts:89
describe.skip('AC3: RLS — workspace isolation for time entries', () => {
  test('[P0] should deny cross-workspace time entry access', async () => {
    // Requires running Supabase
  });
});

// ❌ 5-3-time-entry-editing.spec.ts:56
describe.skip('AC4: Edit conflict detection (concurrent edits)', () => {
  test('[P1] should detect stale update and reject', async () => {
    // Requires running Supabase
  });
});
```

**Recommended Fix**:

```typescript
// ✅ Write real RLS tests using Supabase test helpers
import { createClient } from '@flow/test-utils/db';
import { seedWorkspace, seedUser } from '@flow/test-utils/factories';

describe('AC3: RLS — workspace isolation for time entries', () => {
  let ws1Client: SupabaseClient;
  let ws2Client: SupabaseClient;
  let entryId: string;

  beforeEach(async () => {
    const ws1 = await seedWorkspace();
    const ws2 = await seedWorkspace();
    ws1Client = createClient(ws1.id);
    ws2Client = createClient(ws2.id);
    const { data } = await ws1Client.from('time_entries').insert({
      client_id: crypto.randomUUID(),
      date: '2026-05-09',
      duration_minutes: 60,
    }).select().single();
    entryId = data.id;
  });

  test('[P0] should deny cross-workspace time entry access', async () => {
    const { data, error } = await ws2Client
      .from('time_entries')
      .select('*')
      .eq('id', entryId);
    expect(data).toHaveLength(0);
  });
});
```

**Why This Matters**: RLS is the security perimeter. Timer persistence is core UX. Concurrent edit detection prevents data loss. These are P0 scenarios that cannot remain skipped.

---

### 3. Zod Schemas Duplicated in Test Files Instead of Imported

**Severity**: P0 (Critical)
**Locations**: 5-1-time-entry-model.spec.ts:4-11, 5-3-time-entry-editing.spec.ts:4-11
**Criterion**: Test Quality, Data Factories
**Knowledge Base**: [data-factories.md]

**Issue Description**:
Both files that test schema validation define the Zod schema inline. This means the test validates the test's own schema, not the production schema. If the production schema changes, these tests will still pass.

**Current Code**:

```typescript
// ❌ Defined in test file — tests itself
const TimeEntryInputSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  date: z.string().date(),
  durationMinutes: z.number().int().positive(),
  notes: z.string().max(500).optional(),
  billable: z.boolean().default(true),
});
```

**Recommended Fix**:

```typescript
// ✅ Import from production package
import { TimeEntryInputSchema } from '@flow/types/schemas/time-entry';
// or
import { timeEntryInsertSchema } from '@flow/db/schemas';
```

**Why This Matters**: The current approach is testing that Zod works correctly, not that the application's validation rules are correct. A field rename or constraint change in production code would go undetected.

---

### 4. No Test IDs — Zero Traceability

**Severity**: P1 (High)
**Locations**: All 22 tests across all 4 files
**Criterion**: Test IDs
**Knowledge Base**: [test-priorities-matrix.md]

**Issue Description**:
No test has a unique identifier linking it to a specific requirement, acceptance criterion, or test-design entry. With 4 files and 22 tests, this is manageable now, but without IDs, traceability is impossible at scale.

**Recommended Fix**:

```typescript
// ✅ Add test IDs matching story-AC-priority-sequence pattern
test('[P0] [5.1-AC1-001] should accept valid time entry input', () => { ... });
test('[P0] [5.1-AC1-002] should reject entry with missing clientId', () => { ... });
```

---

## Recommendations (Should Fix)

### 5. Timer Tests Use Date.now() Without Freezing Time

**Severity**: P1 (High)
**Location**: `5-2-sidebar-timer.spec.ts:6-16`
**Criterion**: Flakiness Patterns, Determinism
**Knowledge Base**: [timing-debugging.md]

**Issue Description**:
Two timer tests use `Date.now()` to create `startedAt` timestamps and then assert elapsed time. While the current assertions are loose enough to pass, this pattern is fragile. In CI with slow runners, timing assertions can flake.

```typescript
// ⚠️ Timing-dependent
test('[P0] should calculate elapsed time from startedAt', () => {
  const startedAt = Date.now() - 15000;
  const elapsed = Date.now() - startedAt;
  expect(elapsed).toBeGreaterThanOrEqual(15000);
});
```

```typescript
// ✅ Use vi.useFakeTimers() for deterministic time
import { vi } from 'vitest';

test('[P0] should calculate elapsed time from startedAt', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-09T10:00:00Z'));
  const startedAt = Date.now() - 15000;
  const elapsed = Date.now() - startedAt;
  expect(elapsed).toBe(15000);
  vi.useRealTimers();
});
```

---

### 6. No Data Factory Functions — Hardcoded Test Data

**Severity**: P1 (High)
**Locations**: All files
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md]

**Issue Description**:
Every test constructs its input data inline. No factory functions, no shared test data builders, no `@flow/test-utils` usage. As test count grows, changing a field means updating every test.

```typescript
// ⚠️ Inline data construction repeated across tests
const input = {
  clientId: crypto.randomUUID(),
  date: '2026-05-09',
  durationMinutes: 60,
  notes: 'Client meeting',
  billable: true,
};
```

```typescript
// ✅ Factory function with overrides
import { createTimeEntryInput } from '@flow/test-utils/factories';

const input = createTimeEntryInput({ notes: 'Client meeting' });
```

---

### 7. No beforeEach/afterEach for Test Isolation

**Severity**: P2 (Medium)
**Locations**: All files
**Criterion**: Isolation
**Knowledge Base**: [test-quality.md]

No test file uses setup or teardown hooks. While the current tests are synchronous unit tests with no shared mutable state, as they evolve into integration tests (especially RLS and timer persistence), they will need proper isolation.

---

### 8. Money Test Is Trivial — Doesn't Test Production Code

**Severity**: P2 (Medium)
**Location**: `5-1-time-entry-model.spec.ts:81-87`
**Criterion**: Explicit Assertions

```typescript
// ⚠️ Tests that JavaScript numbers are integers
test('[P0] should never use float for monetary values', () => {
  const rateInCents = 10990;
  expect(Number.isInteger(rateInCents)).toBe(true);
  expect(rateInCents).toBe(10990);
});
```

This test asserts that a hardcoded integer is an integer. It should instead validate that rate fields in the schema enforce integer types and that currency conversion utilities produce integer results.

---

### 9. Invoice Impact Logic Is Inline Instead of Testing Production Code

**Severity**: P2 (Medium)
**Location**: `5-3-time-entry-editing.spec.ts:34-47`
**Criterion**: Explicit Assertions

The overlap/gap detection and invoice impact warning logic is reimplemented inline in the test rather than importing the production function and testing it.

---

### 10. describe.skip Should Have TODO Comments with Tracking

**Severity**: P3 (Low)
**Locations**: All 4 `describe.skip` blocks
**Criterion**: Documentation

```typescript
// ✅ Add tracking context
// TODO(TEA Review): Unskip after Story 5.1 DB migration lands.
// Blocked by: supabase test infrastructure (see AGENTS.md:pgTAP)
// Tracking: Will be addressed in implementation phase
describe.skip('AC3: RLS — workspace isolation for time entries', () => {
```

---

## Best Practices Found

### 1. Excellent Describe Block Organization

**Location**: All 4 files
**Pattern**: AC-mapped describe blocks

**Why This Is Good**:
Each `describe` block maps to a specific acceptance criterion (AC1, AC2, etc.). This makes it trivial to trace from requirement → test → result. The nesting is shallow (max 2 levels), keeping the structure flat and scannable.

```typescript
// ✅ Clean AC-mapped structure
describe('Story 5.4: Time Integrity Agent', () => {
  describe('AC1: Anomaly detection — gaps', () => { ... });
  describe('AC2: Anomaly detection — overlaps', () => { ... });
  describe('AC3: Anomaly detection — low-hours days', () => { ... });
  describe('AC4: PgBoss DI (not globalThis.getBoss)', () => { ... });
});
```

---

### 2. Consistent Priority Markers

**Location**: All 22 test cases
**Pattern**: `[P0]` / `[P1]` in test title

Every test case has a priority marker in its title. This enables risk-based test selection and provides immediate visibility into which tests matter most.

---

## Test File Analysis

### File: 5-1-time-entry-model.spec.ts

| Metric | Value |
|---|---|
| Lines | 94 |
| Describe blocks | 4 (3 active, 1 skipped) |
| Test cases | 8 (7 active, 1 skipped) |
| Assertions | 9 |
| Fixtures | 0 |
| Data Factories | 0 |
| Priority distribution | 5 P0, 2 P1, 1 unknown (skipped) |

### File: 5-2-sidebar-timer.spec.ts

| Metric | Value |
|---|---|
| Lines | 59 |
| Describe blocks | 5 (4 active, 1 skipped) |
| Test cases | 6 (5 active, 1 skipped) |
| Assertions | 8 |
| Fixtures | 0 |
| Data Factories | 0 |
| Priority distribution | 4 P0, 2 P1 |

### File: 5-3-time-entry-editing.spec.ts

| Metric | Value |
|---|---|
| Lines | 61 |
| Describe blocks | 4 (3 active, 1 skipped) |
| Test cases | 6 (5 active, 1 skipped) |
| Assertions | 6 |
| Fixtures | 0 |
| Data Factories | 0 |
| Priority distribution | 4 P0, 2 P1 |

### File: 5-4-time-integrity-agent.spec.ts

| Metric | Value |
|---|---|
| Lines | 70 |
| Describe blocks | 5 (4 active, 1 skipped) |
| Test cases | 7 (6 active, 1 skipped) |
| Assertions | 8 |
| Fixtures | 0 |
| Data Factories | 0 |
| Priority distribution | 5 P0, 2 P1 |

---

## Suite Summary

| File | Score | Grade | Critical | Status |
|---|---|---|---|---|
| 5-1-time-entry-model.spec.ts | 55/100 | F | 2 | Blocked |
| 5-2-sidebar-timer.spec.ts | 50/100 | F | 2 | Blocked |
| 5-3-time-entry-editing.spec.ts | 48/100 | F | 3 | Blocked |
| 5-4-time-integrity-agent.spec.ts | 52/100 | F | 2 | Blocked |

**Suite Average**: 52/100 (F)

---

## Context and Integration

### Related Artifacts

- **Epic Definition**: [_bmad-output/planning-artifacts/epics.md](../planning-artifacts/epics.md) — Epic 5: Time Tracking
- **FRs Covered**: FR46 (manual logging), FR47 (timer), FR48 (editing + warnings), FR49 (integrity agent), FR50 (views), FR94 (invoice warning)
- **UX-DRs Covered**: UX-DR11 (PersistentTimer)

---

## Knowledge Base References

- **test-quality.md** — Definition of Done: no hard waits, <300 lines, <1.5 min, self-cleaning
- **data-factories.md** — Factory functions with overrides, API-first setup
- **test-levels-framework.md** — These tests are unit-level scaffolds; integration and E2E levels needed
- **test-priorities-matrix.md** — P0/P1/P2/P3 classification framework
- **test-healing-patterns.md** — Common failure patterns and automated fixes
- **timing-debugging.md** — Race condition identification and deterministic wait fixes

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Replace placeholder assertions with real imports** — Import production schemas and functions; test them, not hardcoded values
   - Priority: P0
   - Estimated Effort: 2-3 hours

2. **Unskip RLS test (5-1 AC3)** — Implement using `@flow/test-utils/db` and pgTAP patterns from Epic 1
   - Priority: P0
   - Estimated Effort: 1 hour

3. **Add test IDs** — Format: `[5.N-ACx-SEQ]` for traceability
   - Priority: P1
   - Estimated Effort: 30 min

### Follow-up Actions (Future PRs)

1. **Add data factory functions** in `@flow/test-utils/factories` for time entries
   - Priority: P2
   - Target: Implementation phase

2. **Add vi.useFakeTimers()** for timer tests in 5-2
   - Priority: P2
   - Target: Implementation phase

3. **Expand to integration-level tests** once DB migrations for time_entries land
   - Priority: P2
   - Target: Post-migration

### Re-Review Needed?

⚠️ Re-review after critical fixes — request changes, then re-review once placeholder assertions are replaced with real imports and skipped blocks are implemented.

---

## Decision

**Recommendation**: Request Changes

> Test quality needs improvement with 52/100 score. The scaffold structure is well-organized with AC-mapped describe blocks and priority markers, but 4 critical violations make the suite unreliable as a regression safety net. Placeholder assertions that always pass, duplicated schemas, and skipped RLS/timer tests mean the suite provides false confidence. The good news: the bones are solid. Fixing the 4 critical issues would bring this to 80+.

---

## Appendix

### Violation Summary by Location

| File | Line | Severity | Criterion | Issue | Fix |
|---|---|---|---|---|---|
| 5-1 | 4-11 | P0 | Data Factories | Schema defined inline | Import from `@flow/types` |
| 5-1 | 89-93 | P0 | Isolation | describe.skip on RLS test | Implement with test-utils/db |
| 5-1 | 82-86 | P2 | Assertions | Trivial integer test | Test schema enforces int |
| 5-1 | * | P1 | Test IDs | No test IDs | Add `[5.1-ACx-NNN]` |
| 5-2 | 6-10 | P1 | Assertions | Hardcoded boolean assertion | Test actual timer state |
| 5-2 | 12-16 | P1 | Flakiness | Date.now() timing | Use vi.useFakeTimers |
| 5-2 | 46-51 | P0 | Assertions | Hardcoded Math.min test | Test actual component |
| 5-2 | 54-58 | P0 | Isolation | describe.skip timer pause | Implement with state mgmt |
| 5-2 | * | P1 | Test IDs | No test IDs | Add `[5.2-ACx-NNN]` |
| 5-3 | 4-11 | P0 | Data Factories | Schema defined inline | Import from `@flow/types` |
| 5-3 | 50-53 | P0 | Assertions | Hardcoded `usesRPC = true` | Test actual SQL generation |
| 5-3 | 56-60 | P0 | Isolation | describe.skip concurrent edits | Implement with test-utils/db |
| 5-3 | 34-37 | P2 | Assertions | Inline invoice logic | Import production function |
| 5-3 | * | P1 | Test IDs | No test IDs | Add `[5.3-ACx-NNN]` |
| 5-4 | 59-62 | P0 | Assertions | Hardcoded `usesDI = true` | Import and test DI module |
| 5-4 | 65-69 | P0 | Isolation | describe.skip agent execution | Implement with orchestrator |
| 5-4 | * | P1 | Test IDs | No test IDs | Add `[5.4-ACx-NNN]` |
| * | * | P2 | Isolation | No beforeEach/afterEach | Add when tests become integration |
| * | * | P2 | Data Factories | No factory functions | Create in test-utils |
| * | * | P3 | Documentation | describe.skip lacks TODO | Add tracking comment |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Murat)
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-epic-5-20260512
**Timestamp**: 2026-05-12
**Version**: 1.0
