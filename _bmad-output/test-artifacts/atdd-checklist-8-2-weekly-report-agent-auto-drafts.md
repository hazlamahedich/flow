---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-red-phase-scaffolds', 'step-05-data-infrastructure', 'step-06-implementation-checklist']
lastStep: 'step-06-implementation-checklist'
lastSaved: '2026-05-27'
workflowType: 'testarch-atdd'
storyId: '8.2'
storyKey: '8-2-weekly-report-agent-auto-drafts'
storyFile: '_bmad-output/planning-artifacts/epics.md#Story 8.2'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-2-weekly-report-agent-auto-drafts.md'
generatedTestFiles:
  - 'apps/web/__tests__/acceptance/epic-8/8-2-weekly-report-agent-auto-drafts.spec.ts'
  - 'tests/e2e/epic-8-reporting.spec.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/implementation-artifacts/epic-8-kickoff-2026-05-27.md'
  - 'apps/web/vitest.config.ts'
---

# ATDD Checklist - Epic 8, Story 8.2: Weekly Report Agent Auto-Drafts

**Date:** 2026-05-27
**Author:** team mantis
**Primary Test Level:** API/Acceptance (Vitest)

---

## Story Summary

As a user, I want the Weekly Report agent to auto-draft reports, so that I can review polished reports instead of writing them from scratch.

---

## Acceptance Criteria

1. **AC1:** Weekly Report Agent auto-drafts report based on period data for user review (FR64)
2. **AC2:** Draft follows client's customized template if one exists
3. **AC3:** Draft appears in approval queue following trust matrix from Epic 2
4. **AC4:** Users can review chronological log of all AI agent actions with full context (FR66)

---

## Story Integration Metadata

- **Story ID:** `8.2`
- **Story Key:** `8-2-weekly-report-agent-auto-drafts`
- **Story File:** `_bmad-output/planning-artifacts/epics.md#Story 8.2`
- **Checklist Path:** `_bmad-output/test-artifacts/atdd-checklist-8-2-weekly-report-agent-auto-drafts.md`
- **Generated Test Files:**
  - `apps/web/__tests__/acceptance/epic-8/8-2-weekly-report-agent-auto-drafts.spec.ts`

---

## Red-Phase Test Scaffolds Created

### Acceptance Tests (4 ATDD blocks, 7 test cases)

**File:** `apps/web/__tests__/acceptance/epic-8/8-2-weekly-report-agent-auto-drafts.spec.ts` (~170 lines)

| Test ID | Name | Status | Expected Failure |
|---|---|---|---|
| 8.2-ATDD-001 | Weekly Report Agent auto-drafts report for review | RED | Agent class not defined |
| 8.2-ATDD-002 | Draft follows customized template if one exists | RED | Template loading not implemented |
| 8.2-ATDD-003 | Draft appears in approval queue with trust matrix | RED | Proposal creation not implemented |
| 8.2-ATDD-004 | Chronological agent action log with full context | RED | Action log not implemented |

---

## Data Factories Created

**File:** `tests/support/factories/agent-run.factory.ts` (to be created by dev)

**Exports:**

- `createAgentRun(overrides?)` — Create single agent run record
- `createAgentRuns(count)` — Create array of agent runs

---

## Fixtures Created

**File:** `tests/support/fixtures/agent-proposal.fixture.ts` (to be created by dev)

**Fixtures:**

- `agentProposal` — Provides a pending agent proposal for testing approval flow
  - **Setup:** Creates agent run, generates draft, creates proposal in agent_proposals
  - **Provides:** `{ proposal, agentRun, draft }`
  - **Cleanup:** Deletes proposal, run, and draft records

---

## Mock Requirements

### LLM Provider Mock

**Endpoint:** Internal (LiteLLM proxy)

**Success Response:**

```json
{
  "draft": "## Weekly Report for Acme\n\n### Time Summary\n...",
  "templateId": "tpl-1"
}
```

**Failure Response:**

```json
{ "error": { "code": "LLM_TIMEOUT", "message": "..." } }
```

---

## Required data-testid Attributes

### Agent Action Log Page (`/reports/agent-log`)

- `agent-log-heading` — Page heading
- `agent-log-table` — Table of agent runs
- `agent-log-row-{id}` — Individual run row
- `agent-log-context-toggle` — Expand/collapse context detail

### Approval Queue (Inbox)

- `inbox-proposal-weekly-report` — Weekly report proposal card
- `proposal-approve-button` — Approve action
- `proposal-reject-button` — Reject action

---

## Implementation Checklist

### Task 1: Agent Module

**File:** `packages/agents/weekly-report/index.ts`

- [ ] Define `WeeklyReportAgent` class
- [ ] Implement `run()` method with period data aggregation
- [ ] Integrate with LiteLLM proxy for draft generation
- [ ] Load and apply client template if exists

### Task 2: Trust Gate Integration

**Files:** `packages/agents/weekly-report/`

- [ ] Emit `weekly_report.draft_created` signal
- [ ] Create proposal in `agent_proposals` table
- [ ] Set trust level to `suggest` (requires approval)
- [ ] Integrate with Epic 2 approval queue

### Task 3: Agent Action Log

**Files:** `apps/web/lib/actions/reports/get-agent-action-log.ts`

- [ ] Query `agent_runs` for period + client
- [ ] Join with `agent_proposals` and `agent_signals`
- [ ] Return chronological log with full context

### Task 4: UI Components

**Files:** `apps/web/app/(workspace)/reports/agent-log/`

- [ ] `page.tsx` — Agent action log page
- [ ] Table component with sortable columns
- [ ] Context detail expand/collapse

### Task 5: Test Activation

- [ ] Remove `test.skip()` from ATDD blocks and verify RED
- [ ] Confirm agent class loads without errors

---

## Running Tests

```bash
# Run Story 8.2 acceptance tests
pnpm vitest run apps/web/__tests__/acceptance/epic-8/8-2-weekly-report-agent-auto-drafts.spec.ts

# Run all Epic 8 E2E tests
pnpm exec playwright test tests/e2e/epic-8-reporting.spec.ts --grep "8.2"
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

- ✅ All tests written as red-phase scaffolds
- ✅ Fixtures and factories patterns documented
- ✅ Mock requirements documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

### GREEN Phase (DEV Team - Next Steps)

1. Start with `WeeklyReportAgent` class definition
2. Implement trust gate integration
3. Build agent action log query
4. Create UI pages
5. Activate tests one at a time

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Review agent code for error handling
2. Ensure LLM timeout handling is robust
3. Verify trust gate decisions are correct

---

## Notes

- Trust gate with `suggest` level is critical — human approval required before sharing
- Report data is pre-aggregated RPC output — LLM only formats, never invents
- Agent auto-drafts run on cron (Monday 6:30 AM) via pg-boss
- LiteLLM proxy handles cost tracking and fallback

---

**Generated by BMad TEA Agent** — 2026-05-27
