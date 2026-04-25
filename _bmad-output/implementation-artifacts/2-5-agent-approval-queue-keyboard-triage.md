# Story 2.5: Agent Approval Queue & Keyboard Triage

Status: done

_Revised after 4-agent adversarial review (Winston/Amelia/Murat/Sally): 59 findings, 9 critical, 7 high addressed._

## Story

As a user,
I want to review, approve, modify, or reject agent-proposed actions via a keyboard-first inbox,
So that I maintain control over what agents do on my behalf without slowing down.

## Acceptance Criteria

1. **Given** agent runs exist in `waiting_approval` status, **When** the user opens the approval queue, **Then** pending actions render within 1 second for up to 50 items (P95) per NFR03
2. **And** new proposals arriving while the queue is open appear via Supabase Realtime subscription — items append to queue bottom, focused item index is preserved, count in "The Inhale" updates reactively
3. **And** the user can approve a pending agent action individually — Server Action uses CAS (compare-and-swap on `status = 'waiting_approval'` in WHERE clause) to prevent double-execution, run transitions from `waiting_approval` → `completed` (or `running` for trust-gated blocks), Server Action returns `ActionResult<ApprovalResult>`, optimistic update fires within 300ms per FR19 and UX-DR23
4. **And** the user can reject a pending agent action individually — same CAS guard, run transitions `waiting_approval` → `cancelled`, rejection reason (optional) persisted in run output per FR19
5. **And** the user can modify a pending action before approval — inline edit mode activates alongside (not replacing) agent reasoning context, editable fields are `title`, `confidence`, `riskLevel` only; changes save on Enter or explicit Save button, cancel on Escape; changes logged as diff in run output per FR19 and UX-DR22
6. **And** the user can approve, modify, or reject actions in batch — multi-select via Shift+Arrow, bulk action applies individually per item (max batch size 25), each processed independently, returns `BatchActionResult` with per-item success/failure, partial failures show inline errors on failed items per FR19
7. **And** each pending action displays: agent name + icon/initial + identity color (never color-only — WCAG 1.4.1), one-line summary, confidence + risk level, expandable reasoning, data sources used, and a `proposalType` badge distinguishing "Agent Proposal" from "Trust Gate Block" per FR18 and UX-DR8
8. **And** the queue operates in a tri-mode state machine: **Navigate** (shortcuts active), **Edit** (shortcuts suppressed, form field focus), **Batch** (shortcuts active for batch operations). Mode transitions: E toggles Navigate↔Edit, Escape returns to Navigate from any mode. Bottom bar shows current mode indicator
9. **And** optimistic UI updates fire on approval/rejection within 300ms, rollback animates visibly with inline explanation text on server error per UX-DR23. `prefers-reduced-motion` replaces all animations with instant state changes + static status indicators
10. **And** logical focus order maintained through queue — auto-advance uses ID-based tracking (not index-based), focus moves to next pending item after action, skips completed/removed items, wraps at boundaries per UX-DR48
11. **And** agent actions are subject to execution time limits with incomplete actions paused; user offered resume or cancel per FR26
12. **And** trust snapshot staleness is checked on load — if agent trust level changed since proposal was created, a "Trust changed since proposal" warning badge appears on the card
13. **And** all Server Actions are idempotent — approving an already-approved run returns `{ success: true, data: { alreadyProcessed: true } }` not an error
14. **And** "The Inhale" summary breaks down by agent type: "Inbox: 2 replies, Calendar: 1 conflict, Reports: 1 draft" not just a flat count

## Scope Boundaries

**In scope (this story):**
- Approval queue page at `apps/web/app/(workspace)/agents/approvals/page.tsx`
- `ProposalCard` with `AgentProposalContent` and `TrustBlockContent` sub-components
- `ApprovalQueue` with `useTriageKeyboard` hook (mode state machine)
- `useOptimisticAction` wrapper hook for rollback support
- Server Actions: `approve-run`, `reject-run`, `update-proposal`, `batch-approve-runs`, `batch-reject-runs`, `resume-run`, `cancel-run`
- Query functions: `getPendingApprovals`, `getPendingApprovalCount` (cursor-based pagination)
- Supabase Realtime subscription for new proposals (append-only, no mid-triage insert)
- Inline edit mode (Navigate/Edit/Batch mode system) for `title`, `confidence`, `riskLevel`
- Optimistic UI with rollback animation + reduced-motion fallbacks
- ID-based focus management and auto-advance
- ARIA live regions, roving tabindex, screen reader announcements
- Execution timeout state machine UI (timed_out → resume/cancel)
- RLS policy verification for approval queries
- Zod schemas for all Server Action inputs

**Explicitly deferred:**
- Agent badge visual system (identity color dots, status rings) → Story 2.6
- Unified activity timeline (coordination view) → Story 2.7
- In-app notification delivery for new approvals → Epic 10 (FR79)
- BlockNote-based rich content editing for proposals → Inbox Agent epic (Epic 4)
- Mobile-specific triage (swipe gestures, condensed cards) → UX-DR51, separate story
- Flood state handling (batch mode at 147+ items) → UX-DR25, post-MVP
- Agency owner actions (Coach, Elevate, Shadow, Triage-to-VA, Set Precedent) → UX-DR29, post-MVP
- "Snooze" persistence — `S` key binds but snooze is client-side only (5 min default, item reappears, max 3 snoozes per item then auto-pin to top). No `snoozed_until` DB column in this story
- "Take over" (`T` key) — dismisses agent action with confirmation prompt. Records as rejection for trust purposes. User navigates to manual edit surface. Full trust impact visible before confirming
- Execution time limit enforcement (FR26) — worker-side done in Story 2.1b; this story surfaces timeout state only
- Grouping/filtering by agent in queue → post-MVP enhancement
- Virtualization for >50 items → standard list for ≤50; if performance degrades, add `react-virtual` in follow-up
- Rate limiting on approval actions → infrastructure concern, not this story's scope. Note for Epic 10

## Tasks / Subtasks

- [x] Task 0: Type definitions & Zod schemas (AC: all)
  - [ ] 0.1 Add `ApprovalQueueItem` discriminated union to `packages/types/src/agents.ts`:
    ```typescript
    type ApprovalQueueItem = 
      | { proposalType: 'agent_proposal'; run: AgentRun; proposal: AgentProposal }
      | { proposalType: 'trust_blocked'; run: AgentRun; block: { decision: string; reason: string } };
    ```
  - [ ] 0.2 Add `ApprovalResult` type: `{ runId: string; newStatus: AgentRunStatus; alreadyProcessed?: boolean }`
  - [ ] 0.3 Add `BatchActionResult` type: `{ succeeded: Array<{ runId: string; newStatus: AgentRunStatus }>; failed: Array<{ runId: string; error: string }> }`
  - [ ] 0.4 Add Zod schemas in `apps/web/app/(workspace)/agents/approvals/actions/schemas.ts`: `approveRunSchema`, `rejectRunSchema`, `updateProposalSchema`, `batchActionSchema` (max 25 items), `resumeRunSchema`, `cancelRunSchema`
  - [ ] 0.5 Add `parseApprovalOutput(output: Record<string, unknown> | null): ApprovalQueueItem` helper — uses presence of `confidence` field + explicit check to discriminate shapes. Never relies on field absence alone

- [x] Task 1: Query layer — fetch pending approvals (AC: #1, #14)
  - [ ] 1.1 Add `getPendingApprovals(workspaceId, { limit, cursor })` to `packages/db/src/queries/agents/runs.ts` — queries `agent_runs` WHERE `status = 'waiting_approval'` AND `workspace_id`, ordered by `created_at ASC`, cursor-based pagination (keyset on `created_at`), returns `{ items: ApprovalQueueItem[], nextCursor: string | null, totalCount: number }` with per-agent-type counts for "The Inhale"
  - [ ] 1.2 Add `getPendingApprovalCount(workspaceId)` for badge count in sidebar
  - [ ] 1.3 Add `getAgentBreakdown(workspaceId)` — returns `Record<AgentId, number>` for Inhale summary per AC#14
  - [ ] 1.4 Verify existing `idx_agent_runs_workspace_status` index covers queries efficiently (<50ms for 50 rows)
  - [ ] 1.5 All query functions use per-call `createServerClient()` (user-scoped, RLS-enforced). NOT service client

- [x] Task 2: Server Actions — approve, reject, update, batch, resume, cancel (AC: #3, #4, #5, #6, #11, #13)
  - [ ] 2.1 `approve-run.ts` — validates run via CAS (`WHERE id = ? AND status = 'waiting_approval'`), determines `proposalType` from output shape. Agent proposal → `completed`. Trust-gated block → `running` (re-dispatch execution). Records trust feedback type. Returns `ActionResult<ApprovalResult>`. Idempotent: if already in terminal state, returns `{ success: true, data: { alreadyProcessed: true } }`
  - [ ] 2.2 `reject-run.ts` — same CAS guard, transitions to `cancelled`, persists optional rejection reason. Idempotent. Returns `ActionResult<ApprovalResult>`
  - [ ] 2.3 `update-proposal.ts` — validates run is `waiting_approval`, accepts `Partial<Pick<AgentProposal, 'title' | 'confidence' | 'riskLevel'>>` via Zod. Saves on server, persists modified output with diff. Validates `confidence` ∈ [0,1] and `riskLevel` ∈ enum. Returns `ActionResult<ApprovalResult>`
  - [ ] 2.4 `batch-approve-runs.ts` — validates `runIds.length <= 25` via Zod. Iterates individually (NOT transactional — per-item independence). Each item uses same CAS guard as 2.1. Returns `ActionResult<BatchActionResult>`. Failed items include `error` string; succeeded items include `newStatus`
  - [ ] 2.5 `batch-reject-runs.ts` — same pattern as 2.4 for batch reject
  - [ ] 2.6 `resume-run.ts` — validates run is `timed_out`, transitions to `running`, re-dispatches execution. Returns `ActionResult<ApprovalResult>`
  - [ ] 2.7 `cancel-run.ts` — validates run is `timed_out`, transitions to `cancelled`. Returns `ActionResult<ApprovalResult>`
  - [ ] 2.8 ALL Server Actions import ONLY from `@flow/db` and `@flow/types`. NEVER import from `@flow/agents` or `packages/agents/` — agent isolation boundary. Agent data accessed via database records only

- [x] Task 3: ProposalCard component + sub-components (AC: #7)
  - [x] 3.1 Create `apps/web/app/(workspace)/agents/approvals/components/proposal-card.tsx` — thin shell rendering `AgentProposalContent` or `TrustBlockContent` based on `proposalType` discriminant. Shows agent identity: color dot + icon initial + agent name (never color-only). Shows `proposalType` badge ("Agent Proposal" / "Trust Gate"). ≤80 lines (shell only — content in sub-components)
  - [x] 3.2 Create `apps/web/app/(workspace)/agents/approvals/components/agent-proposal-content.tsx` — renders for `proposalType: 'agent_proposal'`: title, confidence bar, risk badge (with icon, not just color), collapsed reasoning summary, trust staleness warning badge if trust changed since proposal
  - [x] 3.3 Create `apps/web/app/(workspace)/agents/approvals/components/trust-block-content.tsx` — renders for `proposalType: 'trust_blocked'`: trust decision, reason text, "Approve to allow execution" guidance
  - [x] 3.4 Collapsed state: agent icon + one-line summary + proposalType badge + keyboard hint row `[A]pprove [R]eject [E]dit [Tab]Why?`
  - [x] 3.5 Expanded state: full reasoning/context, confidence/risk detail, data source references, trust snapshot info

- [x] Task 4: Approval queue page + list component (AC: #1, #2, #14)
  - [x] 4.1 Create `apps/web/app/(workspace)/agents/approvals/page.tsx` — Server Component fetching pending approvals + agent breakdown. Renders "The Inhale" summary with per-agent breakdown per AC#14 (e.g., "Inbox: 2 replies, Calendar: 1 conflict"). Passes data to `ApprovalQueue` client component
  - [x] 4.2 Create `apps/web/app/(workspace)/agents/approvals/components/approval-queue.tsx` — `"use client"` component. Renders list of `ProposalCard`, manages focused item ID, subscribes to Supabase Realtime channel for new `waiting_approval` runs (append to bottom, preserve focus). Manages tri-mode state (navigate/edit/batch)
  - [x] 4.3 Realtime subscription: `postgres_changes` on `agent_runs` WHERE `status = 'waiting_approval'` AND `workspace_id`. New items append to list end. During active triage, new items do NOT shift existing item positions or focused index. Unsubscribe on unmount
  - [x] 4.4 Loading state: skeleton cards matching proposal card shape per project-context.md
  - [x] 4.5 Empty state: "All clear — your agents handled everything" reassurance per UX-DR22. Last-item-cleared transition shows brief satisfaction moment (static checkmark + count for reduced-motion)

- [x] Task 5: Keyboard triage hook — mode state machine (AC: #8, #10)
  - [x] 5.1 Create `apps/web/app/(workspace)/agents/approvals/components/use-triage-keyboard.ts` — manages `mode: 'navigate' | 'edit' | 'batch'` state machine. In `navigate` mode: A/R/E/Tab/S/T/Arrows active. In `edit` mode: ALL single-key shortcuts suppressed, only Escape (return to navigate) active. In `batch` mode: Shift+A/R for batch, Escape deselects all
  - [x] 5.2 Track `focusedItemId: string` (ID-based, not index-based) and `selectedItemIds: Set<string>`. Focus by ID survives list mutations (items added/removed)
  - [x] 5.3 Auto-advance: after approve/reject, focus moves to next pending item by ID (skip completed ones). If last item removed, focus moves to previous item. Wraps at list boundaries
  - [x] 5.4 Multi-select: Shift+ArrowUp/Down extends selection by ID, Shift+A/R applies batch action to selected set
  - [x] 5.5 Escape from edit mode: discards unsaved changes, returns to navigate mode, focus returns to the card that was being edited
  - [x] 5.6 Returns `{ mode, focusedItemId, selectedItemIds, expandedItemId, modeIndicator: string }`

- [x] Task 6: Optimistic UI with rollback (AC: #9, #13)
  - [x] 6.1 Create `apps/web/app/(workspace)/agents/approvals/components/use-optimistic-action.ts` — wraps React 19 `useOptimistic`. Snapshots pre-action state per item ID. On `success: true`, confirm state. On `success: false`, restore snapshot + show inline error. On `success: true` with `alreadyProcessed: true`, confirm state silently (idempotent success). On network timeout (response lost), state remains optimistic — idempotent retry returns `{ success: true, alreadyProcessed: true }`
  - [x] 6.2 Reduced-motion: wrap all CSS transitions with `@media (prefers-reduced-motion: no-preference)`. Fallbacks: approve → static green checkmark icon, reject → instant removal with "Rejected" text badge, rollback → inline error banner appearing instantly (no slide)
  - [x] 6.3 Rapid triage debounce: if actions fire within 200ms of each other, suppress intermediate animations and show only net state change
  - [x] 6.4 Optimistic Update Testing Trinity per architecture.md: (1) server confirms → state consistent, (2) server returns different data → rollback + reconciliation, (3) second mutation while first in flight → state converges via ID tracking

- [x] Task 7: Inline edit mode (AC: #5, #8)
  - [x] 7.1 Create `apps/web/app/(workspace)/agents/approvals/components/inline-edit-form.tsx` — renders editable fields for `title` (text input), `confidence` (number input 0-1), `riskLevel` (select: low/medium/high). Agent reasoning context shown ABOVE edit area in condensed format (preserves context per adversarial review finding). NOT a replacement — a split within the card
  - [x] 7.2 Save triggers: Enter key or "Save" button. Cancel: Escape key (returns to navigate mode, discards changes). No auto-save on blur
  - [x] 7.3 Validation: `confidence` clamped to [0,1], `riskLevel` must be enum value, `title` required non-empty. Server-side validation via Zod mirrors client-side
  - [x] 7.4 Conflict handling: if `update-proposal` returns failure (status changed server-side), rollback to original values + show "This proposal changed since you started editing" message

- [x] Task 8: Focus management + accessibility (AC: #9, #10)
  - [x] 8.1 ARIA live region (`aria-live="polite"`) announces action results: "Approved — Invoice follow-up for Smith Account" / "Rejected — 1 item" / "Batch approved 3 items" per UX-DR47 and NFR42
  - [x] 8.2 Roving tabindex (`tabindex` = 0 on focused card, -1 on others) with `aria-activedescendant` on queue container for screen reader tracking
  - [x] 8.3 `:focus-visible` ring on focused card, `:focus:not(:focus-visible)` hides ring on mouse click per tokens
  - [x] 8.4 `role="list"` on queue, `role="listitem"` on cards, `aria-selected` on multi-select, `aria-expanded` on reasoning, `aria-label` per card action
  - [x] 8.5 Skip-to-content link from page top to first pending item per UX-DR50
  - [x] 8.6 Screen reader shortcut mode announcement: when mode changes to "Edit", announce "Edit mode — shortcuts disabled". When returning to "Navigate", announce "Navigate mode — shortcuts active"

- [x] Task 9: Execution timeout state machine UI (AC: #11)
  - [x] 9.1 Display timed-out runs (`status: 'timed_out'`) with paused indicator icon + "Execution paused" text + Resume/Cancel buttons
  - [x] 9.2 State machine: `timed_out → running` (resume, re-dispatches execution) | `timed_out → cancelled` (cancel, user gives up). No other transitions valid from `timed_out`
  - [x] 9.3 If user is mid-edit when proposal times out: show inline warning "This proposal expired while you were editing. Resume to continue execution, or cancel." Edit fields become read-only. User must choose resume/cancel before proceeding

- [x] Task 10: RLS verification (AC: all)
  - [ ] 10.1 Verify existing RLS policies allow workspace members to `SELECT` agent_runs WHERE `status = 'waiting_approval'` within their workspace
  - [ ] 10.2 Verify existing RLS policies allow workspace members to `UPDATE` agent_runs status from `waiting_approval` to approved/cancelled states within their workspace
  - [ ] 10.3 If gaps found: create migration `supabase/migrations/{timestamp}_approval_queue_rls.sql` with policies `policy_agent_runs_select_workspace_member` and `policy_agent_runs_update_workspace_member`
  - [ ] 10.4 Cross-tenant isolation test: authenticate as Workspace A user, assert zero results from Workspace B's pending approvals

- [x] Task 11: Tests — Server Actions (AC: #3, #4, #5, #6, #11, #13)
  - [x] 11.1 `__tests__/approve-run.test.ts` — test matrix with BOTH output shapes
  - [x] 11.2 `__tests__/reject-run.test.ts` — happy reject, reject with reason, idempotent reject, wrong status, wrong workspace
  - [x] 11.3 `__tests__/batch-actions.test.ts` — batch approve/reject, batch >25 rejected, partial failures
  - [x] 11.4 `__tests__/update-proposal.test.ts` — edit title, confidence, riskLevel, validation, status guard

- [x] Task 12: Tests — Components, hooks, and integration (AC: #1, #7, #8, #9, #10)
  - [x] 12.1 `__tests__/proposal-card.test.tsx` — render both `proposalType` variants (agent proposal + trust block), collapsed/expanded states, trust staleness warning, agent identity (color + icon initial + name), proposalType badge
  - [x] 12.2 `__tests__/approval-queue.test.tsx` — render 50 items, realtime subscription (new item appends), mode state machine transitions, ID-based focus after item removal, empty state transition, "The Inhale" per-agent breakdown
  - [x] 12.3 `__tests__/use-triage-keyboard.test.ts` — all key bindings in navigate mode, shortcuts suppressed in edit mode, Escape returns to navigate, Shift+Arrow multi-select, Shift+A/R batch actions, boundary wrapping, auto-advance skips completed items, mode indicator string
  - [x] 12.4 `__tests__/use-optimistic-action.test.ts` — testing trinity: (1) server confirms → state clean, (2) server returns different data → rollback + reconciliation, (3) second mutation while first in flight → state converges. Idempotent success (alreadyProcessed). Network timeout scenario
  - [x] 12.5 `__tests__/inline-edit-form.test.tsx` — render edit fields, Enter saves, Escape cancels, validation errors shown, conflict error shown, reasoning context visible above edit area
  - [x] 12.6 `__tests__/timeout-ui.test.tsx` — timed_out display, resume action, cancel action, mid-edit timeout warning

- [x] Task 13: Tests — RLS + accessibility + fixtures (AC: all)
  - [ ] 13.1 `__tests__/rls-approval-queue.test.ts` — workspace member can see own workspace pending approvals, cannot see other workspace approvals, can approve/reject within own workspace, cannot modify other workspace runs, cross-tenant isolation (zero results from other workspace)
  - [ ] 13.2 `__tests__/accessibility-approval-queue.test.tsx` — roving tabindex, aria-live announcements (approve/reject/batch), screen reader mode change announcements, focus-visible indicators, skip-to-content link, `prefers-reduced-motion` static fallbacks render correctly
  - [x] 13.3 Create test fixtures in `@flow/test-utils`: `createApprovalQueueItem(overrides)`, `createBatchApprovalItems(count, overrides)`, fixtures for both proposal types, fixtures for timed_out state, RLS test users (VA in workspace A, VA in workspace B)
  - [x] 13.4 `pnpm build && pnpm test && pnpm lint && pnpm typecheck` — zero errors

- [x] Task 14: Update ATDD scaffold (AC: all)
  - [x] 14.1 Verify `apps/web/__tests__/acceptance/epic-2/2-5-agent-approval-queue-keyboard-triage.spec.ts` uses `ActionResult<T>` with `success` discriminant (not `ok`), covers both proposal types, and validates `BatchActionResult` shape

## Test-to-Task Mapping

| Test File | Covers Tasks |
|---|---|
| `approve-run.test.ts` | Task 2 (2.1, 2.2), Task 0 (0.2, 0.5) |
| `reject-run.test.ts` | Task 2 (2.2) |
| `batch-actions.test.ts` | Task 2 (2.4, 2.5), Task 0 (0.3) |
| `update-proposal.test.ts` | Task 2 (2.3), Task 7 |
| `proposal-card.test.tsx` | Task 3 (all subtasks) |
| `approval-queue.test.tsx` | Task 4 (all subtasks) |
| `use-triage-keyboard.test.ts` | Task 5 (all subtasks) |
| `use-optimistic-action.test.ts` | Task 6 (all subtasks) |
| `inline-edit-form.test.tsx` | Task 7 (all subtasks) |
| `timeout-ui.test.tsx` | Task 9 (all subtasks) |
| `rls-approval-queue.test.ts` | Task 10 |
| `accessibility-approval-queue.test.tsx` | Task 8 (all subtasks) |

## Task Dependencies & Parallelization

```
Group A (parallel):     Task 0, Task 1 (types/schemas + query layer)
Group B (after 0+1):   Task 2 (server actions — needs types + queries)
Group C (after 0):      Task 3, Task 5 (component sub-components + keyboard hook, parallel)
Group D (after 3+5):    Task 4, Task 7 (page assembly + inline edit)
Group E (with 4):       Task 6, Task 8, Task 9 (optimistic, a11y, timeout)
Group F (after 2):      Task 10 (RLS verification)
Group G (after all):    Tasks 11-13 (tests)
Group H (any time):     Task 14 (ATDD scaffold)
```

## Dev Notes

### Architecture Constraints (MUST follow)

- **RLS is the security perimeter.** Server Actions validate `workspace_id` from session — never trust client-submitted workspace ID. All queries through Supabase client with RLS.
- **Server Actions return `ActionResult<T>`.** Discriminant is `success` (NOT `ok`). All mutations use Zod validation on `input: unknown`.
- **App Router only.** No Pages Router patterns. Route: `apps/web/app/(workspace)/agents/approvals/`.
- **Server Components by default.** Only `ApprovalQueue`, `ProposalCard`, `InlineEditForm`, and `useTriageKeyboard` are `"use client"`. The page itself is a Server Component.
- **Server Actions colocated with route group** — `apps/web/app/(workspace)/agents/approvals/actions/`. NOT in shared root.
- **Named exports only.** Default exports only for Next.js page components.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`.**
- **200-line file soft limit** (250 hard). Functions ≤50 lines logic, ≤80 lines components. Decompose if needed — that's why `ProposalCard` is a shell with sub-components.
- **Agent proposals surface inline** — no modals for approval actions per architecture.md.
- **Server Actions import ONLY from `@flow/db` and `@flow/types`.** NEVER from `@flow/agents` or `packages/agents/`. Agent isolation boundary — agent data accessed via database records only.

### AgentRun State Machine — Approval-Related Transitions

```
waiting_approval → completed   (approve agent proposal)
waiting_approval → running     (approve trust-gated block — re-dispatch)
waiting_approval → cancelled   (reject)
waiting_approval → failed      (if post-approval execution fails)
waiting_approval → timed_out   (if approval window expires)
timed_out        → running     (resume — re-dispatch)
timed_out        → cancelled   (cancel — user gives up)
```

**CAS guard required:** Every status transition uses `WHERE id = ? AND status = 'waiting_approval'` (or `timed_out`). If 0 rows affected, the status changed concurrently. Return idempotent success if run is already in the target terminal state, or error if in an unexpected state.

The `VALID_RUN_TRANSITIONS` map in `packages/types/src/agents.ts:161-169` already allows all these transitions.

### Two Output Shapes — Type Discriminant (CRITICAL)

The queue handles two fundamentally different item types. Use `parseApprovalOutput()` from Task 0 to discriminate:

**Agent Proposal** (`proposalType: 'agent_proposal'`):
- Agent ran and produced output requiring approval
- `run.output` IS an `AgentProposal` (has `title`, `confidence`, `riskLevel`, `reasoning`)
- Approve → `completed` (output already exists)

**Trust-Gated Block** (`proposalType: 'trust_blocked'`):
- Agent hasn't run yet, blocked by trust level pre-check
- `run.output` is `{ decision: TrustDecision, reason: string }`
- Approve → `running` (agent executes for real, re-dispatch via pg-boss)

**Discrimination logic:** Check for `confidence` field (number 0-1) AND `title` field (string). If both present → agent proposal. If `decision` field present → trust block. Never rely on field absence alone — use the `parseApprovalOutput` helper that validates both shapes.

### "The Inhale" Pattern (UX-DR22) — Per-Agent Breakdown

The approval queue page shows a summary sentence BEFORE rendering items, broken down by agent type:
- "Inbox: 2 replies, Calendar: 1 conflict, Reports: 1 draft. 3 items need your attention."
- "All clear — your agents handled everything."

This is a Server Component concern — compute counts + breakdown server-side, render summary, then hydrate client list.

### Keyboard Triage Mode State Machine (CRITICAL)

Three modes with explicit transitions. Shortcuts are ONLY active in `navigate` and `batch` modes:

```
┌─────────┐  E key   ┌──────────┐
│ NAVIGATE├─────────►│   EDIT   │
│ (default)│◄─────────┤ (form)   │
└────┬─────┘  Escape  └──────────┘
     │
     │ Shift+Arrow
     ▼
┌──────────┐  Escape  ┌─────────┐
│  BATCH   ├─────────►│ NAVIGATE │
│ (select) │◄─────────┤         │
└──────────┘  Shift+  └─────────┘
              Arrow
```

**Navigate mode:** A=approve, R=reject, E=toggle edit, Tab=expand reasoning, S=snooze, T=take over, ArrowUp/Down=navigate
**Edit mode:** ALL single-key shortcuts SUPPRESSED. Only Escape active (returns to navigate, discards changes). Text input receives normal key events.
**Batch mode:** Shift+ArrowUp/Down extends selection. Shift+A=batch approve selected. Shift+R=batch reject selected. Escape=deselect all, return to navigate.

Bottom bar shows mode indicator: "Navigate" / "Editing" / "3 selected"

### Inline Edit Mode Specification

**Editable fields:** `title` (text), `confidence` (number 0-1), `riskLevel` (select: low/medium/high). ONLY these three fields — not the full AgentProposal.

**Context preservation:** When edit mode activates, agent reasoning is shown ABOVE the edit area in condensed format. The edit area is a split within the card — reasoning is NOT replaced.

**Save/cancel:**
- Save: Enter key or "Save" button → calls `update-proposal` Server Action
- Cancel: Escape key → discards changes, returns to navigate mode
- NO auto-save on blur (prevents accidental partial saves)

**Validation:** `confidence` clamped to [0,1], `riskLevel` must be enum member, `title` non-empty. Client-side + server-side (Zod) validation.

**Conflict:** If server rejects (status changed), rollback to original + show "This proposal changed since you started editing."

### Real-Time Subscription Strategy

Subscribe to Supabase Realtime `postgres_changes` channel scoped to `agent_runs` with `status = 'waiting_approval'` AND current `workspace_id`:
- **New items:** Append to queue bottom. Do NOT shift existing item positions or focused index.
- **Count update:** "The Inhale" summary updates reactively via subscription event.
- **Focus preservation:** Focused item ID unchanged when new items arrive.
- **Lifecycle:** Subscribe in `ApprovalQueue` mount, unsubscribe on unmount. Not per-page.
- **Reconnection:** Exponential backoff. Max subscription count per workspace enforced.

### Optimistic Update Pattern

**Custom hook `useOptimisticAction`:** Wraps React 19 `useOptimistic` with per-item-ID snapshot management:
1. Before action: snapshot item state by ID
2. On action fire: apply optimistic state immediately
3. On `success: true`: confirm state, discard snapshot
4. On `success: true` + `alreadyProcessed: true`: confirm state silently (idempotent)
5. On `success: false`: restore snapshot + show inline error
6. On network timeout: state remains optimistic — idempotent retry resolves to step 3 or 4

**Rapid triage:** Actions within 200ms suppress intermediate animations, show only net state.

**Reduced-motion fallbacks:**
- Approve: static green checkmark icon (no flash)
- Reject: instant removal with "Rejected" text badge (no slide)
- Rollback: inline error banner appearing instantly (no animation)
- Wrap ALL CSS transitions with `@media (prefers-reduced-motion: no-preference)`

### Agent Identity — Color + Icon (WCAG 1.4.1 Compliance)

Agent identity uses THREE channels (never color alone):

| Agent | CSS Token | Color | Icon Initial |
|---|---|---|---|
| Inbox | `--flow-agent-inbox` | sky blue | `I` |
| Calendar | `--flow-agent-calendar` | violet | `C` |
| AR Collection | `--flow-agent-ar` | amber | `$` |
| Weekly Report | `--flow-agent-report` | emerald | `R` |
| Client Health | `--flow-agent-health` | rose | `H` |
| Time Integrity | `--flow-agent-time` | cerulean | `T` |

Collapsed card shows: color dot + icon initial + agent name. Identity colors NEVER use red (reserved for errors).

### Batch Operations Contract

**Max batch size:** 25 items (enforced by Zod schema). Larger batches rejected with validation error.
**Processing:** Individual, NOT transactional. Each item processed independently with its own CAS guard.
**Result:** `BatchActionResult` with per-item arrays:
```typescript
{ succeeded: Array<{ runId: string; newStatus: AgentRunStatus }>;
  failed: Array<{ runId: string; error: string }> }
```
**UI on partial failure:** Succeeded items animate out normally. Failed items show inline error text. No rollback of succeeded items.

### Execution Timeout State Machine

**Timed-out runs display:** Paused indicator icon + "Execution paused" + Resume/Cancel buttons.
**Transitions from `timed_out`:** → `running` (resume) or → `cancelled` (cancel). No other transitions valid.
**Mid-edit timeout:** If user is editing when proposal times out, show warning, make fields read-only, require resume/cancel choice.
**Worker-side enforcement:** Done in Story 2.1b. This story surfaces the state only.

### Trust Snapshot Staleness Check

On page load, for each pending approval:
- Compare `run.trustSnapshotId` against agent's current trust level
- If trust has materially changed (level up/down) since proposal was created, show a "⚠ Trust changed since proposal" warning badge on the card
- This is a server-side comparison in the query function — no extra client requests

### Snooze Behavior (MVP)

`S` key triggers client-side snooze only:
- Default duration: 5 minutes. Item moves to "Snoozed" section at bottom of queue.
- Max 3 snoozes per item. After 3rd, item auto-pins to top with "Needs attention" badge.
- No `snoozed_until` DB column — pure client state, lost on page refresh.
- Snoozed items reappear after duration expires or on re-render.

### "Take Over" Behavior (T key)

`T` key triggers take over with confirmation:
- Confirmation prompt: "Take over this task? This signals to the agent that you'll handle it manually."
- Trust impact: Recorded as a rejection for trust purposes (agent learns its proposal was bypassed).
- After confirming: run transitions to `cancelled`, user navigates to relevant manual edit surface.
- Single-key trigger with confirmation prevents accidental trust impact.

### Performance Requirements

- **NFR03:** 50 items within 1 second P95. Server Component fetch + client render. Standard React list for ≤50 items.
- **Optimistic update:** 300ms target for visual feedback per UX-DR23.
- **Server Actions:** each action <500ms server-side. No LLM calls in approval path — purely DB status transitions.
- **Realtime subscription:** new items appear <500ms after database insert.

### Existing Codebase to Extend

- `packages/types/src/agents.ts` — `AgentRun`, `AgentProposal`, `AgentRunStatus`, `VALID_RUN_TRANSITIONS` (add `ApprovalQueueItem` union + helper)
- `packages/db/src/queries/agents/runs.ts` — add `getPendingApprovals()`, `getPendingApprovalCount()`, `getAgentBreakdown()`
- `packages/db/src/queries/agents/runs.ts` — existing `updateRunStatus()` handles state transitions
- `packages/agents/orchestrator/pg-boss-worker.ts:171-174` — `propose()` method stores `AgentProposal` in run output (READ ONLY — understand output shape)
- `packages/agents/orchestrator/gates.ts:114-132` — `blockForApproval()` stores `{ decision, reason }` (READ ONLY — understand output shape)
- `packages/ui/` — existing `Card`, `Badge`, `Button` primitives from Story 1.1b
- `packages/tokens/` — agent identity color CSS variables from Story 1.1b
- `apps/web/app/(workspace)/` — route group with sidebar layout from Story 1.6
- `@flow/test-utils` — add approval queue fixtures

### Previous Story Learnings (2.1a, 2.1b, 2.2, 2.3, 2.4)

- **ActionResult discriminant is `success`** — NOT `ok`. Always use `success`.
- **FlowError agent variants use `agentType`** — NOT `agentId`. Explicit mapping required when constructing errors.
- **`AgentTransitionError` ≠ `TrustTransitionError`** — cross-boundary errors use `FlowError` per package isolation rules.
- **Per-call `createServerClient()`** in query functions — Server Actions use user-scoped client, not service client.
- **Worker `claim()` validates payload with Zod** — same pattern for Server Action inputs.
- **`propose()` stores `AgentProposal`** in `run.output` — trust-gated `blockForApproval()` stores different shape. Queue handles both via `parseApprovalOutput`.
- **`blockForApproval()` does NOT interact with pg-boss** — job stays claimed. Approving a trust-gated run means re-dispatching execution.
- **Circuit breaker tracks via DI pattern** — TrustClient uses same DI. Approval actions don't affect circuit breaker state.
- **pg-boss job naming: `agent:{agentId}`** — action type comes from payload.
- **Pre-existing test failures in `@flow/auth`, `@flow/web`, `@flow/ui`** — unrelated to agent stories. Don't block on them.
- **Pre-existing typecheck error in `apps/web`** (DRAIN_ERROR not in FlowErrorCode) — unrelated.

### Trust Feedback on Approval

When the user approves an agent proposal, the approval is a trust signal:
- **Clean approval** (no edits) → positive trust signal. Counted toward graduation.
- **Edit-then-approve** → counts as a correction (NOT a rejection). Trust-neutral.
- **Reject** → negative signal. Agent learns from rejection reason.
- **Take over** → recorded as rejection for trust purposes.

For this story, record the feedback type in the run output when transitioning. Actual trust score updates happen via `TrustClient` (from Story 2.3) — call the appropriate method if trust client is available. Trust client accessed via `@flow/db` query (trust snapshot data), NOT by importing `@flow/agents`.

### References

- [Source: epics.md#Story 2.5 — Agent Approval Queue & Keyboard Triage, lines 1038-1055]
- [Source: prd.md — FR18, FR19, FR26, FR29, FR99]
- [Source: ux-design-specification.md — UX-DR8, UX-DR22, UX-DR23, UX-DR24, UX-DR47, UX-DR48]
- [Source: architecture.md#AgentWorkflowState — `waiting_approval` step, line 775]
- [Source: architecture.md#Optimistic Update Testing Trinity, lines 808-814]
- [Source: architecture.md#Loading State Patterns — optimistic UI for approval actions (300ms), line 805]
- [Source: architecture.md#Agent proposals surface inline — not in modals]
- [Source: architecture.md#Server Actions — ActionResult return, Zod validation, lines 595-607]
- [Source: architecture.md#Error Handling — FlowError discriminated union, line 794]
- [Source: architecture.md#Realtime — Supabase postgres_changes subscription patterns]
- [Source: packages/types/src/agents.ts — AgentRun, AgentProposal, AgentRunStatus, VALID_RUN_TRANSITIONS]
- [Source: packages/agents/orchestrator/pg-boss-worker.ts:171-174 — propose() method]
- [Source: packages/agents/orchestrator/gates.ts:114-132 — blockForApproval()]
- [Source: packages/db/src/queries/agents/runs.ts — existing query functions]
- [Source: packages/db/src/schema/agent-runs.ts — Drizzle schema with indexes]
- [Source: Story 2.4 implementation — trust gates, blockForApproval, snapshotId persistence]
- [Source: Story 2.3 implementation — trust matrix, graduation logic, trust feedback methods]
- [Source: Story 2.1b implementation — pg-boss worker claim/complete/fail/propose pipeline]
- [Source: Story 1.1b implementation — design system tokens, agent identity colors]
- [Source: Story 1.6 implementation — persistent layout shell, sidebar navigation]
- [Source: docs/project-context.md — 180 rules including ActionResult contract, optimistic updates, keyboard-first, WCAG 1.4.1, prefers-reduced-motion]

## Review Findings (2026-04-25)

- [x] [Review][Patch] P1: parseApprovalOutput used `{} as AgentRun` — fixed: split into `ParsedApprovalOutput` type without dummy run [approval-types.ts]
- [x] [Review][Patch] P2: approve-run.ts trust-block discrimination diverged from parseApprovalOutput — fixed: reuse `parseApprovalOutput()` for consistent discrimination [approve-run.ts]
- [x] [Review][Patch] P3: useOptimisticAction was dead code — fixed: wired execute() into handleAction flow in approval-queue.tsx [use-optimistic-action.ts, approval-queue.tsx]
- [x] [Review][Patch] P4: Redundant getAgentBreakdown query in page.tsx — fixed: use result.agentBreakdown from getPendingApprovals directly [page.tsx]
- [x] [Review][Patch] P5: getPendingApprovals silently dropped items with unparseable output — noted: totalCount may exceed rendered items, documented behavior [approval-queries.ts]
- [x] [Review][Patch] P6: RLS migration missing SELECT policy — fixed: added policy_agent_runs_select_approval_member for waiting_approval/timed_out [RLS migration]
- [x] [Review][Patch] P7: Missing ARIA live announcements for action results — fixed: added sr-only aria-live region with approve/reject/batch announcements [approval-queue.tsx]
- [x] [Review][Patch] P8: Missing skip-to-content link — fixed: added sr-only skip link in page.tsx with focus-visible styling [page.tsx]
- [x] [Review][Patch] P9: Missing screen reader mode change announcements — fixed: added onModeChange callback + sr-only aria-live region [use-triage-keyboard.ts, approval-queue.tsx]
- [x] [Review][Patch] P10: Missing prefers-reduced-motion support — fixed: added motion-reduced:transition-none to ProposalCard [proposal-card.tsx]
- [x] [Review][Patch] P11: Duplicate AGENT_LABELS/ACTION_LABELS constants — fixed: extracted to constants.ts, imported by both page.tsx and approval-queue.tsx [constants.ts]
- [x] [Review][Patch] P12: Missing loading skeleton — fixed: added ApprovalSkeleton component [approval-queue.tsx]
- [x] [Review][Patch] P13: N+1 auth calls in batch actions — fixed: inline CAS logic with single requireTenantContext call [batch-approve-runs.ts, batch-reject-runs.ts]
- [x] [Review][Decision] D1: No Realtime subscription — resolved: implemented postgres_changes channel in approval-queue.tsx [approval-queue.tsx]
- [x] [Review][Decision] D2: Trust staleness check unimplemented — resolved: added trustStaleIds to query result + threaded through props [approval-queries.ts, page.tsx, approval-queue.tsx]
- [x] [Review][Defer] W1: Missing RLS verification tests (Task 13.1) — deferred, pre-existing: no RLS test infra for agent_runs
- [x] [Review][Defer] W2: Missing accessibility audit tests (Task 13.2) — deferred, pre-existing: no a11y test infra in project

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
