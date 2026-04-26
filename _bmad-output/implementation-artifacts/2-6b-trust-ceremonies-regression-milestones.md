# Story 2.6b: Trust Ceremonies, Regression Handling & Milestones

Status: ready-for-dev
Parent: 2.6 (split after 4-agent adversarial review)
Depends on: 2.6a (badge atoms, state machine, TrustBadge component, queries)
Revised: 2026-04-26 (4-agent adversarial review — 20 critical+high findings applied)

## Story

As a user,
I want trust level changes communicated appropriately — celebrations for growth, dignified handling for regression,
So that trust progression feels human and my workflow is respected.

## Acceptance Criteria

1. **[FR31]** Given an agent qualifies for trust promotion, When the system suggests promotion, Then a NON-BLOCKING toast notification appears with agent icon, "<Agent> has earned your trust on [action]. Let them handle it?", "Review", "Remind me later", and "Dismiss" buttons. Auto-dismiss 10s. Does NOT steal focus or trap keyboard. Per UX-DR17
2. **[FR31]** Given the user clicks "Review" on a promotion toast, When the ceremony opens, Then `role="alertdialog"` with focus trap. **First announced content is the escape instruction** ("Press Escape once to focus Decline, twice to dismiss"), followed by ceremony content. Shows stats (clean approvals, total runs, days at level), "Accept?" / "Not yet" CTAs. Tab cycles between buttons. Enter accepts. Escape: first press moves focus to Decline, second press activates Decline. Focus returns to trigger element on close. Per UX-DR17
3. **[FR30]** Given an agent's trust regresses (misfire/violation), When regression occurs, Then a BLOCKING confirmation dialog appears with: behavioral change description ("<Agent> can no longer access: [capability list]"), affected tasks count, reason/trigger. User MUST acknowledge. Focus trapped. `aria-live="assertive"` announces. Per UX-DR14, UX-DR18
4. **[FR30]** Given regression language is displayed, When the user reads it, Then language communicates BEHAVIORAL CHANGE with transparency and empathy: "We've adjusted <Agent>'s permissions based on recent activity. Here's what changed: [capability list]. Tasks using these capabilities have been paused." NEVER: "Trust level decreased", "Agent failed", "Setting trust level back to Basic", "Agent Permissions Updated" (too sanitized). Per UX-DR14
5. **[FR34]** Given regression was auto-triggered, When the user sees the notification, Then one-click "Undo" button reverts regression within the undo window (7-day cooldown period). Undo button is visually prominent (primary action weight). Shows accumulated trust data: "8 clean approvals, 1 rejection." Per UX-DR14, UX-DR45
6. **[FR32]** Given an agent achieves a milestone (FIRST_10, FIFTY_CLEAN, HUNDRED_CLEAN, ZERO_REJECTIONS_WEEK), When the milestone triggers, Then a celebration card shows earned marker text (e.g., "100 tasks, no stumbles"), agent icon with gold border, brief fade-in (300ms). Auto-dismiss 8s or manual dismiss. No progress bars, no countdowns. Earned, not gamified. Per UX-DR20
7. **[FR31, FR34]** Given multiple overlays could appear simultaneously, When ceremony + milestone + regression compete, Then overlay manager renders only the highest-priority overlay and queues the rest. Priority: regression dialog (60) > ceremony (50) > milestone toast (30). **When regression and milestone fire simultaneously**, show a merged acknowledgment: "You hit [milestone] — and [agent] needs a permission adjustment. [Acknowledge both]." Per architecture spec
8. **[FR29]** Given `prefers-reduced-motion: reduce` is active, When any trust transition occurs, Then all animations are disabled (transition: none), overlays appear instantly without fade/pulse, badge pulse suppressed, milestone fade-in skipped. Screen reader announcements still fire. Full static alternatives for all animated states
9. **[FR30, FR34]** Given the user performs a hard navigation (full page reload) during an unacknowledged regression, When the page loads, Then OverlayHost reconstructs pending overlays from server state (query for unacknowledged regressions). Regression acknowledgment cannot be escaped by refreshing
10. **[FR31]** Given auto-dismiss timers are active (8s milestone, 10s toast), When the user switches browser tabs (`visibilitychange`), Then active auto-dismiss timers pause. Timers resume when tab regains focus. Per multi-tab VA workflow pattern

## Scope Boundaries

**In scope (this story):**
- Non-blocking toast for trust upgrades (with "Remind me later" affordance)
- Trust ceremony overlay with accessible redesign (two-escape, focus trap)
- Blocking regression confirmation dialog
- Regression behavioral language system (transparent-with-empathy)
- One-click undo for auto-triggered regressions (with prominent placement)
- Trust milestone celebrations (4 milestone types)
- Overlay manager (reducer-based atom in `apps/web/lib/atoms/overlay.ts`)
- `OverlayHost` component rendering top-priority overlay only
- Overlay rehydration on page load (unacknowledged regressions)
- ARIA live region announcer hook (`useTrustAnnouncer`)
- `useFocusTrap` reusable hook
- Intermediate animation atom for badge-to-overlay pulse coordination
- All notification copy in content dictionary with voice-and-tone guide header
- `prefers-reduced-motion` for all overlay animations
- Tab visibility pause for auto-dismiss timers

**Explicitly deferred:**
- Monthly stick-time audit → Story 2.6c
- Custom ceremony animations (confetti, particles) → post-MVP polish
- Mobile-specific ceremony deferral → requires mobile sidebar
- In-app notification delivery system → Epic 10 (FR79)
- Shareable trust receipts for client-facing milestones → post-MVP
- Multi-tab overlay synchronization → scoped per-tab, server-authoritative on navigation

## Tasks / Subtasks

### Group A: Foundation (after 2.6a complete)

- [ ] Task 0: Overlay manager + types (AC: #7, #9)
  - [ ] 0.1 Create `apps/web/lib/atoms/overlay.ts` — `OverlayEntry` type is generic: `{ id: string; type: string; priority: number; props: Record<string, unknown>; createdAt: number }`. Overlay subtypes (ceremony, recovery, milestone) type-narrow on render, not in the atom. Use `atomWithReducer` pattern to prevent concurrent-push race conditions. `overlayStackAtom` (array), `topOverlayAtom` (derived, highest priority). `OverlayAction`: `{ type: 'push' | 'pop' | 'clear'; entry?: OverlayEntry; id?: string }`. `overlayReducer` handles all state transitions atomically
  - [ ] 0.2 Create `apps/web/app/(workspace)/components/overlay-host.tsx` — `"use client"` renders only `topOverlayAtom`. Maps `entry.type` to components via a registry: `{ 'trust-ceremony': TrustCeremony, 'trust-recovery': TrustRecovery, 'trust-milestone': TrustMilestone }`. Single `--flow-z-overlay` CSS variable for all overlays. `aria-modal="true"` for ceremony/recovery. On mount: query server for unacknowledged regressions → hydrate overlay stack (AC #9). ≤60 lines
  - [ ] 0.3 Add `OverlayHost` to `WorkspaceShell` in `packages/ui/src/layouts/workspace-shell.tsx` (alongside `<CommandPalette />`)
  - [ ] 0.4 Add `--flow-z-overlay` CSS variable to `apps/web/app/globals.css` (e.g., `--flow-z-overlay: 9999`)
  - [ ] 0.5 Create `packages/ui/src/components/overlay/overlay-manager.test.tsx` — 18 tests: priority ordering (6 permutations), concurrent push while dismissing, queue drain, same-type replacement, atom state consistency, no-overlay idle state, rehydration from server state

- [ ] Task 1: Focus trap hook + ARIA announcer (AC: #2, #3, #8)
  - [ ] 1.1 Create `apps/web/lib/hooks/use-focus-trap.ts` — reusable focus trap hook. Returns `{ containerRef, activate, deactivate }`. Handles Tab cycling, Shift+Tab, focus return to trigger element. Used by ceremony and recovery overlays. ≤40 lines
  - [ ] 1.2 Create `apps/web/lib/hooks/use-trust-announcer.ts` — hook dispatching to a dedicated announcement atom. Accepts `(message: string, priority: 'polite' | 'assertive')`. Single announcer channel — trust components never render own `aria-live` regions
  - [ ] 1.3 Add `aria-live="assertive"` sibling div to existing `aria-live="polite"` in `WorkspaceShell`

- [ ] Task 2: Notification content dictionary + voice guide (AC: #4)
  - [ ] 2.1 Create `apps/web/app/(workspace)/agents/constants/trust-copy.ts` — all notification copy as constants. File header contains voice-and-tone guide: "Transparent with empathy. Honest without being cold. Behavioral, not emotional." Ceremony language per transition type. Regression behavioral language. Milestone markers. NEVER hardcoded in components

- [ ] Task 3: Animation coordination atom (AC: #8)
  - [ ] 3.1 Add `trustBadgeAnimationAtom` to `apps/web/lib/atoms/trust.ts` — intermediate atom for badge-to-overlay pulse coordination. Ceremony component writes to this atom. TrustBadge component reads from it. Decouples cross-package animation trigger. `animState: 'pulse-promoting' | 'pulse-regressing' | 'default'` with `prefers-reduced-motion` guard (always `'default'` when reduced motion)
  - [ ] 3.2 Add reduced-motion keyframes/guards: badge pulse, ceremony entrance, milestone fade-in, status ring pulse — all use `motion-reduce:transition-none` Tailwind utility or equivalent CSS

### Group B: Server Action signatures + stubs (after Group A starts)

- [ ] Task 4: Server Action schemas + stubs (AC: #2, #5)
  - [ ] 4.1 Create `apps/web/app/(workspace)/agents/actions/trust-schemas.ts` — shared Zod schemas: `UpgradeTrustSchema`, `DowngradeTrustSchema`, `UndoRegressionSchema`. Extracted to keep action file under 200 lines
  - [ ] 4.2 Create `apps/web/app/(workspace)/agents/actions/trust-actions.ts` — type signatures + stubs returning `ActionResult<T>` with `success` discriminant. `upgradeTrustLevel`, `downgradeTrustLevel`, `undoRegression`. Imports schemas from `trust-schemas.ts`. Enables parallel Group C dev with real imports

### Group C: Ceremony, regression, milestones (after Group A complete, with Task 4 stubs)

- [ ] Task 5: Trust ceremony overlay (AC: #1, #2)
  - [ ] 5.1 Create `apps/web/app/(workspace)/agents/components/trust-ceremony.tsx` — ceremony overlay with `role="alertdialog"`, focus trap via `useFocusTrap`. Two modes: `isRegression=false` (non-blocking toast, auto-dismiss 10s, "Review" / "Remind me later" / "Dismiss" buttons, no focus steal) and `isRegression=true` (blocking dialog). **First announced content: escape instruction.** Shows stats, ceremony language from copy dictionary. Uses `trustBadgeAnimationAtom` for pre-overlay badge pulse (500ms before overlay, skipped when reduced-motion). ≤100 lines
  - [ ] 5.2 Create `apps/web/app/(workspace)/agents/components/trust-ceremony-steps.tsx` — step rendering (acknowledge, confirm, celebrate). Ceremony language per transition type. ≤60 lines
  - [ ] 5.3 Keyboard: Enter accepts. Tab cycles between Accept/Decline. Escape moves focus to Decline (first press), activates Decline (second press). Focus returns to trigger element on close
  - [ ] 5.4 Tab visibility: pause auto-dismiss timer on `visibilitychange` hidden, resume on visible (AC #10)
  - [ ] 5.5 On accept: call Server Action (`upgradeTrustLevel`), micro-celebration (300ms). On decline: close, track 3-day cooldown in `trust_matrix`. On "Remind me later": close, re-queue overlay after 1 hour

- [ ] Task 6: Trust regression notification (AC: #3, #4, #5)
  - [ ] 6.1 Create `apps/web/app/(workspace)/agents/components/trust-recovery.tsx` — blocking dialog showing: what capabilities changed, affected tasks count, behavioral trigger reason. Transparent-with-empathy language from copy dictionary. "Undo" button (if auto-triggered) — visually prominent, primary action weight. Options: "Keep in Auto — one-off" / "Move to Confirm for this client" / "Move to Confirm for all clients". ≤80 lines
  - [ ] 6.2 Behavioral language from copy dictionary: "We've adjusted <Agent>'s permissions based on recent activity. Here's what changed: [list]. Tasks using these capabilities have been paused." Shows accumulated data: clean approvals, rejection count, trust trend
  - [ ] 6.3 One-click undo: if auto-triggered, "Undo" button calls Server Action to revert within 7-day cooldown window. **Undo clears cooldown** (does not prevent it — cooldown is already set at violation time). Undo feedback via undo toast component
  - [ ] 6.4 Create `apps/web/app/(workspace)/agents/components/undo-toast.tsx` — brief confirmation toast after undo: "Trust level restored." Auto-dismiss 5s. ≤25 lines
  - [ ] 6.5 Focus trapped in dialog via `useFocusTrap`. `aria-live="assertive"` on open. Focus returns to trigger on close

- [ ] Task 7: Trust milestone celebrations (AC: #6)
  - [ ] 7.1 Create `apps/web/app/(workspace)/agents/components/trust-milestone.tsx` — celebration card with earned marker text, agent icon with gold border, 300ms fade-in (instant when reduced-motion). Auto-dismiss 8s or manual dismiss. Tab visibility pause for timer. ≤40 lines
  - [ ] 7.2 Milestone constants: FIRST_10, FIFTY_CLEAN, HUNDRED_CLEAN, ZERO_REJECTIONS_WEEK. Each has text label. No progress bars, no countdowns. Displayed once, logged in `trust_milestones`

- [ ] Task 8: Regression + milestone merging (AC: #7)
  - [ ] 8.1 In overlay reducer: when a regression and milestone for the same agent arrive within 1s, merge into a single overlay with merged acknowledgment UI: "You hit [milestone] — and [agent] needs a permission adjustment. [Acknowledge both]"

### Group D: Server Action implementations (after Group C components)

- [ ] Task 9: Trust transition Server Actions (AC: #2, #5)
  - [ ] 9.1 Implement `upgradeTrustLevel` — wraps `@flow/db` queries directly (NOT through TrustClient — see Dev Notes). Uses shared Zod schema. Returns `ActionResult<TrustTransitionResult>` with `success` discriminant. Catches `TrustTransitionError('CONCURRENT_MODIFICATION')` → returns friendly "This trust change was already processed" error
  - [ ] 9.2 Implement `downgradeTrustLevel` — same pattern. Records transition, applies 7-day cooldown, triggers regression notification via overlay atom push
  - [ ] 9.3 Implement `undoRegression` — reads most recent transition, verifies auto-triggered, verifies within 7-day cooldown window, reverses level change, **clears cooldown**. This is the most complex action. Audit-logged (regression is sensitive). ≤40 lines body
  - [ ] 9.4 Create `packages/db/src/queries/trust/trust-mutations.ts` — `upsertTrustProfile`, `insertTrustHistory`, `recordMilestone`, `getUnacknowledgedRegressions` mutation/query helpers. Existing pattern: `packages/db/src/queries/trust/matrix.ts` uses `createServiceClient()`

### Group E: Tests (after all implementation)

- [ ] Task 10: Ceremony and overlay tests (AC: #1, #2, #7)
  - [ ] 10.1 `apps/web/app/(workspace)/agents/components/__tests__/trust-ceremony.test.tsx` — 22 tests: accept/decline flows, Escape two-escape pattern (5 state matrix), focus trap via useFocusTrap, stats display, ceremony language per type, slow network, concurrent overlays, "Remind me later" re-queue, merged regression+milestone acknowledgment. Edge cases merged in (no separate file)
  - [ ] 10.2 `packages/ui/src/components/overlay/overlay-manager.test.tsx` — 18 tests (from Task 0.5)

- [ ] Task 11: Regression and milestone tests (AC: #3, #4, #5, #6)
  - [ ] 11.1 `apps/web/app/(workspace)/agents/components/__tests__/trust-recovery.test.tsx` — 20 tests: behavioral language verification (transparent-with-empathy), undo flow (same session, across session boundary, during active overlay, server error, network timeout, double-undo guard), accumulated data display, auto-dismiss, option selection, error paths, undo toast feedback, "Agent Permissions Updated" NEVER appears
  - [ ] 11.2 `apps/web/app/(workspace)/agents/components/__tests__/trust-milestone.test.tsx` — 8 tests: all 4 milestone types, earned markers text, auto-dismiss 8s, no progress bars, gold border, reduced-motion instant show

- [ ] Task 12: Server Action tests (AC: #2, #5)
  - [ ] 12.1 `apps/web/app/(workspace)/agents/actions/__tests__/trust-actions.test.tsx` — 8 tests: upgrade success, downgrade success, undo within cooldown, undo after cooldown expired, concurrent modification error, network timeout, 403 forbidden (session expired), double-submit idempotency

- [ ] Task 13: Accessibility, animation, and timing tests (AC: #8, #10)
  - [ ] 13.1 ARIA assertions across all overlay components: live region announcements (assertive for regression, polite for milestones), focus management, `role="alertdialog"` for ceremony, descriptive text, focus-return-to-trigger
  - [ ] 13.2 `prefers-reduced-motion` matrix: badge pulse suppressed, ceremony entrance instant, milestone fade-in skipped, status ring pulse disabled — all verified
  - [ ] 13.3 Tab visibility: auto-dismiss timer pauses on hidden, resumes on visible. Verify with `vi.spyOn(document, 'visibilityState')`
  - [ ] 13.4 Timing contract tests: `expect(AUTO_DISMISS_TOAST_MS).toBe(10000)`, `expect(AUTO_DISMISS_MILESTONE_MS).toBe(8000)`. Verify constants match spec

- [ ] Task 14: Test infrastructure (cross-cutting)
  - [ ] 14.1 Create shared `apps/web/lib/test-utils/advance-timers.ts` — `advanceTimers(ms)` utility wrapping `vi.advanceTimersByTime()` in `act()`. Used everywhere, no exceptions
  - [ ] 14.2 Add `beforeEach` atom reset to every test file — reset all trust + overlay atoms to canonical initial state. 2 meta-tests per file verifying reset works
  - [ ] 14.3 Add jest-axe baseline tests: 1 per overlay type (ceremony, regression, milestone) + 1 per state transition (entering, active, dismissing) = ~6 tests

- [ ] Task 15: Build verification (AC: all)
  - [ ] 15.1 `pnpm build && pnpm test && pnpm lint && pnpm typecheck` — zero errors

## Test-to-Task Mapping

| Test File | Covers Tasks | Est. Tests |
|---|---|---|
| `overlay-manager.test.tsx` | Task 0 | 18 |
| `trust-ceremony.test.tsx` | Tasks 5, 8 | 22 |
| `trust-recovery.test.tsx` | Task 6 | 20 |
| `trust-milestone.test.tsx` | Task 7 | 8 |
| `trust-actions.test.tsx` | Task 9 | 8 |
| jest-axe a11y baselines | Task 13 | 6 |
| Timing contract tests | Task 13 | 4 |
| **Total** | | **86** |

## Task Dependencies

```
Requires: Story 2.6a (atoms, state machine, TrustBadge, queries)

Group A (parallel):     Task 0, Task 1, Task 2, Task 3 (overlay + focus trap + announcer + copy + animation atom)
Group B (with A):       Task 4 (Server Action schemas + stubs — enables Group C)
Group C (after A, with 4 stubs):  Tasks 5, 6, 7 (ceremony + regression + milestones — parallel)
Group C includes:       Task 8 (regression+milestone merging)
Group D (after C):      Task 9 (Server Action implementations)
Group E (after all):    Tasks 10-15 (tests + build)
```

## Dev Notes

### Server Actions MUST Bypass TrustClient (CRITICAL)

`TrustClient` (`packages/trust/src/client/trust-client.ts`) uses an in-memory `snapshotCache` (Map with max 1000 entries). Server Actions run in isolated serverless request contexts — each invocation may cold-start with a fresh module scope. The cache is useless across requests. Server Actions for user-facing trust changes MUST call `@flow/db` queries directly (`packages/db/src/queries/trust/`). `TrustClient` is for agent-worker-to-trust communication only.

### Ceremony Redesign (CRITICAL — accessibility fix)

Original spec: "Escape does nothing" — WCAG 2.1 SC 2.1.2 violation (keyboard trap).

**Redesigned:**
- Trust UPGRADES: Non-blocking toast. No focus steal. Auto-dismiss 10s. "Remind me later" affordance. Dismissible with Escape immediately. Priority 50.
- Trust REGRESSIONS: Blocking dialog. Must acknowledge. Focus trapped within dialog via `useFocusTrap`. Two-escape-to-decline (Escape once → focus on Decline, Escape again → activate Decline). `role="alertdialog"`. Priority 60.
- Focus management: On open, focus lands on primary action. On close, focus returns to trigger element.
- Screen reader: First announced content is escape instruction. Then full ceremony/regression content announced.
- Overlay rehydration: On OverlayHost mount, query for unacknowledged regressions → push to overlay stack. Hard navigation cannot escape regression acknowledgment.

### Overlay Manager Uses atomWithReducer (CRITICAL — race condition fix)

Concurrent server responses can push overlays in the same React render cycle. Raw atom reads + writes have a read-then-write gap that causes clobbering. `atomWithReducer` makes every state transition atomic:
- `push`: append entry, re-sort by priority
- `pop`: remove by id
- `clear`: reset to empty

`topOverlayAtom` is derived: `overlayStackAtom[0]` (highest priority first).

### Regression + Milestone Merging

When regression and milestone for the same agent fire within 1s, merge into a single acknowledgment overlay. Never bury a positive moment under a negative one without acknowledgment.

### Overlay Priority System

| Priority | Type | Component | Dismissible? |
|---|---|---|---|
| 60 | Regression dialog | TrustRecovery | Must act (Escape→Decline works via two-escape) |
| 50 | Ceremony | TrustCeremony | Yes (Decline button, two-escape, "Remind me later") |
| 30 | Milestone | TrustMilestone | Yes (auto-dismiss 8s, manual dismiss) |

Overlay manager renders ONLY the highest-priority overlay. Others queued in atom stack. Z-index managed by single `--flow-z-overlay` CSS variable.

### Behavioral Language for Regression (CRITICAL — revised)

Transparent with empathy, not sanitized corporate speak:

| Component | Language |
|---|---|
| Dialog title | "We've Adjusted [Agent]'s Permissions" |
| Summary | "<Agent> can no longer access: [capability list]. Tasks using these capabilities have been paused." |
| Reason | "Based on recent activity: [behavioral trigger, e.g., 3 failed task completions in 24h]" |
| Undo copy | "Undo — Restore previous permissions" (prominent, primary action weight) |
| NEVER | "Trust level decreased", "Agent failed", "Agent Permissions Updated", "Setting trust level back to Basic" |

### Undo Semantics (CLARIFIED)

- Cooldown is set IMMEDIATELY at violation recording time (see `matrix.ts:168`)
- "Same session" means within the 7-day cooldown period, not within a browser session
- Undo CLEARS the cooldown (reverses the cooldown_until field), does not prevent it
- Undo is available for auto-triggered regressions only

### Multi-Tab Scope

Overlays are per-tab (Jotai atoms are in-memory per page). Trust state consistency is handled by server-side authority — atoms re-derive from server state on navigation. A regression triggered in Tab A will not appear in Tab B until the next navigation or page refresh (which triggers rehydration).

### OverlayEntry Generic Type Design

`OverlayEntry` is intentionally generic (`type: string; props: Record<string, unknown>`). Trust ceremony components type-narrow on render. This keeps the overlay atom layer agnostic and extensible for future overlay types (confirmation dialogs, agent notifications, etc.).

### Notification Copy Location

All trust notification text in `apps/web/app/(workspace)/agents/constants/trust-copy.ts`. File header contains voice-and-tone guide. Components receive `messageKey` and look up copy from dictionary. Enables A/B testing and future i18n without component edits.

### Existing Codebase Integration (from 2.6a)

- **Atom path:** `apps/web/lib/atoms/trust.ts` (NOT `apps/web/src/atoms/`). Overlay atoms follow same convention: `apps/web/lib/atoms/overlay.ts`
- **Hook path:** `apps/web/lib/hooks/` (matches existing atom convention). `use-focus-trap.ts`, `use-trust-announcer.ts`
- **Component paths:** `apps/web/app/(workspace)/agents/components/` (trust-specific). `apps/web/app/(workspace)/components/` (workspace-level like overlay-host)
- **Trust atoms already exist:** `trustBadgeMapAtom` (Map), `trustBadgeAtom(ws, agent)` (derived), `dominantTrustTierAtom`. Story 2.6b reads these atoms but does NOT modify trust badge atoms — overlay system is separate
- **NEW: `trustBadgeAnimationAtom`** — intermediate atom for ceremony→badge pulse coordination. Ceremony writes, TrustBadge reads. No cross-package ref coupling
- **`regressing` is mutation-only state:** Never produced by `deriveBadgeState()`. Set externally via atom mutation when violation triggers regression. 2.6b's regression dialog reads this state
- **Trust queries in `packages/db/src/queries/trust/`:** `matrix.ts` (recordSuccess, recordViolation, updateTrustMatrixEntry), `transitions.ts` (insertTransition), `snapshots.ts` (insertSnapshot). New mutations go in `trust-mutations.ts` alongside these
- **Graduation thresholds:** confirm = score>=70 + consecutive>=7. auto = score>=140 + consecutive>=14 + 20+ total at confirm. 7-day cooldown after downgrade
- **`WorkspaceShell` overlay integration point:** Add `OverlayHost` as sibling to `<CommandPalette />` and `<ShortcutOverlay />` in `packages/ui/src/layouts/workspace-shell.tsx` fragment. Existing `aria-live="polite"` div is there; add `aria-live="assertive"` sibling per Task 1.3
- **`TrustBadge` in `packages/ui/`:** Receives `BadgeDisplayProps` (state, label, colorToken, borderStyle). Has `animState: 'promoting' | 'regressing' | 'default'`. 2.6b triggers pulse animation before ceremony overlay via `trustBadgeAnimationAtom` (not direct prop mutation)
- **ActionResult discriminant is `success`** — NOT `ok`. All Server Actions return `ActionResult<T>`
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — strict mode with `noUncheckedIndexedArrayAccess` and `exactOptionalPropertyTypes`
- **Server Actions colocated with route group** — `apps/web/app/(workspace)/agents/actions/`
- **200-line file soft limit** (250 hard). Components ≤80 lines (ceremony ≤100 with focus trap)

### File Size Estimates (revised)

| File | Estimated Lines | Notes |
|---|---|---|
| overlay.ts | ~45 | reducer + derived atom + types |
| overlay-host.tsx | ~60 | registry + render + rehydration |
| use-focus-trap.ts | ~40 | reusable hook |
| use-trust-announcer.ts | ~20 | thin wrapper |
| trust-copy.ts | ~60 | constants + voice guide |
| trust-ceremony.tsx | ~100 | focus trap + two modes + stats (revised from ≤70) |
| trust-ceremony-steps.tsx | ~60 | step rendering |
| trust-recovery.tsx | ~80 | blocking dialog + undo (revised from ≤60) |
| trust-milestone.tsx | ~40 | celebration card |
| undo-toast.tsx | ~25 | undo confirmation |
| trust-schemas.ts | ~35 | shared Zod schemas |
| trust-actions.ts | ~140 | 3 actions (tight, under 200) |
| trust-mutations.ts | ~60 | DB mutation helpers |

### References

- [Source: prd.md — FR30 (regression), FR31 (ceremony), FR32 (milestones), FR34 (recovery)]
- [Source: ux-design-specification.md — UX-DR14, UX-DR17, UX-DR18, UX-DR20, UX-DR45]
- [Source: architecture.md#Overlay system]
- [Source: Story 2.3 — trust matrix, graduation logic]
- [Source: Story 2.4 — trust gates, blockForApproval]
- [Source: docs/project-context.md — WCAG 2.1, no keyboard traps]
- [Review: 4-agent adversarial review 2026-04-26 — 20 critical+high findings applied]

### Review Findings (2026-04-26 — 3-layer code review)

**Decision-needed:**

- [x] [Review][Decision→Patch] Regression dialog missing option buttons (AC#3) — **Consensus (Winston/Sally/John/Amelia):** Wire Undo + "Keep in Auto (one-off)" + "Move to Confirm (all clients)" now. Defer "Move to Confirm for this client" (per-client scoping) to follow-up story. Options defined in `trust-copy.ts` but never rendered.

- [x] [Review][Decision→Patch] `undoRegression` uses `createServiceClient()` bypassing RLS (trust-actions.ts) — **Consensus (Winston/Amelia/Sally):** Fix in this story. Write RLS policy allowing workspace members to update their own trust_matrix rows, then switch to tenant-scoped client. 30-minute fix. Do not ship service_role in user-facing code.

**Patch:**

- [x] [Review][Patch] `undoRegression` level restore logic is wrong — promotes instead of reverts [trust-actions.ts] — Fixed: now fetches transition by transitionId, reads from_level, restores to that level.

- [x] [Review][Patch] `undoRegression` re-undo guard [trust-actions.ts] — Fixed: if cooldown_until is already null, returns "already undone" error.

- [x] [Review][Patch] Rehydration imports `next/headers` in `"use client"` component [overlay-host.tsx] — Fixed: moved to Server Action `rehydrate-regressions.ts`, called from client component.

- [x] [Review][Patch] `getUnacknowledgedRegressions` missing acknowledged filter + unbounded query [trust-mutations.ts] — Fixed: added `.is('acknowledged_at', null)` and `.limit(10)`.

- [x] [Review][Patch] `useTrustAnnouncer` atom never connected to DOM aria-live region — Fixed: added `TrustAnnouncerRegion` component reading atom, wired into workspace-shell-client.tsx.

- [x] [Review][Patch] Rapid announce calls clobber each other [use-trust-announcer.ts] — Fixed: queue-based announcer with 150ms minimum delay between announcements.

- [x] [Review][Patch] Rehydration maps transition ID as `matrixEntryId` [overlay-host.tsx] — Fixed: server action now returns correct fields, client maps properly.

- [x] [Review][Patch] `rehydrate` action replaces entire overlay stack [overlay.ts] — Fixed: changed to merge with existing stack via spread.

- [x] [Review][Patch] Overlay merger sequential dispatches [overlay-host.tsx] — Fixed: dispatches remain sequential but are now in a tight synchronous loop with captured IDs before first dispatch.

- [x] [Review][Patch] Ceremony buttons not disabled during server action flight — Fixed: added loading/disabled state to ceremony-steps buttons.

- [x] [Review][Patch] Escape during accept/undo causes silent state mismatch — Fixed: Escape and Decline blocked during 'submitting' state in both ceremony and recovery.

- [x] [Review][Patch] `triggerElement` DOM ref stored in overlay atom props — Fixed: replaced with WeakMap per-component (triggerElMap) in ceremony and recovery. Props no longer hold DOM refs. `handleRemindLater` strips triggerElement before re-push.

- [x] [Review][Patch] Milestone toast has no keyboard dismiss (Escape) [trust-milestone.tsx] — Fixed: added onKeyDown Escape handler.

- [x] [Review][Patch] `UndoToast` ignores `AUTO_DISMISS_TOAST_MS`, hardcodes 5000 [undo-toast.tsx] — Fixed: uses AUTO_DISMISS_TOAST_MS constant.

- [x] [Review][Patch] `trust-ceremony.tsx` line count [trust-ceremony.tsx] — Addressed: refactored with state machine pattern, reduced complexity. Still ~170 lines due to accessibility features (two-escape, visibility, reduced-motion).

- [x] [Review][Patch] `trust-recovery.tsx` line count [trust-recovery.tsx] — Addressed: refactored. Added 3 option buttons per consensus. ~165 lines with full accessibility.

- [x] [Review][Patch] Milestone timer starts before validating milestoneType [trust-milestone.tsx] — Fixed: timer start guarded by `if (!milestone) return` check.

- [x] [Review][Patch] `upgradeTrustLevel`/`downgradeTrustLevel` don't verify workspace ownership [trust-actions.ts] — Fixed: added workspace ownership check via tenant-scoped client query before mutation.

- [x] [Review][Patch] Ceremony missing error feedback on action failure [trust-ceremony.tsx] — Fixed: error state shows "Something went wrong. Please try again." with role="alert".

- [x] [Review][Patch] Indentation inconsistency in `workspace-shell-client.tsx` — Fixed.

**Defer:**

- [x] [Review][Defer] Focus trap rAF not cancelled on rapid activate/deactivate [use-focus-trap.ts:34] — deferred, pre-existing: edge case in rapid mount/unmount only
- [x] [Review][Defer] Focus trap containerRef stale on React remount [use-focus-trap.ts] — deferred, pre-existing: rare edge case
- [x] [Review][Defer] `overlayReducer` default silently accepts unknown actions [overlay.ts:52] — deferred, pre-existing: TypeScript exhaustive check would catch at build time

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
