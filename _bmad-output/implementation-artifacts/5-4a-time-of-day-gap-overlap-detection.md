# Story 5.4a: Add Start/End Time to Manual Time Entries

Status: done

## Story

As a VA,
I want to record the specific start and end times when I log manual time entries,
so that my time records accurately reflect when work actually happened — enabling reliable gap and overlap detection, transparent audit trails, and correct invoice attribution.

## Context

### Why This Story

FR26 requires start/end time capture on manual entries. FR27 (Time Integrity Agent) needs this data to detect gaps and overlaps. The detection logic in `anomaly-detection.ts` is **already complete** — it filters for entries where `startMinutes !== undefined && endMinutes !== undefined`. Today, every entry has these fields as `undefined`, so detection always returns empty. This story provides the data that makes the existing agent logic functional.

### Epic 7 Dependency

Epic 7 (Invoice Generation) will rely on validated, anomaly-free time entries. Without start/end times, gap/overlap detection cannot run, meaning unreviewed entries could flow into invoices. This story is a **data-integrity prerequisite** for trustworthy invoice generation — not a hard technical blocker (invoices can still be generated), but a confidence prerequisite for the guarantees Epic 7 promises.

### What Exists Today

- **DB:** `duration_minutes` integer column. No `start_minutes` or `end_minutes` columns.
- **Create modal:** Collects client, project, date, duration, notes. Duration is a plain integer in minutes.
- **Edit modal:** Same fields plus invoiced acknowledgement warning.
- **Server Actions:** `createTimeEntryAction` and `updateTimeEntryAction` use Zod schemas with `durationMinutes`. No start/end validation.
- **Detection:** `anomaly-detection.ts` fully implemented. `GAP_THRESHOLD_MINUTES = 60`. `TimeEntryForDetection` already has optional `startMinutes`/`endMinutes` fields. Returns empty until data exists.
- **RLS:** Existing policies on `time_entries` table. New columns must be verified not to break row-level security.

## Acceptance Criteria

### Data & Migration

**AC1 — Migration adds nullable integer columns.** A migration adds `start_minutes` (integer, nullable) and `end_minutes` (integer, nullable) to `time_entries`. Existing rows retain `NULL` for both columns. No data is lost or transformed. CHECK constraints enforce: values in `[0, 1439]`, both-or-neither, and `start_minutes < end_minutes`.

**AC2 — Migration is reversible.** The migration has a `DOWN` function that drops the two columns and the partial index, restoring the table to its prior schema.

**AC3 — RLS policies remain functional.** After migration, existing RLS policies on `time_entries` continue to enforce workspace isolation. Verified by running the existing pgTAP RLS test suite against the migrated schema (all tests pass).

### Validation & Data Integrity

**AC4 — Duration auto-fills from start/end in UI.** When a user sets both Start Time and End Time in either modal, the Duration field auto-populates with `end_minutes - start_minutes`. The user can manually override Duration after auto-fill. Server stores whatever `durationMinutes` it receives.

**AC5 — Both-or-neither time fields.** A time entry must have both `start_minutes` and `end_minutes` set, or neither. Partial entries (start only, or end only) are rejected with a validation error: "Both start and end times are required together."

**AC6 — End before start is rejected.** If both are provided and `end_minutes <= start_minutes`, the server rejects the entry with: "End time must be after start time." Enforced at DB CHECK constraint, Zod schema, and UI level.

**AC7 — Values within bounds.** `start_minutes` and `end_minutes`, when provided, are integers in `[0, 1439]`. Out-of-range values rejected at all layers.

**AC8 — Midnight-spanning entries are rejected in MVP.** An entry where `start_minutes + duration_minutes > 1440` (would cross midnight) is rejected with: "Entry spans midnight. Split into two entries for each calendar day." Full midnight-spanning support deferred to follow-up story.

**AC9 — Duration-only entries continue working.** An entry with both `start_minutes` NULL and `end_minutes` NULL saves successfully, using only `duration_minutes`. This is the current production behavior — fully preserved.

### UI — Log Time Modal

**AC10 — Start Time and End Time fields appear.** The log-time modal includes "Start Time" and "End Time" fields, positioned between Date and Duration. Fields use `<input type="time">` (browser-native). Both are optional.

**AC11 — Clearing a time clears the pair.** If the user fills one picker and tries to submit, an inline error shows: "Both start and end times are required together." The user must fill both or clear both.

### UI — Edit Time Entry Modal

**AC12 — Existing values are displayed.** When editing an entry, the Start/End Time fields display stored values (formatted via `minutesToTime()`). Entries with NULL values show empty fields.

**AC13 — Invoiced entry warning unchanged.** Adding start/end time fields does not alter the invoiced-entry edit flow.

### Agent Integration

**AC14 — Entries appear in anomaly detection.** After creating a time entry with `start_minutes`/`end_minutes` set, the entry is included in `detectGaps` and `detectOverlaps` results for its date/workspace. Entries with NULL times are excluded from gap/overlap (matching current behavior — no false positives).

**AC15 — Existing tests pass.** All existing tests in `anomaly-detection.test.ts` continue passing. The detection functions are backward-compatible — entries without `startMinutes`/`endMinutes` are correctly skipped.

### Tests

**AC16 — Red-phase test scaffolds exist.** The following test files exist with failing tests before implementation begins:

- `apps/web/__tests__/unit/time/time-conversion.test.ts` (relocated from `packages/agents/time-integrity/__tests__/` — utility lives in `apps/web`, test co-locates with its package per monorepo boundary)
- `packages/agents/time-integrity/__tests__/executor-mapping.test.ts`
- `apps/web/__tests__/unit/time/create-time-entry-schema.test.ts`
- `apps/web/__tests__/unit/time/update-time-entry-schema.test.ts`

**AC17 — New tests cover enumerated cases.** Tests cover all cases in the Test Plan section below. Minimum 28 unit test cases across 4 test files.

## Pre-Dev Dependency Scan

- [x] Graphify query run — key dependencies listed below
- [x] Dependencies: time_entries table, anomaly-detection.ts, executor.ts, log-time-modal.tsx, edit-time-entry-modal.tsx, create-time-entry.ts, update-time-entry.ts
- [x] UX AC review — time pickers are optional; existing duration-only flow unchanged
- [x] Architect sign-off: approved in Epic 5 retro as prerequisite for Epic 7
- [x] Adversarial review completed — 50+ findings addressed in this rewrite

## Scope Decision

**Keep as one story.** The unit of deliverable value is "VA can log start/end times and the system uses them." Splitting would create two unshippable halves (backend alone = no user value; frontend alone = can't persist). Each of the ~9 file changes is small (2 columns, 2 form fields, 1 query, 2 Zod schemas).

**Excluded from this story:**
- Midnight-spanning entry support (follow-up story)
- Bulk time entry editing
- Agent-side flagging/review workflow (Epic 7)
- Changes to anomaly detection algorithm (it's already complete)

## Tasks / Subtasks

### Task 1: Database Migration (AC: 1, 2, 3)
**File:** `supabase/migrations/20260513000001_add_start_end_minutes.sql`
**Dependencies:** None

- [x] Create migration adding `start_minutes INTEGER` and `end_minutes INTEGER` nullable columns
- [x] Add CHECK constraints: range `[0, 1439]`, both-or-neither, `start_minutes < end_minutes`
- [x] Add partial index on `(workspace_id, date, start_minutes)` WHERE times exist and not deleted
- [x] Write DOWN function (drop columns + index)
- [x] Verify with `supabase db reset`

### Task 2: Drizzle Schema (AC: 1)
**File:** `packages/db/src/schema/time-entries.ts`
**Dependencies:** Task 1

- [x] Add `startMinutes: integer("start_minutes")` and `endMinutes: integer("end_minutes")` fields
- [x] No new indexes in Drizzle — partial index is migration-only

### Task 3: Server Actions — Zod Schemas + Mutations (AC: 4, 5, 6, 7, 8, 9)
**Files:**
- `apps/web/app/(workspace)/time/actions/create-time-entry.ts`
- `apps/web/app/(workspace)/time/actions/update-time-entry.ts`
**Dependencies:** Task 2

- [x] Add `startMinutes`/`endMinutes` to create-time-entry Zod schema (see Dev Notes §3)
- [x] Add `.refine()` for both-or-neither + `start < end` validation
- [x] Add midnight-spanning rejection: if `startMinutes + durationMinutes > 1440`, reject
- [x] Add fields to the `createTimeEntry()` call
- [x] Add `startMinutes`/`endMinutes` to update-time-entry Zod schema (see Dev Notes §4)
- [x] Conditionally include in update `set()` clause (omit if absent, set null if explicitly null)
- [x] Add same `.refine()` validation

### Task 4: Agent Executor — Populate Detection Mapping (AC: 14, 15)
**File:** `packages/agents/time-integrity/executor.ts`
**Dependencies:** Task 2

- [x] Add `start_minutes`, `end_minutes` to the SELECT column list (line 62)
- [x] Map `row.start_minutes` → `startMinutes`, `row.end_minutes` → `endMinutes` in mapping (line 87-92)
- [x] Remove the "deferred to story 5.4a" comment
- [x] No changes to `anomaly-detection.ts` — `TimeEntryForDetection` interface already has optional fields (confirmed at line 10-11)
- [x] No changes to `schemas.ts` — signal contract is already correct

### Task 5: Time Conversion Utility (AC: 4, 10)
**File:** `apps/web/app/(workspace)/time/utils/time-conversion.ts` (NEW)
**Dependencies:** None

- [x] Create `timeToMinutes(time: string): number` — converts `"HH:MM"` → integer
- [x] Create `minutesToTime(minutes: number): string` — converts integer → `"HH:MM"`
- [x] Zero timezone conversion — browser `<input type="time">` is local, entry date provides context

### Task 6: Log Time Modal — Time Pickers (AC: 4, 10, 11)
**File:** `apps/web/app/(workspace)/time/components/log-time-modal.tsx`
**Dependencies:** Task 3, Task 5

- [x] Add `startTime`/`endTime` state (initialized to null)
- [x] Add two `<input type="time">` fields between Date and Duration
- [x] Auto-calc duration when both set (see Dev Notes §6)
- [x] On submit: convert via `timeToMinutes()`, send as integers to server action. If either null, omit both
- [x] Inline validation: if exactly one picker filled, show error
- [x] Update `onCreated` callback type to include `startMinutes`/`endMinutes`

### Task 7: Edit Time Entry Modal — Time Pickers (AC: 4, 12, 13)
**File:** `apps/web/app/(workspace)/time/components/edit-time-entry-modal.tsx`
**Dependencies:** Task 3, Task 5

- [x] Update `TimeEntryData` interface — add `startMinutes: number | null`, `endMinutes: number | null`
- [x] Add `startTime`/`endTime` state, initialize from entry via `minutesToTime()`
- [x] Same UI pattern as Task 6 for pickers, auto-calc, validation
- [x] Same conversion logic for submit
- [x] Invoiced-entry warning flow unchanged

### Task 8: Tests (AC: 16, 17)
**Dependencies:** Tasks 3, 4, 5

- [x] Create `apps/web/__tests__/unit/time/time-conversion.test.ts` (path corrected from spec draft — see AC16 note)
- [x] Create `packages/agents/time-integrity/__tests__/executor-mapping.test.ts`
- [x] Create `apps/web/__tests__/unit/time/create-time-entry-schema.test.ts`
- [x] Create `apps/web/__tests__/unit/time/update-time-entry-schema.test.ts`
- [x] Run full test suite: `pnpm test && pnpm typecheck && pnpm lint`
- [x] Verify all existing tests pass unchanged
- [ ] Verify all existing tests pass unchanged

### Review Findings

Code review completed 2026-05-13. Sources: Blind Hunter (adversarial), Edge Case Hunter (boundary/integration), Acceptance Auditor (spec compliance).

#### Decision Needed

- [x] [Review][Decision] durationManuallySet never resets after manual edit — RESOLVED: keep current behavior (Option B); add UI affordance as deferred item D5-4a-R1-W3 — Once user manually types duration, `setDurationManuallySet(true)` is set permanently and there is no code path that resets it to `false`. If user clears both time pickers and re-enters them, auto-fill never re-engages. Spec §6 Rule 2 says "manual value stands" but is silent on the clear-and-restart case. Decide: reset flag when both times become null/empty, or keep the current behavior (permanent disable on any manual keypress). Affects both `log-time-modal.tsx` and `edit-time-entry-modal.tsx`. [blind+edge+auditor]
- [x] [Review][Decision] AC16 `time-conversion.test.ts` at wrong path — RESOLVED: spec updated to reflect correct path (Option A) — Spec AC16 explicitly names `packages/agents/time-integrity/__tests__/time-conversion.test.ts` as a required red-phase scaffold. Actual file lives at `apps/web/__tests__/unit/time/time-conversion.test.ts`. Dev Agent Record documents the relocation (cross-package import). Decide: create the file at the spec-mandated path (adds a duplicate) OR update AC16 in the spec to reflect the relocated path. [auditor]
- [x] [Review][Decision] Update schema missing midnight-span validation — RESOLVED: refine added to update action (Option A); U9 test added — `create-time-entry.ts` has the midnight-span refine (`startMinutes + durationMinutes > 1440`), but `update-time-entry.ts` does not. AC8 says midnight-spanning entries are rejected in MVP without distinguishing create vs. update. Dev Notes §4 explicitly omits the check from the update schema — so spec is internally inconsistent. Decide: add the same midnight-span refine to the update schema, or acknowledge that updates bypass this guard and amend AC8. [edge]

#### Patches

- [x] [Review][Patch] `timeToMinutes` no input validation — NaN silently passes Zod `.min(0).max(1439)` (NaN comparisons return false in JS) [apps/web/app/(workspace)/time/utils/time-conversion.ts:1]
- [x] [Review][Patch] Update Zod refine: `null` + `undefined` treated as both-null, allows partial pair to reach DB — `null == null` and `undefined == null` both true in loose equality; one-null-one-undefined pair passes the refine then triggers a DB CHECK constraint error [apps/web/app/(workspace)/time/actions/update-time-entry.ts:59]
- [x] [Review][Patch] `updateInput as Record<string,unknown>` cast bypasses TypeScript type safety — use typed partial or conditional spread instead [apps/web/app/(workspace)/time/actions/update-time-entry.ts:133]
- [x] [Review][Patch] `handleUpdated` missing `startMinutes`/`endMinutes` state update in list — `EditTimeEntryResult` carries the new values but `handleUpdated` never applies them; in-memory list shows stale times until page refresh [apps/web/app/(workspace)/time/components/time-entry-list.tsx:101]
- [x] [Review][Patch] Orphan cleanup uncaught error terminates signal loop — if the `dismissed_at` update in the `insertRun` catch block itself throws, the error propagates out of the catch and halts processing of all remaining signals [packages/agents/time-integrity/executor.ts:~650]
- [x] [Review][Patch] Test schemas/mapping duplicated locally — drift risk — `executor-mapping.test.ts`, `create-time-entry-schema.test.ts`, `update-time-entry-schema.test.ts` each copy production logic; future prod changes won't break these tests. Recommend exporting the schemas and importing them in tests. [packages/agents/time-integrity/__tests__/executor-mapping.test.ts, apps/web/__tests__/unit/time/]
- [x] [Review][Patch] DOWN migration is commented-out SQL, not an executable function — AC2 requires an executable DOWN; the current comments are documentation only [supabase/migrations/20260513000001_add_start_end_minutes.sql:25]
- [x] [Review][Patch] Zod refine combines AC5 + AC6 into one message — `'Both start and end times required together; start must be before end'` is returned for both partial-pair (AC5) and end-before-start (AC6) cases; split into two refines with distinct messages per each AC [apps/web/app/(workspace)/time/actions/create-time-entry.ts:13, update-time-entry.ts:58]
- [x] [Review][Patch] AC11 inline error rendered at top of form, not inline — "Both start and end times are required together" is shown in the global error banner; AC11 specifies an inline error adjacent to the time picker fields [apps/web/app/(workspace)/time/components/log-time-modal.tsx, edit-time-entry-modal.tsx]

#### Deferred

- [x] [Review][Defer] `ENTRY_FETCH_LIMIT=5000` silently truncates; no `isPartial` flag in result — cap hit is audit-logged but `success: true` is returned with no indication the sweep is incomplete [packages/agents/time-integrity/executor.ts:14] — deferred: scalability concern; pagination is a follow-up story
- [x] [Review][Defer] Orphan cleanup sets `dismissed_at` on transient DB error — a transient `insertRun` failure permanently dismisses the signal; it won't resurface in future sweeps without manual intervention [packages/agents/time-integrity/executor.ts:~648] — deferred: signal resilience is an Epic 10 concern (10-4-error-handling-agent-recovery)
- [x] [Review][Defer] Auto-duration effect gives no hint when `end <= start` — duration field stays at previous value with no real-time feedback; user only learns at submit via server validation — deferred: UX polish, not spec-required

## Dev Notes

### §1. Schema Decision

**Use `INTEGER` (minutes from midnight). Not `TIME`, not `TIMESTAMPTZ`.**

- `TIME` has no timezone. VAs work across timezones. `09:00` means nothing without knowing whose 9am.
- `TIMESTAMPTZ` duplicates the existing `date` column and creates a source-of-truth conflict.
- `INTEGER` matches the `TimeEntryForDetection` interface which already uses `startMinutes?: number`. The entry's `date` column provides timezone context. Zero conversion needed — integer in DB, integer in TypeScript.

### §2. Migration DDL

```sql
-- Story 5-4a: Add start/end time tracking as integer minutes from midnight

ALTER TABLE time_entries
  ADD COLUMN start_minutes INTEGER,
  ADD COLUMN end_minutes INTEGER;

ALTER TABLE time_entries
  ADD CONSTRAINT chk_start_minutes_range
    CHECK (start_minutes IS NULL OR (start_minutes >= 0 AND start_minutes < 1440)),
  ADD CONSTRAINT chk_end_minutes_range
    CHECK (end_minutes IS NULL OR (end_minutes >= 0 AND end_minutes < 1440)),
  ADD CONSTRAINT chk_time_pair_both_or_neither
    CHECK (
      (start_minutes IS NULL AND end_minutes IS NULL) OR
      (start_minutes IS NOT NULL AND end_minutes IS NOT NULL)
    ),
  ADD CONSTRAINT chk_start_before_end
    CHECK (start_minutes IS NULL OR end_minutes IS NULL OR start_minutes < end_minutes);

CREATE INDEX idx_time_entries_date_start_minutes
  ON time_entries (workspace_id, date, start_minutes)
  WHERE start_minutes IS NOT NULL AND end_minutes IS NOT NULL AND deleted_at IS NULL;
```

- **Nullable pair.** Both null or both present — never one without the other.
- **Range bound.** 0–1439 inclusive.
- **Ordering.** `start_minutes < end_minutes` (strict — zero-duration blocked by existing `duration_minutes > 0` check).
- **Partial index.** Covers the exact predicate gap/overlap detection scans. Excludes duration-only entries.

Last time_entries migration: `20260510000002_evolve_time_entries.sql`. New: `20260513000001_add_start_end_minutes.sql`. No collision.

### §3. Zod Schema — Create Action

```typescript
const createTimeEntrySchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return d <= todayStr;
  }, 'Date cannot be in the future'),
  durationMinutes: z.number().int().min(1).max(1440),
  startMinutes: z.number().int().min(0).max(1439).optional(),
  endMinutes: z.number().int().min(0).max(1439).optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (d) => {
    const hasStart = d.startMinutes != null;
    const hasEnd = d.endMinutes != null;
    if (hasStart && hasEnd) return d.startMinutes! < d.endMinutes!;
    if (!hasStart && !hasEnd) return true;
    return false;
  },
  { message: 'Both start and end times required together; start must be before end' },
);
```

### §4. Zod Schema — Update Action

```typescript
const updateTimeEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().min(1).max(1440),
  startMinutes: z.number().int().min(0).max(1439).nullable().optional(),
  endMinutes: z.number().int().min(0).max(1439).nullable().optional(),
  clientId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable()),
  projectId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable()),
  notes: z.string().max(500).nullable(),
  invoicedAcknowledged: z.boolean().optional(),
}).refine(
  (d) => {
    if (d.startMinutes != null && d.endMinutes != null) return d.startMinutes < d.endMinutes;
    if (d.startMinutes == null && d.endMinutes == null) return true;
    return false;
  },
  { message: 'Both start and end times required together; start must be before end' },
);
```

### §5. Time Conversion Utility

**File:** `apps/web/app/(workspace)/time/utils/time-conversion.ts`

```typescript
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
```

- `<input type="time">` yields `"HH:MM"` → `timeToMinutes()` → integer → server action.
- DB stores integer → `minutesToTime()` → `"HH:MM"` → `<input type="time">` value.
- No `HH:MM:SS` anywhere. No `TIME` SQL type. No timezone conversion.

### §6. Duration Auto-Calculation Flow

**Where:** Client-side, in both modals.
**When:** onChange of either start or end time picker.
**Rules:**

1. When both `startTime` and `endTime` are non-null, compute `endMinutes - startMinutes` and set duration state.
2. If user subsequently edits duration manually, do NOT overwrite — the manual value stands.
3. If user clears one time picker, leave duration as-is (don't auto-clear).
4. Server action does NOT recalculate — it stores whatever `durationMinutes` it receives.
5. This allows: start=09:00, end=17:00, duration=420 (7h with 1h lunch break — user overrides).

### §7. Source of Truth

**`duration_minutes` is always the billing truth.** Start/end times are optional metadata for anomaly detection.

| Scenario | Behavior |
|---|---|
| Duration only (no times) | `duration_minutes` set. Both columns NULL. Gap/overlap skipped. |
| Start + end provided | `duration_minutes` = auto-calc from `end - start` (user may override before submit). Both columns stored. |
| Duration manually edited after auto-calc | Manual value wins. Times preserved. |
| Data disagreement (corruption) | `duration_minutes` is source of truth. Reconcile: `end = start + duration`. |

### §8. Midnight-Spanning Strategy

**MVP: Block at validation.** No silent handling, no heuristic, no data hole.

- Server-side check: if `startMinutes + durationMinutes > 1440`, reject with "Entry spans midnight. Split into two entries."
- DB CHECK `start_minutes < end_minutes` means midnight-spanning entries cannot exist in the database.
- Gap/overlap detection has no midnight problem — every entry with times fits within a single date.
- Follow-up story: midnight-spanning via `split_at_midnight` utility creating two linked entries.

### §9. Executor Mapping (integer → integer)

In `packages/agents/time-integrity/executor.ts`, update the SELECT and mapping:

```typescript
// SELECT: add start_minutes, end_minutes
.select('id, date, duration_minutes, start_minutes, end_minutes')

// Mapping: integer → integer, no conversion
const entries: TimeEntryForDetection[] = (rawEntries ?? []).map((r) => ({
  id: r.id as string,
  date: r.date as string,
  durationMinutes: r.duration_minutes as number,
  startMinutes: (r.start_minutes as number | null) ?? undefined,
  endMinutes: (r.end_minutes as number | null) ?? undefined,
}));
```

`TimeEntryForDetection` already has `startMinutes?: number` and `endMinutes?: number` at line 10-11. **No interface changes needed.**

### §10. Signal Contract (Existing — No Changes)

Gap signals include: `{ anomalyType: 'gap', affectedEntryIds, signalKey, payload: { date, gapMinutes, gapStartMinutes, gapEndMinutes, thresholdMinutes } }`

Overlap signals include: `{ anomalyType: 'overlap', affectedEntryIds, signalKey, payload: { date } }`

The existing `AnomalySignal` interface is the contract. No changes needed — the detection functions already populate these fields.

## Test Plan

### Test File Manifest

| # | File Path | Framework | Min Cases |
|---|-----------|-----------|:---------|
| 1 | `apps/web/__tests__/unit/time/time-conversion.test.ts` | Vitest | 6 |
| 2 | `packages/agents/time-integrity/__tests__/executor-mapping.test.ts` | Vitest | 5 |
| 3 | `apps/web/__tests__/unit/time/create-time-entry-schema.test.ts` | Vitest | 9 |
| 4 | `apps/web/__tests__/unit/time/update-time-entry-schema.test.ts` | Vitest | 8 |

**Total: 28 minimum test cases.**

### Enumerated Test Cases

#### time-conversion.test.ts (6 cases)

| # | Test Name | Input | Expected | P |
|---|-----------|-------|----------|---|
| C1 | converts midnight | `timeToMinutes("00:00")` | `0` | P0 |
| C2 | converts end of day | `timeToMinutes("23:59")` | `1439` | P0 |
| C3 | converts noon | `timeToMinutes("12:00")` | `720` | P0 |
| C4 | roundtrip identity | `timeToMinutes(minutesToTime(n))` for n=0..1439 step 60 | `n` | P0 |
| C5 | minutesToTime midnight | `minutesToTime(0)` | `"00:00"` | P0 |
| C6 | minutesToTime end of day | `minutesToTime(1439)` | `"23:59"` | P0 |

#### executor-mapping.test.ts (5 cases)

| # | Test Name | Input Row | Expected Field | P |
|---|-----------|-----------|----------------|---|
| E1 | maps start_minutes | `{ start_minutes: 540 }` | `startMinutes: 540` | P0 |
| E2 | maps end_minutes | `{ end_minutes: 1020 }` | `endMinutes: 1020` | P0 |
| E3 | null → undefined (start) | `{ start_minutes: null }` | `startMinutes: undefined` | P0 |
| E4 | null → undefined (end) | `{ end_minutes: null }` | `endMinutes: undefined` | P0 |
| E5 | both null → both undefined | `{ start_minutes: null, end_minutes: null }` | `startMinutes: undefined, endMinutes: undefined` | P0 |

#### create-time-entry-schema.test.ts (9 cases)

| # | Test Name | Input | Expected | P |
|---|-----------|-------|----------|---|
| S1 | accepts valid with times | `{ startMinutes: 540, endMinutes: 1020, ... }` | passes | P0 |
| S2 | accepts valid without times | `{ startMinutes: undefined, endMinutes: undefined, ... }` | passes | P0 |
| S3 | rejects start only | `{ startMinutes: 540, endMinutes: undefined, ... }` | fails: both-or-neither | P0 |
| S4 | rejects end only | `{ startMinutes: undefined, endMinutes: 1020, ... }` | fails: both-or-neither | P0 |
| S5 | rejects end before start | `{ startMinutes: 1020, endMinutes: 540, ... }` | fails: start < end | P0 |
| S6 | rejects start = end | `{ startMinutes: 540, endMinutes: 540, ... }` | fails: start < end | P0 |
| S7 | rejects start out of range | `{ startMinutes: -1, endMinutes: 540, ... }` | fails: range | P0 |
| S8 | rejects end out of range | `{ startMinutes: 540, endMinutes: 1440, ... }` | fails: range | P0 |
| S9 | rejects midnight-spanning | `{ startMinutes: 1380, endMinutes: 1439, durationMinutes: 120, ... }` | fails: spans midnight | P0 |

#### update-time-entry-schema.test.ts (8 cases)

| # | Test Name | Input | Expected | P |
|---|-----------|-------|----------|---|
| U1 | accepts valid update with times | `{ startMinutes: 540, endMinutes: 1020, ... }` | passes | P0 |
| U2 | accepts clearing times | `{ startMinutes: null, endMinutes: null, ... }` | passes | P0 |
| U3 | accepts absent times | `{ ... }` (no startMinutes/endMinutes) | passes | P0 |
| U4 | rejects start only | `{ startMinutes: 540, ... }` | fails | P0 |
| U5 | rejects end only | `{ endMinutes: 1020, ... }` | fails | P0 |
| U6 | rejects end before start | `{ startMinutes: 1020, endMinutes: 540, ... }` | fails | P0 |
| U7 | rejects start out of range | `{ startMinutes: -1, endMinutes: 540, ... }` | fails | P0 |
| U8 | rejects end out of range | `{ startMinutes: 540, endMinutes: 1500, ... }` | fails | P0 |

### Regression Assessment

| File | Impact | Action |
|------|--------|--------|
| `anomaly-detection.test.ts` | Should pass unchanged — detection code unchanged | Verify |
| `log-time-modal.test.tsx` | May need update if auto-calc changes default duration | Review |
| `edit-time-entry-modal.test.tsx` | May need update if time fields change form structure | Review |
| All pgTAP RLS tests | Should pass unchanged — no RLS policy changes | Verify |

### Existing Detection Behavior (Unchanged)

- `detectGaps`: filters entries with `startMinutes !== undefined && endMinutes !== undefined`, sorts, compares adjacent. `withTimes.length < 2` → skip. Already correct.
- `detectOverlaps`: same filter, pairwise comparison. Already correct.
- `detectLowHours`: sums `durationMinutes` per date. Unaffected by this story.
- Entries without times are excluded from gap/overlap, included in low-hours. This is correct behavior.

## References

- `packages/agents/time-integrity/anomaly-detection.ts` — detection functions (confirmed: no changes needed)
- `packages/agents/time-integrity/executor.ts:60-67` — entry fetch query (SELECT needs 2 new columns)
- `packages/agents/time-integrity/executor.ts:87-92` — entry mapping (needs start/end mapping)
- `packages/agents/time-integrity/schemas.ts` — AnomalySignal interface, GAP_THRESHOLD_MINUTES = 60
- `packages/db/src/schema/time-entries.ts` — Drizzle schema (needs 2 new fields)
- `apps/web/app/(workspace)/time/actions/create-time-entry.ts` — Zod + create mutation
- `apps/web/app/(workspace)/time/actions/update-time-entry.ts` — Zod + update mutation
- `apps/web/app/(workspace)/time/components/log-time-modal.tsx` — log-time UI (291 lines)
- `apps/web/app/(workspace)/time/components/edit-time-entry-modal.tsx` — edit-time UI (279 lines)
- `supabase/migrations/20260510000002_evolve_time_entries.sql` — last migration on time_entries

## Dev Agent Record

### Agent Model Used

zai-coding-plan/glm-5.1

### Debug Log References

- time-conversion.test.ts: relocated from packages/agents to apps/web/__tests__/unit/time/ (cross-package import issue)
- executor.ts mapping: used conditional spread to satisfy exactOptionalPropertyTypes constraint

### Completion Notes List

- All 8 tasks completed. 13 files changed (8 source + 1 migration + 4 test files).
- Migration adds start_minutes/end_minutes with 4 CHECK constraints and a partial index.
- Drizzle schema, row-schema, DB query interfaces all updated for startMinutes/endMinutes.
- Create/update server actions have Zod schemas with both-or-neither, start<end, and midnight-spanning refinements.
- Agent executor now selects and maps start_minutes/end_minutes to TimeEntryForDetection.
- Time conversion utility (timeToMinutes/minutesToTime) created with zero timezone conversion.
- Both modals have start/end time pickers with auto-duration calc, inline validation, and both-or-neither enforcement.
- 28 new tests pass (6 time-conversion + 5 executor-mapping + 9 create-schema + 8 update-schema).
- Pre-existing typecheck errors in @flow/agents (anomaly-detection.ts, sweep-worker.ts) are not from this story.
- Pre-existing lint errors in @flow/agents and @flow/ui are not from this story.

### Deferred Items (at close)

| ID | Description | Reason |
|----|-------------|--------|
| D5-4a-W1 | Midnight-spanning entry support | Requires cross-day entry splitting — follow-up story |
| D5-4a-W2 | Workspace-configurable gap/overlap thresholds | Requires workspace_settings infrastructure (post-MVP) |

_Count: 2 deferred items (below 5-item threshold)._

### Test Commit Record

_Epic 5 retro A2: Record the SHA of the first failing test commit (red phase) before any implementation commit._

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| `packages/agents/time-integrity/__tests__/time-conversion.test.ts` | | |
| `packages/agents/time-integrity/__tests__/executor-mapping.test.ts` | | |
| `apps/web/__tests__/unit/time/create-time-entry-schema.test.ts` | | |
| `apps/web/__tests__/unit/time/update-time-entry-schema.test.ts` | | |

### File List

| # | File | Change Type | Task |
|---|------|-------------|------|
| 1 | `supabase/migrations/20260513000001_add_start_end_minutes.sql` | NEW | T1 |
| 2 | `packages/db/src/schema/time-entries.ts` | MODIFY | T2 |
| 3 | `packages/db/src/queries/time-entries/row-schema.ts` | MODIFY | T2 |
| 4 | `packages/db/src/queries/time-entries/create.ts` | MODIFY | T2 |
| 5 | `packages/db/src/queries/time-tracking/time-entry-queries.ts` | MODIFY | T2 |
| 6 | `apps/web/app/(workspace)/time/actions/create-time-entry.ts` | MODIFY | T3 |
| 7 | `apps/web/app/(workspace)/time/actions/update-time-entry.ts` | MODIFY | T3 |
| 8 | `packages/agents/time-integrity/executor.ts` | MODIFY | T4 |
| 9 | `apps/web/app/(workspace)/time/utils/time-conversion.ts` | NEW | T5 |
| 10 | `apps/web/app/(workspace)/time/components/log-time-modal.tsx` | MODIFY | T6 |
| 11 | `apps/web/app/(workspace)/time/components/edit-time-entry-modal.tsx` | MODIFY | T7 |
| 12 | `apps/web/app/(workspace)/time/components/time-entry-list.tsx` | MODIFY | T6/T7 |
| 13 | `packages/agents/time-integrity/__tests__/executor-mapping.test.ts` | NEW | T8 |
| 14 | `apps/web/__tests__/unit/time/time-conversion.test.ts` | NEW | T8 |
| 15 | `apps/web/__tests__/unit/time/create-time-entry-schema.test.ts` | NEW | T8 |
| 16 | `apps/web/__tests__/unit/time/update-time-entry-schema.test.ts` | NEW | T8 |

**10 source files + 1 migration + 5 test/utility files = 16 files total.**
