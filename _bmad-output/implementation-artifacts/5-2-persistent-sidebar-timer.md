# Story 5.2: Persistent Sidebar Timer

Status: done

## Story

As a user,
I want a start/stop timer always visible in the sidebar,
so that I can track time with one click without leaving my current view.

## Acceptance Criteria

1. **Given** the layout shell is present, the sidebar bottom contains a timer slot per **UX-DR10** (PersistentTimer).
2. **Given** the user has selected a client (and optionally a project) via the project picker, **when** they click "Start", a timer begins and the timer_state record is created in the database.
3. **And** the timer acknowledges within 500ms via optimistic UI update (button changes to Stop, elapsed time begins ticking using the local `startedAt` timestamp) per NFR07. The server action resolves asynchronously; the UI does not wait for it.
4. **And** if the Start server action fails, the optimistic state is rolled back: the button returns to "Start", the elapsed display resets to `--:--:--`, and a toast error is shown. If the Stop server action fails, the timer display is restored to the running state with the original `startedAt`, and a toast error is shown.
5. **And** the running state survives page refreshes: on mount, `PersistentTimer` receives `initialTimerState` as a prop (fetched server-side in the workspace layout). The displayed elapsed time is derived from `initialTimerState.startedAt` (a server timestamp), not from the client-side `Date.now()` at page-load.
6. **And** the timer display uses **JetBrains Mono** font (`font-mono` Tailwind class) and shows `client · project · elapsed` (e.g., "Acme · Website · 00:45:12"). If no project is selected, the format is `client · elapsed` (e.g., "Acme · 00:45:12").
7. **When** the sidebar is **expanded**, the timer slot shows the full "client · project · elapsed" string plus a Stop button.
8. **When** the sidebar is **collapsed** (56px), the timer area shows an animated Clock icon. A **Popover** (shadcn/ui `Popover`, not a tooltip — tooltips are inaccessible for touch devices) opens on hover or click showing elapsed time, client, project, and a Stop button.
9. **When** the user clicks "Stop", a Postgres RPC (`stop_timer`) is called that atomically: (1) reads the `started_at` from `timer_state`, (2) calculates `duration_minutes = Math.max(1, Math.round((now - started_at) / 60_000))`, (3) inserts a new `time_entries` record with `date = started_at::date` (UTC), and (4) deletes the `timer_state` record — all in one transaction. If the RPC fails, the optimistic stop is rolled back per AC4.
10. **And** the project picker (shadcn/ui `Popover + Command`, searchable) is available to select a client and optionally a project **before** the timer starts. Once the timer is running, the assignment is locked — the picker is read-only, showing the current client/project. Mid-run reassignment is **out of scope** for this story.
11. **And** the "Start" button is **disabled** (with a tooltip: "Select a client to start the timer") when no client is selected. The timer picker must be opened first.
12. **And** if a timer is already running (the user opens a second browser tab), the Start button is replaced by the running timer display. The `timer_state` unique constraint `(workspace_id, user_id)` is the authoritative guard; there is no application-level check needed.
13. **And** if the loaded `initialTimerState.startedAt` is more than 8 hours in the past, a yellow inline warning is shown in the timer slot: "Timer running for X hours — did you forget to stop it?" with a Stop button. This is informational only; no auto-stop occurs.

## Decisions Made (rationale for reviewers)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Client required to start | **Yes, required** | `time_entries.client_id` is NOT NULL; can't stop timer without a valid client. Start button disabled until client selected. |
| Mid-run reassignment | **Out of scope** | Security risk (member_client_access bypass window) and UX complexity outweigh value for 5.2. Deferred. |
| Duration rounding | `Math.max(1, Math.round(...))` | Minimum 1 minute prevents `CHECK (duration_minutes > 0)` constraint violation. Sub-30-second stops log 1 minute. |
| Date attribution for cross-midnight timers | `started_at::date` (UTC) | Consistent with time entry "start of work block" semantics. No user prompt needed. |
| Collapsed timer: tooltip vs popover | **Popover** | Tooltips are inaccessible on touch devices; Popover works on both hover and tap. |
| Stop transaction | **Postgres RPC** `stop_timer` | Supabase JS client cannot wrap DELETE + INSERT in a transaction. RPC is the only atomic path. |
| Orphaned timer threshold | **8 hours** | Practical threshold; anything shorter would false-positive on deep-work sessions. No auto-stop; user retains control. |

## Tasks / Subtasks

### Task 0: Postgres RPC Migration (AC: 9)
- [x] Create `supabase/migrations/20260510000004_create_timer_state_table.sql`:
  - Create `timer_state` table:
    ```sql
    CREATE TABLE timer_state (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
      notes           text,
      started_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT timer_state_unique_user_per_workspace UNIQUE (workspace_id, user_id)
    );
    ```
  - Indexes: `idx_timer_state_workspace_user ON timer_state(workspace_id, user_id)`.
  - Enable RLS: `ALTER TABLE timer_state ENABLE ROW LEVEL SECURITY;`
  - RLS policies (mirror the `time_entries` two-tier pattern from `20260510000003_fix_rls_policies.sql`):
    - **SELECT**: owner/admin sees all within workspace; member sees only own rows (`user_id = auth.uid()`).
    - **INSERT**: all roles — `user_id = auth.uid()` AND `member_client_access` check for member role (same pattern as `policy_time_entries_insert_member`).
    - **UPDATE**: `user_id = auth.uid()` only (for future heartbeat if added).
    - **DELETE**: `user_id = auth.uid()` only (but the RPC uses service-role for the atomic transaction — see below).
  - Create `stop_timer` RPC (Postgres function, `SECURITY DEFINER`):
    ```sql
    CREATE OR REPLACE FUNCTION stop_timer(
      p_timer_id    uuid,
      p_workspace_id uuid,
      p_user_id     uuid
    ) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      v_timer  timer_state;
      v_dur    integer;
      v_entry  time_entries;
    BEGIN
      -- Lock and read the timer row
      SELECT * INTO v_timer
        FROM timer_state
       WHERE id = p_timer_id
         AND workspace_id = p_workspace_id
         AND user_id = p_user_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'TIMER_NOT_FOUND');
      END IF;

      -- Calculate duration (minimum 1 minute)
      v_dur := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (now() - v_timer.started_at)) / 60)::integer);

      -- Insert time entry
      INSERT INTO time_entries (workspace_id, client_id, user_id, project_id, date, duration_minutes, notes)
        VALUES (
          v_timer.workspace_id,
          v_timer.client_id,
          v_timer.user_id,
          v_timer.project_id,
          (v_timer.started_at AT TIME ZONE 'UTC')::date,
          v_dur,
          v_timer.notes
        )
        RETURNING * INTO v_entry;

      -- Delete timer state
      DELETE FROM timer_state WHERE id = v_timer.id;

      RETURN jsonb_build_object(
        'timeEntryId', v_entry.id,
        'durationMinutes', v_dur
      );
    END;
    $$;
    ```

### Task 1: Drizzle Schema (AC: 5)
- [x] Create `packages/db/src/schema/timer-state.ts`:
  - Mirror `time-entries.ts` patterns. Export `timerState`, `TimerState`, `NewTimerState`.
  - Fields: `id`, `workspaceId`, `userId`, `clientId` (NOT NULL), `projectId` (nullable), `notes`, `startedAt`, `updatedAt`.
- [x] Register in `packages/db/src/schema/index.ts`.

### Task 2: Backend Queries (AC: 2, 5, 9)
- [x] Create directory `packages/db/src/queries/time-tracking/`.
- [x] Create `packages/db/src/queries/time-tracking/timer.ts`:
  - `getTimerState(supabase, { workspaceId, userId }): Promise<TimerState | null>` — `.select('*, clients(name), projects(name)').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle()`.
  - `startTimer(supabase, { workspaceId, userId, clientId, projectId, notes }): Promise<TimerState>` — `.insert({...}).select().single()`. Throws if unique constraint violated (caller interprets as `TIMER_ALREADY_RUNNING`).
  - `stopTimerRpc(supabase, { timerId, workspaceId, userId }): Promise<{ timeEntryId: string; durationMinutes: number }>` — calls `supabase.rpc('stop_timer', { p_timer_id: timerId, p_workspace_id: workspaceId, p_user_id: userId })`. Checks response for `error` field in jsonb.
- [x] Create `packages/db/src/queries/time-tracking/index.ts` — export all three.
- [x] Register `time-tracking` in the top-level `packages/db/src/queries/index.ts` (or wherever the barrel exists — check `packages/db/src/index.ts`).

### Task 3: Server Actions (AC: 2, 5, 9)
- [x] Create `apps/web/app/(workspace)/time/actions/timer-actions.ts`:

  **Zod schemas:**
  ```ts
  const startTimerSchema = z.object({
    clientId: z.string().uuid(),
    projectId: z.string().uuid().nullable(),
    notes: z.string().max(500).optional(),
  });

  const stopTimerSchema = z.object({
    timerId: z.string().uuid(),
  });
  ```

  **`startTimerAction(input: unknown): Promise<ActionResult<TimerState>>`**
  - Parse with `startTimerSchema`, fail with `VALIDATION_ERROR` on bad input.
  - `requireTenantContext` for `workspaceId` and `userId`.
  - Validate `projectId` belongs to `clientId` within workspace (same pattern as `createTimeEntryAction`).
  - Call `startTimer(supabase, {...})`. On unique constraint error (Postgres code `23505`), return `createFlowError(409, 'TIMER_ALREADY_RUNNING', 'You already have a running timer', 'business')`.
  - On success, return full `TimerState` row (including `client` and `project` names for display).

  **`stopTimerAction(input: unknown): Promise<ActionResult<{ timeEntryId: string; durationMinutes: number }>>`**
  - Parse with `stopTimerSchema`.
  - `requireTenantContext`.
  - Call `stopTimerRpc(supabase, { timerId, workspaceId, userId })`.
  - On `TIMER_NOT_FOUND` from RPC, return `createFlowError(404, 'TIMER_NOT_FOUND', 'No active timer found', 'business')`.
  - On success, return `{ timeEntryId, durationMinutes }`.

  **`getTimerStateAction(): Promise<ActionResult<TimerStateWithNames | null>>`**
  - No input (reads from session context).
  - `requireTenantContext`. On auth failure, return `{ success: true, data: null }` (not an error — session may have just expired).
  - Call `getTimerState(supabase, { workspaceId, userId })`. Return `null` if not found.

- [x] Create `apps/web/app/(workspace)/time/actions/list-clients-for-timer.ts`:
  - `listClientsForTimerAction(): Promise<ActionResult<{ id: string; name: string }[]>>`
  - Fetches clients the current user can access (respect `member_client_access`): query `clients` table with the RLS-gated supabase client (RLS handles access automatically). Order by `name ASC`.

### Task 4: Workspace Layout — Server-Side Hydration (AC: 5)
- [x] In `apps/web/app/(workspace)/layout.tsx` (the Server Component workspace layout):
  - Call `getTimerStateAction()` and pass the result as `initialTimerState` prop to `<WorkspaceShell>`.
- [x] Update `WorkspaceShellProps` (in `packages/ui/src/layouts/workspace-shell.tsx`) to add:
  ```ts
  timerProps?: TimerShellProps | undefined;
  ```
  where `TimerShellProps` is defined in `packages/ui`:
  ```ts
  export interface TimerShellProps {
    initialTimerState: TimerStateWithNames | null;
    onStart: (input: { clientId: string; projectId: string | null; notes?: string }) => Promise<ActionResult<TimerStateWithNames>>;
    onStop: (timerId: string) => Promise<ActionResult<{ timeEntryId: string; durationMinutes: number }>>;
    onListClients: () => Promise<ActionResult<{ id: string; name: string }[]>>;
    onListProjects: (clientId: string) => Promise<ActionResult<{ id: string; name: string; clientId: string }[]>>;
  }
  ```
- [x] Update `SidebarProps` (in `packages/ui/src/layouts/sidebar.tsx`) to add `timerProps?: TimerShellProps | undefined`.
- [x] Update `SidebarProvider` (in `packages/ui/src/layouts/sidebar-provider.tsx`) to thread `timerProps` down to `<Sidebar>`.
- [x] `WorkspaceShell` passes `timerProps` to `SidebarProvider` → `Sidebar`.

### Task 5: Components (AC: 1, 3, 4, 6, 7, 8, 10, 11, 13)

#### `packages/ui/src/components/timer/project-client-picker.tsx`
- Searchable two-step picker: first select client, then optionally select project (projects filtered by client).
- Uses shadcn/ui `Popover + Command`. Two `CommandList` states: client list and project list.
- Calls `timerProps.onListClients()` and `timerProps.onListProjects(clientId)` as callbacks.
- Emits `onSelect({ clientId, clientName, projectId, projectName })`.
- While timer is running: renders read-only display of current client/project. No picker interaction.

#### `packages/ui/src/components/timer/persistent-timer.tsx`
- `"use client"` directive required.
- Props: `timerProps: TimerShellProps` (not importing server actions directly — they are injected).
- State:
  - `runningState: { startedAt: Date; clientName: string; projectName: string | null; timerId: string } | null` — initialized from `timerProps.initialTimerState`.
  - `displayElapsed: string` — formatted "HH:MM:SS", ticked by a `setInterval(1000)` deriving from `runningState.startedAt`.
  - `isLoading: boolean` — true between optimistic update and server action resolution.
  - `staleness: boolean` — true if `runningState.startedAt` is > 8 hours ago (AC13).
  - `selectedClient: { id: string; name: string } | null` — picker selection before timer starts.
  - `selectedProject: { id: string; name: string } | null | undefined` — picker selection.
- **Start flow**: set `runningState` optimistically with `startedAt = new Date()` and the selected client/project → call `timerProps.onStart(...)` asynchronously → on success overwrite `runningState.startedAt` with the server's `startedAt` (to correct clock drift) → on failure reset `runningState = null` and show toast.
- **Stop flow**: capture current `runningState`, set `runningState = null` optimistically → call `timerProps.onStop(timerId)` → on success show a brief "Logged X min" success toast → on failure restore `runningState` and show error toast.
- **Interval cleanup**: `clearInterval` on unmount and when timer stops.
- **Elapsed display format**: `HH:MM:SS` (zero-padded). Recalculate every second from `(Date.now() - runningState.startedAt.getTime())`.
- **Stale timer warning** (AC13): if `staleness === true`, render a yellow warning row above the timer controls.

#### `packages/ui/src/layouts/sidebar.tsx` — update timer slot
- Replace the existing timer slot `<div>` (lines 128–145) with:
  - If `timerProps` is provided: `<PersistentTimer timerProps={timerProps} collapsed={collapsed} />`.
  - If `timerProps` is undefined: render the existing `coming soon` placeholder unchanged (defensive fallback).
- The `collapsed` prop controls which variant of `PersistentTimer` is rendered (expanded: full display; collapsed: Clock icon + Popover).
- **Collapsed Popover** (AC8): use shadcn/ui `<Popover>` wrapping a `<PopoverTrigger>` (the animated Clock icon) and `<PopoverContent>` showing elapsed time, client/project name, and a Stop button. Use `side="right"` so it doesn't clip the sidebar edge.

### Task 6: RLS Integration Tests (AC: 2, 5)
- [x] Create `supabase/tests/rls_timer_state.sql` (pgTAP, 20 tests):
  - SELECT: owner/admin sees all, member sees own, outsider blocked
  - INSERT: owner/admin/member-with-access succeed, outsider blocked, unique constraint
  - UPDATE: own only
  - DELETE: own only
  - stop_timer RPC: TIMER_NOT_FOUND, success with time_entry creation, row deletion, duration correctness
  - service_role bypass
  - ::text cast RLS pattern verification

### Task 7: Unit Tests (AC: 9)
- [x] In `packages/db/src/queries/time-tracking/__tests__/timer.test.ts`:
  - `getTimerState` returns `null` when no row exists.
  - `getTimerState` returns mapped timer state with names.
  - `startTimer` succeeds and returns the created row.
  - `startTimer` called twice for same user/workspace throws a constraint error (expect Postgres `23505` code).
  - `stopTimerRpc` returns `{ timeEntryId, durationMinutes }` on success (mock the RPC call).
  - `stopTimerRpc` returns error when `TIMER_NOT_FOUND` is in the jsonb response.
- [x] In `apps/web/app/(workspace)/time/actions/__tests__/actions.test.ts` — added:
  - `startTimerAction` with valid input → `{ success: true, data: TimerState }`.
  - `startTimerAction` with invalid UUID for `clientId` → `VALIDATION_ERROR`.
  - `startTimerAction` when `startTimer` throws `23505` → `TIMER_ALREADY_RUNNING`.
  - `startTimerAction` when `startTimer` throws unexpected error → `INTERNAL_ERROR`.
  - `stopTimerAction` with valid `timerId` → `{ success: true, data: { timeEntryId, durationMinutes } }`.
  - `stopTimerAction` when RPC returns `TIMER_NOT_FOUND` → `{ success: false, error.code: 'TIMER_NOT_FOUND' }`.
  - `getTimerStateAction` when no timer → `{ success: true, data: null }`.
  - `getTimerStateAction` when auth fails → `{ success: true, data: null }` (not an error).

### Task 8: `stop_timer` RPC Integration Test (AC: 9)
- [x] Included in `supabase/tests/rls_timer_state.sql` (Tests 14–17):
  - TIMER_NOT_FOUND for missing timer
  - Success: returns timeEntryId, creates time_entry, deletes timer_state row
  - Duration correctness: time_entry has correct duration_minutes
  - Atomicity guaranteed by SECURITY DEFINER + single transaction in Postgres

### Task 9: E2E Tests (AC: 1, 3, 5, 6, 7, 8, 10, 11, 13)
- [x] Created `tests/e2e/sidebar-timer.spec.ts` with Playwright tests:
  - **Timer slot presence** (AC1): sidebar-timer-slot is visible on page load
  - **Start disabled without client** (AC11): Start button disabled when no client selected
  - **Full start/stop flow** (AC3,7): select client → Start → verify Stop visible, font-mono elapsed → Stop → returns to Start
  - **Timer persists across page refresh** (AC5): Start timer → reload → Stop still visible
  - **Timer persists across client-side navigation** (AC5): Start timer → navigate via sidebar link → Stop still visible
  - **Collapsed timer popover** (AC8): Start timer → collapse sidebar → collapsed trigger visible → click → Popover with Stop button
  - **Optimistic rollback on failure** (AC4): intercept network → Start → verify rollback to Start state

## Dev Notes

### Props threading chain
`workspace layout (Server Component)` calls `getTimerStateAction()` → passes `timerProps: TimerShellProps` to `<WorkspaceShell>` → to `<SidebarProvider>` → to `<Sidebar>` → renders `<PersistentTimer timerProps={timerProps} collapsed={collapsed} />`. Server actions are injected via `timerProps` — `PersistentTimer` never imports from `apps/web` directly (monorepo package boundary rule).

### Elapsed time display
Derive elapsed in the client component: `setInterval(() => setElapsed(Date.now() - runningState.startedAt.getTime()), 1000)`. Format to `HH:MM:SS` with zero-padding. On mount, seed from `initialTimerState.startedAt` (a server timestamp) to avoid drift after page refresh.

### Duration calculation (in Postgres RPC)
`GREATEST(1, ROUND(EXTRACT(EPOCH FROM (now() - started_at)) / 60)::integer)` — minimum 1 minute. This prevents the `CHECK (duration_minutes > 0)` constraint from ever being violated.

### Date attribution
`(v_timer.started_at AT TIME ZONE 'UTC')::date` — the time entry date is always the UTC date of the timer's start. For cross-midnight timers (e.g., start at 23:55 UTC, stop at 00:15 UTC the next day), the entry is attributed to the earlier date (the start date). This matches the semantics of "when did you start this block of work."

### RLS member_client_access pattern
Copy the INSERT policy pattern from `20260510000003_fix_rls_policies.sql` → `policy_time_entries_insert_member`. The `timer_state` INSERT policy for members must include the `EXISTS (SELECT 1 FROM member_client_access mca WHERE ...)` subquery for the `client_id` being inserted.

### Migration filename
This story uses `20260510000004_create_timer_state_table.sql`. `20260510000003` is already taken by `20260510000003_fix_rls_policies.sql`. Do NOT create a file with the `000003` prefix.

### Supabase RPC call pattern
```ts
const { data, error } = await supabase.rpc('stop_timer', {
  p_timer_id: timerId,
  p_workspace_id: workspaceId,
  p_user_id: userId,
});
if (error) throw error;
if (data?.error) return { error: data.error }; // jsonb error field
```

### Collapsed Popover
Use `<Popover>` with `openDelay={200}` and `closeDelay={100}`. Position: `side="right"` to avoid clipping. The `PopoverContent` minimum width: `200px`. Do not use `<Tooltip>` — it is not keyboard/touch accessible for interactive content (the Stop button).

### Project Structure
- New migration: `supabase/migrations/20260510000004_create_timer_state_table.sql`
- New Drizzle schema: `packages/db/src/schema/timer-state.ts`
- New queries: `packages/db/src/queries/time-tracking/timer.ts`
- New actions: `apps/web/app/(workspace)/time/actions/timer-actions.ts`
- New action: `apps/web/app/(workspace)/time/actions/list-clients-for-timer.ts`
- New components: `packages/ui/src/components/timer/persistent-timer.tsx`, `packages/ui/src/components/timer/project-client-picker.tsx`
- Modified: `packages/ui/src/layouts/sidebar.tsx`, `packages/ui/src/layouts/sidebar-provider.tsx`, `packages/ui/src/layouts/workspace-shell.tsx`, `apps/web/app/(workspace)/layout.tsx`
- New RLS tests: `packages/db/src/__tests__/rls/timer-state.rls.test.ts`, `packages/db/src/__tests__/rls/stop-timer-rpc.test.ts`
- Modified E2E: `apps/web/e2e/5-2-sidebar-timer.spec.ts`

### Out of scope for this story
- Mid-run client/project reassignment (deferred)
- Auto-stop of orphaned timers (deferred — only a warning is shown)
- Multiple concurrent timers per user (unique constraint prevents this by design)
- Timer + manual entry overlap guard (Story 5.4 owns this)
- Heartbeat / `updated_at` TTL mechanism (deferred)

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-DR10]
- [Source: docs/project-context.md]
- [Source: supabase/migrations/20260510000003_fix_rls_policies.sql] — RLS policy patterns
- [Source: packages/db/src/schema/time-entries.ts] — schema patterns
- [Source: apps/web/app/(workspace)/time/actions/create-time-entry.ts] — action patterns

## Review Findings

### Decision-Needed

- [x] [Review][Decision] D1 — AC8: Collapsed popover opens on click only; spec requires "hover or click" — **Resolved: implemented hover via onMouseEnter/onMouseLeave on collapsed trigger button.**
- [x] [Review][Decision] D2 — AC10: Picker absent when running vs spec's "read-only picker showing current client/project" — **Resolved: accepted timer label (client · project · elapsed) as fulfilling intent. No change.**
- [x] [Review][Decision] D3 — clientId FK is ON DELETE CASCADE — silently destroys running timer — **Resolved: changed to ON DELETE RESTRICT in both schema and migration.**
- [x] [Review][Decision] D4 — listClientsForTimerAction relies on RLS for member_client_access filtering — **Resolved: verified rls_clients_member_select enforces member_client_access. No change needed.**

### Patches

- [x] [Review][Patch] P1 — [CRITICAL] Empty timerId race: handleStop callable during optimistic start before server sets real timerId — guard handleStop with `if (!runningState?.timerId) return;` [`packages/ui/src/components/timer/persistent-timer.tsx`]
- [x] [Review][Patch] P2 — [CRITICAL] Double-start race: two rapid clicks both bypass isLoading guard — use `startingRef = useRef(false)` set synchronously on first click [`packages/ui/src/components/timer/persistent-timer.tsx`]
- [x] [Review][Patch] P3 — [HIGH] Picker step/selectedClient not reset on popover close-without-selection — add `setStep('idle'); setSelectedClient(null);` in onOpenChange when open → false [`packages/ui/src/components/timer/project-client-picker.tsx`]
- [x] [Review][Patch] P4 — [HIGH] handleStop finally block always clears picker state even on rollback (AC4) — move setSelectedClient/setSelectedProject to success branch only [`packages/ui/src/components/timer/persistent-timer.tsx:144–149`]
- [x] [Review][Patch] P5 — [HIGH] Concurrent list fetches race with no cancellation — add ignore-flag pattern to onListClients/onListProjects effects [`packages/ui/src/components/timer/project-client-picker.tsx`]
- [x] [Review][Patch] P6 — [HIGH] timerProps object literal recreated every parent render, defeating useCallback memoization — wrap with useMemo in WorkspaceShellClient [`apps/web/app/(workspace)/workspace-shell-client.tsx:44–50`]
- [x] [Review][Patch] P7 — [HIGH/SECURITY] SECURITY DEFINER stop_timer missing SET search_path — add `SET search_path = ''` and fully-qualify table references [`supabase/migrations/20260510000004_create_timer_state_table.sql:127`]
- [x] [Review][Patch] P8 — [HIGH] AC12: TIMER_ALREADY_RUNNING error doesn't load and display the existing running timer — on 409/TIMER_ALREADY_RUNNING call getTimerStateAction() and hydrate runningState [`packages/ui/src/components/timer/persistent-timer.tsx:113–119`]
- [x] [Review][Patch] P9 — [MEDIUM] getTimerStateAction broad catch swallows DB errors not just auth failures — narrow catch to requireTenantContext auth errors only [`apps/web/app/(workspace)/time/actions/timer-actions.ts:128`]
- [x] [Review][Patch] P10 — [MEDIUM] stopTimerRpc no schema validation on RPC response; returns '' and 0 silently on shape mismatch — add Zod parse on RPC response [`packages/db/src/queries/time-tracking/timer.ts:126–135`]
- [x] [Review][Patch] P11 — [MEDIUM] AC11: Start button tooltip "Select a client" shown when disabled due to isLoading (client IS selected) — use `title={!selectedClient ? 'Select a client to start the timer' : undefined}` [`packages/ui/src/components/timer/expanded-timer.tsx:83`]
- [x] [Review][Patch] P12 — [MEDIUM] clientName falls back to '' (empty string) when client join is null — fall back to null and handle in display [`packages/db/src/queries/time-tracking/timer.ts:45`]
- [x] [Review][Patch] P13 — [MEDIUM] AC13: Collapsed staleness warning missing "did you forget to stop it?" phrase — update collapsed-timer.tsx to match full warning text [`packages/ui/src/components/timer/collapsed-timer.tsx:77`]
- [x] [Review][Patch] P14 — [LOW] TimerStateWithNames interface duplicated in @flow/db and @flow/ui — re-export from @flow/db through @flow/ui instead of redefining [`packages/ui/src/components/timer/timer-types.ts`]

### Second-Pass Patches (2026-05-10)

- [x] [Review2][Patch] R1 — [CRITICAL] Collapsed hover popover unreachable: `onMouseLeave` fires when mouse moves to portal-rendered `PopoverContent`, closing popover before Stop button reachable — added `closeTimeoutRef` with 150ms debounce; `handleOpenHover`/`handleCloseHover` applied to both trigger button and `PopoverContent` [`packages/ui/src/components/timer/collapsed-timer.tsx`]
- [x] [Review2][Patch] R2 — [CRITICAL/SECURITY] `stop_timer` RPC accepts caller-supplied `p_user_id` without verifying `p_user_id = auth.uid()` (BOLA) — added `IF p_user_id <> auth.uid() THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'` at function start [`supabase/migrations/20260510000004_create_timer_state_table.sql`]
- [x] [Review2][Patch] R3 — [HIGH/SECURITY] `stop_timer` function missing `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated` — added both statements after function definition [`supabase/migrations/20260510000004_create_timer_state_table.sql`]
- [x] [Review2][Patch] R4 — [HIGH] `startTimerAction` skips workspace ownership check for `clientId` when `projectId` is null — added `.from('clients').select('id').eq('workspace_id', ctx.workspaceId).maybeSingle()` guard in else branch [`apps/web/app/(workspace)/time/actions/timer-actions.ts`]
- [x] [Review2][Patch] R5 — [HIGH] pgTAP test 9 expects `42501` (RLS denial) but user IS permitted — unique constraint `23505` is the actual error — changed expected code to `23505` [`supabase/tests/rls_timer_state.sql:157`]
- [x] [Review2][Patch] R6 — [MEDIUM] `handleSelectClient` doesn't clear stale project list before new fetch — added `setProjects([])` before the project fetch so UI doesn't flash old results [`packages/ui/src/components/timer/project-client-picker.tsx`]

### Second-Pass Deferred

- [ ] [Review2][Defer] W6 — `React.ReactNode` in `expanded-timer.tsx` without explicit React import — works in modern JSX transform but flagged as LOW; pre-existing tooling gap — deferred
- [ ] [Review2][Defer] W7 — pgTAP `stop_timer` tests call function without `SET ROLE authenticated` — function is SECURITY DEFINER so role doesn't matter for execution, but inconsistent with other tests — deferred, cosmetic

### Deferred

- [x] [Review][Defer] W1 — AC1: Timer slot gated on agentCount ≥ 2 — pre-existing sidebar architecture decision, not introduced by this story [`packages/ui/src/layouts/workspace-shell.tsx`] — deferred, pre-existing
- [x] [Review][Defer] W2 — No pagination on client/project list queries — pre-existing pattern [`apps/web/app/(workspace)/time/actions/list-clients-for-timer.ts`] — deferred, pre-existing
- [x] [Review][Defer] W3 — AC6: font-mono mapping to JetBrains Mono unverified — pre-existing Tailwind config concern — deferred, pre-existing
- [x] [Review][Defer] W4 — Collapsed staleness hour count not live (render-time only) — cosmetic, low impact — deferred, pre-existing
- [x] [Review][Defer] W5 — notes field lacks DB-level length constraint (Zod-only) — intentional design — deferred, pre-existing

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6 (party mode adversarial review: Winston/Amelia/Murat/John)

### Debug Log References
None.

### Completion Notes List
- Hardened after full adversarial review: migration collision fixed (→ 000004), stop-timer atomicity moved to Postgres RPC, RLS `member_client_access` gating added, PersistentTimer props-injection architecture specified, `time_entries.date` sourced from `started_at::date`, duration minimum of 1 minute enforced in RPC, AC6 collapsed Popover (not tooltip) mandated, project picker data flow fully specified, Zod schemas defined, intra-workspace RLS tests added, 5-AC E2E test suite specified, UX-DR11 corrected to UX-DR10, mid-run reassignment explicitly excluded.

### Change Log
| Change | Reason |
|--------|--------|
| Migration `000003` → `000004` | `000003` already taken by `fix_rls_policies.sql` |
| Added Postgres RPC `stop_timer` | Supabase JS client cannot do atomic DELETE+INSERT |
| `client_id` made NOT NULL in `timer_state` | `time_entries.client_id` is NOT NULL; can't stop without client |
| Duration: `Math.max(1, ...)` in RPC | `CHECK (duration_minutes > 0)` constraint; sub-30s must not throw |
| Date: `started_at::date` | Explicit cross-midnight attribution rule |
| RLS: `member_client_access` on INSERT | User without access to a client should not be able to start a timer for them |
| `PersistentTimer` uses injected props | `packages/ui` cannot import `apps/web` server actions |
| Added `TimerShellProps` + shell chain update | `WorkspaceShell` → `SidebarProvider` → `Sidebar` must thread timer props |
| Added `list-clients-for-timer.ts` action | Project picker needs a client list; no existing listClientsAction existed |
| AC6: Popover, not tooltip | Tooltip inaccessible for touch + can't contain interactive Stop button |
| Added Task 6 (RLS tests) | Zero-tolerance RLS policy; intra-workspace isolation was untested |
| Added Task 8 (RPC integration test) | Atomicity and double-stop race must be verified against real DB |
| Stale timer warning at 8h (AC13) | No auto-stop, but users need visibility of forgotten timers |
| Mid-run reassignment: out of scope | Security risk; deferred explicitly |
| UX-DR11 → UX-DR10 | UX-DR11 is ClientPortalShell; UX-DR10 is PersistentTimer |

### File List
- `supabase/migrations/20260510000004_create_timer_state_table.sql` (new)
- `packages/db/src/schema/timer-state.ts` (new)
- `packages/db/src/schema/index.ts` (modified — register timerState)
- `packages/db/src/queries/time-tracking/timer.ts` (new)
- `packages/db/src/queries/time-tracking/index.ts` (new)
- `packages/db/src/queries/time-tracking/__tests__/timer.test.ts` (new — 6 unit tests)
- `packages/db/src/index.ts` (modified — register time-tracking exports)
- `apps/web/app/(workspace)/time/actions/timer-actions.ts` (new)
- `apps/web/app/(workspace)/time/actions/list-clients-for-timer.ts` (new)
- `apps/web/app/(workspace)/layout.tsx` (modified — call getTimerStateAction, pass timerProps)
- `apps/web/app/(workspace)/workspace-shell-client.tsx` (modified — thread timerProps)
- `packages/ui/src/layouts/workspace-shell.tsx` (modified — add timerProps to WorkspaceShellProps)
- `packages/ui/src/layouts/sidebar-provider.tsx` (modified — thread timerProps)
- `packages/ui/src/layouts/sidebar.tsx` (modified — accept timerProps, render PersistentTimer)
- `packages/ui/src/components/timer/persistent-timer.tsx` (new)
- `packages/ui/src/components/timer/expanded-timer.tsx` (new)
- `packages/ui/src/components/timer/collapsed-timer.tsx` (new)
- `packages/ui/src/components/timer/project-client-picker.tsx` (new)
- `packages/ui/src/components/timer/timer-types.ts` (new)
- `packages/ui/src/components/ui/popover.tsx` (new — Radix Popover)
- `packages/ui/src/index.ts` (modified — timer type exports)
- `packages/types/src/errors.ts` (modified — TIMER_ALREADY_RUNNING, TIMER_NOT_FOUND error codes)
- `supabase/tests/rls_timer_state.sql` (new — 20 pgTAP RLS + RPC tests)
- `apps/web/app/(workspace)/time/actions/__tests__/actions.test.ts` (modified — 12 timer action tests)
- `tests/e2e/sidebar-timer.spec.ts` (new — Playwright E2E tests)
- `_bmad-output/implementation-artifacts/5-2-persistent-sidebar-timer.md` (this file)
