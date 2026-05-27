---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-red-phase-scaffolds', 'step-05-data-infrastructure', 'step-06-implementation-checklist']
lastStep: 'step-06-implementation-checklist'
lastSaved: '2026-05-27'
workflowType: 'testarch-atdd'
storyId: '8.4'
storyKey: '8-4-friday-feeling-ritual'
storyFile: '_bmad-output/planning-artifacts/epics.md#Story 8.4'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-4-friday-feeling-ritual.md'
generatedTestFiles:
  - 'apps/web/__tests__/acceptance/epic-8/8-4-friday-feeling-ritual.spec.ts'
  - 'tests/e2e/epic-8-reporting.spec.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/implementation-artifacts/epic-8-kickoff-2026-05-27.md'
  - 'apps/web/vitest.config.ts'
---

# ATDD Checklist - Epic 8, Story 8.4: Friday Feeling Ritual

**Date:** 2026-05-27
**Author:** team mantis
**Primary Test Level:** API/Acceptance (Vitest) + E2E (Playwright)

---

## Story Summary

As a user, I want a weekly summary of accumulated value each Friday, so that I see the tangible impact of my agents and feel motivated.

---

## Acceptance Criteria

1. **AC1:** Friday Feeling summary generated with headline: "Here's what you accomplished. Now go live your life." (UX-DR16)
2. **AC2:** Summary shows accumulated value: tasks handled, time saved, trust milestones reached
3. **AC3:** Completion screen ("The Exhale") shows visible impact stories (UX-DR23)
4. **AC4:** Wednesday micro-affirmation highlights team member trust milestone stories for agency workspaces (UX-DR46)
5. **AC5:** Summary surfaces in orchestrated workflow inbox (UX-DR10)

---

## Story Integration Metadata

- **Story ID:** `8.4`
- **Story Key:** `8-4-friday-feeling-ritual`
- **Story File:** `_bmad-output/planning-artifacts/epics.md#Story 8.4`
- **Checklist Path:** `_bmad-output/test-artifacts/atdd-checklist-8-4-friday-feeling-ritual.md`
- **Generated Test Files:**
  - `apps/web/__tests__/acceptance/epic-8/8-4-friday-feeling-ritual.spec.ts`
  - `tests/e2e/epic-8-reporting.spec.ts`

---

## Red-Phase Test Scaffolds Created

### Acceptance Tests (4 ATDD blocks, 7 test cases)

**File:** `apps/web/__tests__/acceptance/epic-8/8-4-friday-feeling-ritual.spec.ts` (~160 lines)

| Test ID | Name | Status | Expected Failure |
|---|---|---|---|
| 8.4-ATDD-001 | Friday Feeling summary generated with headline | RED | Agent/action not defined |
| 8.4-ATDD-002 | The Exhale completion screen shows impact stories | RED | Component not defined |
| 8.4-ATDD-003 | Wednesday micro-affirmation for team milestones | RED | Action not defined |
| 8.4-ATDD-004 | Friday Feeling surfaces in orchestrated inbox | RED | Inbox integration not implemented |

### E2E Tests (2 E2E tests for Story 8.4)

**File:** `tests/e2e/epic-8-reporting.spec.ts`

- ✅ **[8.4-E2E-001]** Friday Feeling summary appears in orchestrated workflow inbox — RED (Inbox item not implemented)
- ✅ **[8.4-E2E-002]** The Exhale screen shows impact stories when activated — RED (Route not implemented)

---

## Data Factories Created

**File:** `tests/support/factories/friday-feeling.factory.ts` (to be created by dev)

**Exports:**

- `createFridayFeeling(overrides?)` — Create single Friday Feeling summary
- `createWednesdayAffirmation(overrides?)` — Create single Wednesday affirmation

---

## Fixtures Created

**File:** `tests/support/fixtures/friday-feeling.fixture.ts` (to be created by dev)

**Fixtures:**

- `fridayFeeling` — Provides a Friday Feeling summary for the current user
  - **Setup:** Creates agent runs, counts tasks, calculates time saved
  - **Provides:** `{ summary }`
  - **Cleanup:** Deletes summary record

---

## Mock Requirements

### Friday Feeling Agent Mock

**Endpoint:** Internal agent execution

**Success Response:**

```json
{
  "headline": "Here's what you accomplished. Now go live your life.",
  "tasks_handled": 23,
  "time_saved_minutes": 185,
  "trust_milestones": [
    { "agent_type": "time_integrity", "from_level": "suggest", "to_level": "auto_approve" }
  ]
}
```

---

## Required data-testid Attributes

### Inbox Friday Feeling Item

- `inbox-item-friday-feeling` — Friday Feeling inbox card
- `friday-feeling-headline` — Headline text
- `friday-feeling-tasks-count` — Tasks handled count
- `friday-feeling-time-saved` — Time saved display

### The Exhale Screen (`/friday-feeling`)

- `exhale-heading` — "The Exhale" heading
- `exhale-impact-stories` — Impact stories container
- `exhale-tasks-count` — Tasks count display
- `exhale-time-saved` — Time saved display
- `exhale-dismiss-button` — Dismiss action

### Wednesday Affirmation (Inbox)

- `inbox-item-wednesday-affirmation` — Affirmation card
- `affirmation-story-text` — Team member milestone story

---

## Implementation Checklist

### Task 1: Friday Feeling Agent

**File:** `packages/agents/friday-feeling/index.ts`

- [ ] Define `FridayFeelingAgent` class
- [ ] Implement `run()` method aggregating weekly data
- [ ] Generate headline and impact stories
- [ ] Store summary in `friday_feeling_summaries` table
- [ ] Run on cron (Friday 4:00 PM)

### Task 2: Wednesday Affirmation

**File:** `packages/agents/friday-feeling/wednesday-affirmation.ts`

- [ ] Query trust milestones for team members
- [ ] Generate milestone stories
- [ ] Store in inbox as `wednesday_affirmation` item
- [ ] Run on cron (Wednesday 9:00 AM)

### Task 3: Server Actions

**Files:** `apps/web/lib/actions/reports/`

- [ ] `get-friday-feeling.ts` — Fetch current week's summary
- [ ] `get-wednesday-affirmation.ts` — Fetch affirmation for team
- [ ] `dismiss-inbox-item.ts` — Mark inbox item as dismissed

### Task 4: UI Components

**Files:** `apps/web/components/reports/`

- [ ] `exhale-screen.tsx` — The Exhale completion screen
- [ ] `friday-feeling-card.tsx` — Inbox card component
- [ ] `wednesday-affirmation-card.tsx` — Affirmation inbox card

### Task 5: Routes

**Files:** `apps/web/app/(workspace)/`

- [ ] `friday-feeling/page.tsx` — Exhale screen page
- [ ] Inbox integration for Friday Feeling item type

### Task 6: E2E Test Activation

- [ ] Remove `test.skip()` from 8.4-E2E-001 and verify RED
- [ ] Remove `test.skip()` from 8.4-E2E-002 and verify RED

---

## Running Tests

```bash
# Run Story 8.4 acceptance tests
pnpm vitest run apps/web/__tests__/acceptance/epic-8/8-4-friday-feeling-ritual.spec.ts

# Run Epic 8 E2E tests for Story 8.4
pnpm exec playwright test tests/e2e/epic-8-reporting.spec.ts --grep "8.4"
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

- ✅ All tests written as red-phase scaffolds
- ✅ Fixtures and factories patterns documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

### GREEN Phase (DEV Team - Next Steps)

1. Start with FridayFeelingAgent class
2. Create database table for summaries
3. Build Exhale screen UI
4. Integrate with inbox system
5. Activate tests one at a time

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Review headline generation for personalization
2. Ensure impact stories are meaningful
3. Optimize cron scheduling

---

## Notes

- Friday Feeling is internal (no client action) — no trust gate needed
- Configurable day for Friday Feeling (default: Friday)
- Wednesday affirmation only for agency workspaces with multiple members
- Summary surfaces in orchestrated workflow inbox per UX-DR10

---

**Generated by BMad TEA Agent** — 2026-05-27
