# Story 4.4c: "Handled Quietly" Section & Mobile Triage

Status: backlog

<!-- Depends on: Story 4.4a (extraction, drafting, trust, state machine, recategorization) AND Story 4.4b (density components, action chips, undo toast) -->

## Story

As a VA reviewing my agent's work on mobile,
I want auto-handled emails grouped in a separate "Handled Quietly" section with a single-tap triage experience for drafts,
so that I can quickly verify agent actions on the go without navigating complex menus.

## Acceptance Criteria

1. **AC1 — "Handled Quietly" Section (UX-DR27):** Items categorized as `info` or `noise` at trust level ≥ 3 render below main inbox, separated by gold divider (`border-t-2 border-amber-500/40 my-6`). Section header: "Handled Quietly" + count badge (`bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`). Default collapsed. Items use compact density regardless of inbox density.

2. **AC2 — Escape Hatch:** Each item has ghost-style "Actually, this needed my attention" button. On click: item animates up to active inbox (300ms `ease-in-out`), trust metric for that pattern decreases. Section header shows count badge updated on removal.

3. **AC3 — Quiet Audit Nudge:** Every Friday at 9:00 AM user-local, if 5+ items handled quietly that week, show audit card: "Weekly Quiet Audit — 3 items for your review" with 3 random items + Approve/Escalate actions. "Skip this week" dismisses until next Friday. Dismiss persisted to localStorage.

4. **AC4 — Morning Brief Integration:** Story 4.3's Morning Brief gains summary row: "[X] items handled quietly — review" with gold accent left border. Clicking navigates to inbox with "Handled Quietly" auto-expanded. Hidden if 0 quiet items.

5. **AC5 — Mobile Primary Interaction (UX-DR51):** At `max-width: 767px`, tap card → full-page overlay slides up from bottom (300ms `ease-out`, framer-motion). Overlay contains: full preview, AI draft, action chips (Approve/Reject/Edit). Dismiss: tap chevron-down or swipe down 50px+. Focus trapped within overlay.

6. **AC6 — Mobile Swipe (UX-DR53, power users only):** Swipe right-to-left reveals action buttons underneath (Approve `bg-green-600`, Reject `bg-red-600`). Buttons stay revealed after swipe. User must TAP to confirm — no action on swipe release. Haptic: `navigator.vibrate(10)` on reveal. RTL: directions reversed. `prefers-reduced-motion: reduce`: swipe disabled, static buttons always visible below each card.

7. **AC7 — Draft Editing Desktop:** Inline textarea (shadcn) replaces draft text on Edit click. AI-suggested portions highlighted with `bg-primary/10`. Save/Cancel buttons below. Min height 3 lines. Auto-save on blur if content changed.

8. **AC8 — Draft Editing Mobile:** Quick-edit chips row above textarea — `[Change time]` `[Change date]` `[Change recipient]`. Tap chip inserts cursor at relevant position. Full textarea below chips. Auto-save on overlay dismiss if content changed.

9. **AC9 — Recategorization Tracking (FR28e):** Manual category corrections logged to `recategorization_log`. Recategorization rate (corrected/total) is primary trust metric for Inbox Agent. Server action updates `email_categorizations` and triggers `recategorize.ts` cascade from 4.4a.

10. **AC10 — Focus Management:** After Approve/Reject: focus moves to next card. If last card, focus moves to empty state or section header. Draft edit: focus trapped (textarea → Save → Cancel → textarea, Escape closes). Mobile overlay: focus trapped, Escape/swipe-dismiss returns focus.

11. **AC11 — Keyboard Triage (builds on Story 2.5):** `A` = Approve, `R` = Reject, `E` = Edit, `Tab` = next, `Shift+Tab` = previous. Card with focus shows `ring-2 ring-primary ring-offset-2`. In flood/batch: `A` on cluster header approves entire cluster with confirmation.

12. **AC12 — Action Chips Progressive Disclosure:** Desktop: 3 visible (Approve green, Reject red, Edit blue outline). Secondary behind "More ⋯" dropdown (Delegate, Snooze, Escalate). Mobile overlay: same 3 at bottom, "More ⋯" as bottom sheet (Radix Dialog `side="bottom"`).

## Developer Context

### Group A: Server Actions & Data Layer

- [ ] Task 1: Create `apps/web/app/(workspace)/agents/approvals/actions/handled-quietly-actions.ts` (~90 lines)
  - `getHandledEmails(workspaceId, limit?, offset?)` — fetches emails with `extraction_skipped` state from `email_processing_state`
  - `getHandledCount(workspaceId)` — returns count for badge
  - `getWeeklyAuditCount(workspaceId)` — returns unreviewed count from past 7 days
  - `promoteToInbox(emailId)` — changes state, removes from handled section
  - `reviewAll(emailIds)` — bulk marks as reviewed

- [ ] Task 2: Create `apps/web/app/(workspace)/agents/approvals/actions/draft-actions.ts` (~80 lines)
  - `approveDraft(draftId)` — updates status to `approved`, triggers trust metric update via `feedback-processor`
  - `rejectDraft(draftId, reason?)` — updates status to `rejected`, triggers trust metric update
  - `editDraft(draftId, edits)` — updates body/tone, increments corrections_count
  - `quickEditTone(draftId, tone)` — mobile chip action, regenerates via `quality` LLM tier
  - `quickEditLength(draftId, direction)` — mobile chip action for shorten/expand

- [ ] Task 3: Create `apps/web/app/(workspace)/agents/approvals/actions/recategorize-action.ts` (~60 lines)
  - `recategorizeEmail(emailId, newCategory)` — updates `email_categorizations` (`is_corrected`, `corrected_category`), calls `handleRecategorization()` from 4.4a, emits `email.categorization_corrected` signal
  - Verifies `workspace_id` and role permissions before saving

### Group B: "Handled Quietly" UI Components

- [ ] Task 4: Create `apps/web/app/(workspace)/agents/approvals/components/handled-quietly-section.tsx` (~100 lines)
  - Server Component
  - Gold divider, count badge, "Review all" button
  - Compact list of handled emails
  - Expand/collapse state

- [ ] Task 5: Create `apps/web/app/(workspace)/agents/approvals/components/handled-quietly-item.tsx` (~70 lines)
  - Compact: subject + category + status chip
  - "Actually needed my attention" ghost button
  - Desktop: inline expand. Mobile: opens overlay

- [ ] Task 6: Create `apps/web/app/(workspace)/agents/approvals/components/weekly-audit-nudge.tsx` (~40 lines)
  - Inline banner with count + "Review" / "Dismiss" buttons
  - Dismiss persisted to localStorage

- [ ] Task 7: Create `apps/web/app/(workspace)/agents/approvals/components/morning-brief-quiet-summary.tsx` (~30 lines)
  - Row for Morning Brief: count + "review" link with gold accent left border
  - Hidden if 0 quiet items

### Group C: Draft Review & Mobile Triage UI

- [ ] Task 8: Create `apps/web/app/(workspace)/agents/approvals/components/mobile-card-overlay.tsx` (~120 lines)
  - Client Component (`"use client"`)
  - Radix Dialog, slides from bottom (300ms)
  - Full preview, AI draft, action chips
  - Focus trap, dismiss on swipe-down 50px+ or Escape

- [ ] Task 9: Create `apps/web/app/(workspace)/agents/approvals/components/swipeable-card.tsx` (~100 lines)
  - Client Component (`"use client"`)
  - framer-motion drag gesture: swipe ≥ 80px reveals buttons underneath
  - Two-step: swipe reveals, TAP confirms
  - RTL support via `dir="auto"` detection
  - `prefers-reduced-motion`: static buttons always visible

- [ ] Task 10: Create `apps/web/app/(workspace)/agents/approvals/components/draft-editor.tsx` (~100 lines)
  - Desktop mode: textarea with AI highlights (`bg-primary/10`), Save/Cancel, auto-save on blur
  - Mobile mode: quick-edit chips (`[Change time] [Change date] [Change recipient]`) + textarea
  - Props: `{ draft, onSave, onCancel, isMobile }`

- [ ] Task 11: Create `apps/web/app/(workspace)/agents/approvals/components/draft-status-chip.tsx` (~30 lines)
  - Status → color: pending=amber, approved=green, rejected=red, edited=blue

- [ ] Task 12: Create `apps/web/app/(workspace)/agents/approvals/hooks/use-mobile-triage.ts` (~50 lines)
  - Detects viewport < 768px
  - Manages overlay state, swipe enable/disable

### Group D: Tests (~40 tests)

- [ ] Task 13: Unit tests `apps/web/__tests__/unit/handled-section.test.ts` (~6 tests)
  - Items categorized as handled appear in section
  - Section excluded from main inbox count
  - Collapse/expand toggle works
  - Escape hatch promotes item back to inbox

- [ ] Task 14: Unit tests `apps/web/__tests__/unit/recategorization-tracking.test.ts` (~6 tests)
  - Recategorization event logged with timestamp, old/new category
  - Triggers state machine cascade (actionable→non, non→actionable)
  - Rapid recategorization maintains correct final state

- [ ] Task 15: Unit tests `apps/web/__tests__/unit/use-mobile-swipe.test.ts` (~6 tests)
  - Swipe gesture logic at unit level (hook/function)
  - Threshold detection
  - Disabled state handling

- [ ] Task 16: Component tests `apps/web/__tests__/components/` (~8 tests)
  - `handled-quietly-section`: renders gold divider, count badge, items
  - `handled-quietly-item`: escape hatch action
  - `draft-editor`: textarea editing, save/discard
  - `swipeable-card`: two-step reveal logic (unit test of handler, not gesture simulation)

- [ ] Task 17: E2E tests `tests/e2e/handled-quietly.spec.ts` (~4 tests)
  - Handled section visible after processing items
  - Collapse/expand works
  - Move item back via escape hatch
  - Empty handled section

- [ ] Task 18: E2E tests `tests/e2e/mobile-inbox.spec.ts` (~3 tests)
  - Inbox renders at mobile viewport (375×812)
  - Swipe action indicators render (UI elements exist, NOT physical gesture simulation)
  - Tap opens email detail overlay

- [ ] Task 19: RLS tests `supabase/tests/recategorization-audit-rls.sql` (~3 tests)
  - VA can read recategorization events for their workspace
  - VA cannot read from other workspaces
  - Audit trail append-only

## Technical Requirements & Guardrails

- **Server Components by default.** Client Components: `mobile-card-overlay.tsx`, `swipeable-card.tsx`, `undo-toast.tsx`, `use-mobile-triage.ts`.
- **Gold divider**: `border-t-2 border-amber-500/40`. No other color.
- **Swipe thresholds**: reveal at ≥ 80px drag. Two-step: swipe reveals buttons, tap confirms action.
- **Bottom sheet** mobile: Radix Dialog with slide-from-bottom.
- **Quick-edit chips**: tone changes call `quickEditTone` → `quality` LLM tier → show loading state.
- **Handled emails excluded from unread count**: query `WHERE processing_state != 'extraction_skipped'`.
- **Weekly nudge**: localStorage key `handled-quietly-nudge-dismissed-{week}`, auto-resets Monday.
- **Responsive breakpoint**: `md:` = desktop (inline/side panel), below = mobile (overlay/bottom sheet).
- **Mobile density**: 2 tiers on mobile — standard (1–15) and compact (16+), generous tier skipped.
- **File limits**: 200 soft, 250 hard. All components under 120 lines.
- **ARIA**: overlay needs `aria-modal="true"`, focus trap. All buttons keyboard-accessible.
- **RTL**: `dir="auto"` on shell root. Tailwind `rtl:` variant for chip order and swipe direction.

## Previous Story Intelligence

| Story | Established | 4.4c Depends On |
|-------|-------------|-----------------|
| 2.5 | Keyboard triage (A/R/E/Tab), ApprovalQueue | Keyboard event handling, focus management |
| 4.4a | `feedback-processor.ts`, `draft_responses`, `trust.ts`, `email_processing_state`, `recategorize.ts` | Draft CRUD, trust updates, state transitions, recategorization cascade |
| 4.4b | Density components, `action-chips.tsx`, `undo-toast.tsx`, `inbox-list.tsx`, `density.ts` | Density rendering, action chips, undo pattern, inbox list |

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
