---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-04-26'
workflowType: testarch-atdd
storyId: '3'
storyKey: 'epic-3-client-management'
storyFile: '_bmad-output/planning-artifacts/epics.md'
atddChecklistPath: '_bmad-output/implementation-artifacts/atdd-checklist-epic-3-client-management.md'
generatedTestFiles:
  - 'apps/web/__tests__/acceptance/epic-3/3-1-client-data-model-crud.spec.ts'
  - 'apps/web/__tests__/acceptance/epic-3/3-2-retainer-agreements-scope-creep-detection.spec.ts'
  - 'apps/web/__tests__/acceptance/epic-3/3-3-new-client-setup-wizard.spec.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - 'docs/project-context.md'
---

# ATDD Checklist — Epic 3: Client Management

**Date:** 2026-04-26
**Primary Test Level:** Unit (Vitest) + Integration (Supabase) + E2E (Playwright)

---

## Story Summary

Client CRUD, contact details, service agreements, billing preferences, health indicators, archive/restore, team member scoping, retainer agreements (hourly/flat/package), scope-creep detection at 90%, New Client Setup wizard (under 5 minutes).

**Stories covered:**
- 3.1: Client Data Model & CRUD
- 3.2: Retainer Agreements & Scope Creep Detection
- 3.3: New Client Setup Wizard

**FRs covered:** FR11, FR12, FR13, FR14, FR16, FR73a, FR73c, FR73e
**UX-DRs covered:** UX-DR25

---

## Red-Phase Test Scaffolds Created

### Story 3.1: Client Data Model & CRUD (34 tests)

**File:** `apps/web/__tests__/acceptance/epic-3/3-1-client-data-model-crud.spec.ts`

| # | Test | Priority | Status |
|---|------|----------|--------|
| 1 | should define client schema with contact details, service agreements, and billing preferences | P0 | passing |
| 2 | should enforce workspace_id as required on every client record | P0 | passing |
| 3 | should validate client name is non-empty and within length limit | P0 | passing |
| 4 | should validate email format on client contact details | P1 | passing |
| 5 | should validate phone number format (optional field) | P1 | passing |
| 6 | should create a client record via Server Action with RLS enforcement | P0 | skipped |
| 7 | should reject client creation from unauthenticated user | P0 | skipped |
| 8 | should reject client creation from user not in workspace | P1 | skipped |
| 9 | should define health indicator enum values | P0 | passing |
| 10 | should support filter parameters for client list queries | P0 | passing |
| 11 | should support sortable columns for client list | P1 | passing |
| 12 | should return paginated client list scoped to workspace via RLS | P0 | skipped |
| 13 | should filter clients by status (active/archived) | P1 | skipped |
| 14 | should sort clients by name, created_at, health indicator | P1 | skipped |
| 15 | should define mutable client fields for editing | P0 | passing |
| 16 | should not allow editing workspace_id (immutable tenant binding) | P0 | passing |
| 17 | should reflect client edits across associated invoices | P0 | skipped |
| 18 | should reflect client edits across associated reports | P0 | skipped |
| 19 | should reflect client edits across associated time entries | P1 | skipped |
| 20 | should use revalidateTag() to invalidate client-related caches | P1 | skipped |
| 21 | should define archived status value distinct from active | P0 | passing |
| 22 | should preserve all historical data on archive | P0 | passing |
| 23 | should set client status to archived without deleting the record | P0 | skipped |
| 24 | should exclude archived clients from default list views | P0 | skipped |
| 25 | should allow restoring an archived client to active status | P1 | skipped |
| 26 | should preserve invoices, reports, and time entries after archival | P1 | skipped |
| 27 | should define member-client access relation schema | P0 | passing |
| 28 | should associate a team member with a client for access scoping | P0 | skipped |
| 29 | should restrict client visibility to associated team members via RLS | P0 | skipped |
| 30 | should allow Admin/Owner to see all clients regardless of association | P1 | skipped |
| 31 | should allow multiple team members per client | P1 | skipped |
| 32 | should remove access when team member association is deleted | P2 | skipped |
| 33 | should define empty state CTA message for no clients | P0 | passing |
| 34 | should define meaningful empty state messages per client sub-section | P1 | passing |
| 35 | should render empty state CTA when workspace has no clients | P0 | skipped |
| 36 | should enforce workspace_id ::text cast in client RLS policies | P0 | skipped |
| 37 | should prevent cross-workspace client access | P0 | skipped |
| 38 | should audit client CRUD operations in audit_log | P1 | skipped |

### Story 3.2: Retainer Agreements & Scope Creep Detection (28 tests)

**File:** `apps/web/__tests__/acceptance/epic-3/3-2-retainer-agreements-scope-creep-detection.spec.ts`

| # | Test | Priority | Status |
|---|------|----------|--------|
| 1 | should define hourly rate retainer type | P0 | passing |
| 2 | should define flat monthly fee retainer type | P0 | passing |
| 3 | should define package-based retainer type | P0 | passing |
| 4 | should define retainer schema with required fields | P0 | passing |
| 5 | should store money values as integers in cents | P0 | passing |
| 6 | should validate hourly_rate_cents is non-negative integer | P1 | passing |
| 7 | should validate flat_fee_cents is non-negative integer | P1 | passing |
| 8 | should validate package_hours is positive number | P1 | passing |
| 9 | should require period_start and period_end for retainer | P1 | passing |
| 10 | should create retainer agreement scoped to client and workspace via Server Action | P0 | skipped |
| 11 | should reject retainer creation for non-existent client | P0 | skipped |
| 12 | should allow only one active retainer per client at a time | P1 | skipped |
| 13 | should auto-expire retainer when period_end passes | P1 | skipped |
| 14 | should define 90% threshold constant for scope creep detection | P0 | passing |
| 15 | should calculate utilization percentage from tracked time vs retainer allocation | P0 | passing |
| 16 | should detect scope creep when utilization reaches 90% | P0 | passing |
| 17 | should handle zero allocated hours without division error | P1 | passing |
| 18 | should calculate scope creep for flat monthly retainers | P1 | passing |
| 19 | should surface scope creep alert when 90% threshold is crossed | P0 | skipped |
| 20 | should display scope creep alert on dashboard | P0 | skipped |
| 21 | should trigger notification when scope creep detected | P1 | skipped |
| 22 | should not re-alert for same scope creep event | P1 | skipped |
| 23 | should expose retainer data fields needed by Epic 7 invoicing | P0 | passing |
| 24 | should compute billable amount from hourly retainer | P1 | passing |
| 25 | should compute billable amount from flat monthly retainer | P1 | passing |
| 26 | should make retainer data available for invoice creation flow (Epic 7) | P1 | skipped |
| 27 | should scope retainer records to workspace via RLS | P0 | skipped |
| 28 | should prevent cross-workspace retainer access | P0 | skipped |
| 29 | should enforce member-client access for retainer viewing | P1 | skipped |

### Story 3.3: New Client Setup Wizard (33 tests)

**File:** `apps/web/__tests__/acceptance/epic-3/3-3-new-client-setup-wizard.spec.ts`

| # | Test | Priority | Status |
|---|------|----------|--------|
| 1 | should define the wizard step order | P0 | passing |
| 2 | should require contact details as the first step | P0 | passing |
| 3 | should include service agreement as a wizard step | P0 | passing |
| 4 | should include billing preferences as a wizard step | P0 | passing |
| 5 | should allow retainer setup as optional wizard step | P1 | passing |
| 6 | should include review step before final submission | P1 | passing |
| 7 | should define maximum completion time constraint | P0 | passing |
| 8 | should complete standard client setup in under 5 minutes (NFR) | P0 | skipped |
| 9 | should define progress indicator for each wizard step | P0 | passing |
| 10 | should calculate progress percentage from current step | P1 | passing |
| 11 | should mark completed steps in progress indicator | P1 | passing |
| 12 | should render progress bar indicating current wizard step | P0 | skipped |
| 13 | should define complete client payload from wizard aggregation | P0 | passing |
| 14 | should validate required fields before wizard submission | P0 | passing |
| 15 | should reject wizard submission with missing required fields | P1 | passing |
| 16 | should create client with all wizard data on final submission | P0 | skipped |
| 17 | should redirect to client list after successful creation | P0 | skipped |
| 18 | should show newly created client in client list | P0 | skipped |
| 19 | should preserve partial data on navigation back within wizard | P1 | skipped |
| 20 | should clear wizard state on completion or explicit cancel | P1 | skipped |
| 21 | should prevent forward navigation when current step is invalid | P0 | passing |
| 22 | should allow backward navigation to previous steps | P1 | passing |
| 23 | should not allow backward navigation from step 1 | P1 | passing |
| 24 | should skip optional retainer step when declined | P1 | passing |
| 25 | should validate each step before allowing forward navigation | P0 | skipped |
| 26 | should support keyboard navigation between wizard steps | P1 | passing |
| 27 | should meet WCAG 2.1 AA for all wizard steps (FR97) | P0 | skipped |
| 28 | should announce step changes to screen readers via ARIA live regions | P1 | skipped |

---

## Test Execution Evidence

### RED Verification

**Command:** `cd apps/web && pnpm vitest run __tests__/acceptance/epic-3/`

```
 Test Files  3 passed (3)
      Tests  50 passed | 45 skipped (95)
   Duration  9.51s
```

**Summary:**
- Total tests: 95
- Passing (schema/logic): 50
- Skipped (integration/E2E): 45
- Status: RED-phase scaffolds verified

---

## Implementation Checklist

### Story 3.1: Client Data Model & CRUD

**Tasks to make skipped tests pass:**

- [ ] Create `clients` table migration with RLS policies (workspace_id ::text cast)
- [ ] Create `clients` Drizzle schema in `packages/db/src/schema/clients.ts`
- [ ] Create client CRUD Server Actions in `apps/web/app/(workspace)/clients/actions/`
- [ ] Create client list page with filtering, sorting, health indicators
- [ ] Create client detail/edit page with cascading data updates
- [ ] Implement archive/restore via status field update
- [ ] Implement member-client access scoping via `member_client_access` table
- [ ] Add empty state components with CTAs
- [ ] Add audit logging for client CRUD operations
- [ ] Write pgTAP RLS tests for clients table

### Story 3.2: Retainer Agreements & Scope Creep Detection

**Tasks to make skipped tests pass:**

- [ ] Create `retainer_agreements` table migration with RLS
- [ ] Create retainer Drizzle schema in `packages/db/src/schema/retainer-agreements.ts`
- [ ] Implement retainer CRUD Server Actions
- [ ] Implement scope creep detection logic (utilization >= 90%)
- [ ] Create scope creep alert notification
- [ ] Add dashboard alert component for scope creep
- [ ] Write pgTAP RLS tests for retainer_agreements table

### Story 3.3: New Client Setup Wizard

**Tasks to make skipped tests pass:**

- [ ] Create wizard UI component with step navigation
- [ ] Implement step validation per section (contact, agreement, billing, retainer)
- [ ] Implement progress indicator component
- [ ] Implement wizard state management (forward/back/preserve)
- [ ] Connect wizard to client creation Server Action
- [ ] Add keyboard navigation support
- [ ] Add ARIA live regions for step changes
- [ ] Verify < 5 minute completion time

---

## Running Tests

```bash
# Run all Epic 3 ATDD tests
cd apps/web && pnpm vitest run __tests__/acceptance/epic-3/

# Run specific story tests
cd apps/web && pnpm vitest run __tests__/acceptance/epic-3/3-1-client-data-model-crud.spec.ts

# Run all tests project-wide
pnpm test
```

---

## Next Steps

1. Begin implementation using `bmad-dev-story` for Story 3.1
2. Activate skipped tests by removing `test.skip()` one at a time during TDD green phase
3. After Epic 3 implementation complete, add pgTAP RLS tests for clients and retainer_agreements tables
4. Run `graphify --update` to keep knowledge graph in sync

---

**Generated by BMad TEA Agent** — 2026-04-26
