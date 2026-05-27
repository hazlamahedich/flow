# Deferred UI Backlog Audit — Epics 1–7

**Date:** 2026-05-27  
**Owner:** Alice (Product Owner)  
**Source:** Epic 7 Retrospective Action Item P1  

---

## Summary

This inventory consolidates every UI item that was deferred across Epics 1–7. The purpose is to surface invisible backlog, prevent deferred items from becoming permanently lost, and prioritize a UI sprint before Epic 8.

| Category | Deferred Items |
|----------|---------------|
| Epic 1 (Foundation) | 3 |
| Epic 2 (Agent Infra) | 4 |
| Epic 3 (Client Management) | 11 |
| Epic 4 (Morning Brief) | 22 |
| Epic 5 (Time Tracking) | 11 |
| Epic 6 (Calendar) | 1 |
| Epic 7 (Invoicing) | 38 |
| **Cross-cutting** | 21 |
| **TOTAL** | **111** |

---

## Cross-Cutting UI Infrastructure Gaps

These 21 items affect every epic and must be addressed before any more epics ship:

| # | Item | First Deferred | Latest Story | P0/P1/P2 |
|---|------|-------------|-------------|----------|
| 1 | **Generic toast notification system** | 3-2 | 7-3 (still `alert()`) | P0 |
| 2 | **Focus trap for modals** | 3-2 (EndRetainerDialog) | 7-4 (void/credit modals) | P0 |
| 3 | **Tooltip component** | 3-2 (retainer utilization) | 7-4 (voidReason tooltip) | P1 |
| 4 | **Success/loading animation infrastructure** | 3-2 | 7-3 (AC5a: badge highlight) | P1 |
| 5 | **Keyboard shortcut framework** | 4-4c (mobile triage) | 1-8 (command palette) | P2 |
| 6 | **Mobile responsive form wizard** | 3-3 (centered dialog) | 3-3 (still not full-screen) | P1 |
| 7 | **Radix Dialog pattern for all modals** | 3-2 | 7-4 (all modals) | P1 |
| 8 | **Body scroll lock utility** | 4-4c | 7-4 | P1 |
| 9 | **Body `aria-live` region for global announcements** | 4-3 | 7-4 (toast announcements) | P1 |
| 10 | **Date/time picker with timezone support** | 5-4 | 7-5 (payment date TZ) | P2 |
| 10 | **Form validation on blur (was AC on 3-3)** | 3-3 | 7-3 | P2 |

---

## Epic 7 — Invoicing (38 Items, Most Critical)

### Critical Blockers (P0)

| # | Item | First Deferred | Current State |
|---|------|-------------|-------------|
| 7-1 | **Time entry picker UI** | 7-1 → 7-2 → 7-3 → 7-3a | Still no UI. Billing computation is solid. Users cannot select time entries to invoice. |
| 7-2 | **Edit invoice page** | 7-2 | `/invoices/[id]/edit` returns 404. Never got a story. |
| 7-3 | **Overdue badge & detection** | 7-3 → 7-5 | Ghost state in code. `overdue` status exists in CHECK but never triggered. |
| 7-4 | **Generic toast/replace `alert()`** | 7-3 | Payment success shows `alert()` (temp workaround). User-facing. |

### High Priority (P1)

| # | Item | Notes |
|------|------|-------|
| 7-5 | Document attachments (FR45) | Placeholder shown. No upload. |
| 7-6 | Replace emoji status icons with lucide | Style guide violation, cosmetic. |
| 7-7 | Invoice list filter pills (All/Active/Voided/With Credit) | 7-4 did the data side but list filter pills are minimal. |
| 7-8 | Component tests for modals/badges | No test infrastructure for client components. |

---

## Previous Epics — Carry-Forward Items

### Epic 4 — Morning Brief (22 items)

Most items are in `handled-quietly` and `timeline` areas. Key carry-forwards:

| # | Item | First Deferred | Notes |
|---|------|-------------|-------|
| 4-1 | Open/Dismiss buttons non-functional | 4-3 | Actions are stubs (`formAction={undefined}`). Users see UI that does nothing. |
| 4-2 | Email detail pane (timeline) | 4-5 | Timeline cards are intentionally non-interactive. Hover state removed to hide dead click. |
| 4-3 | Mobile triage swipe gestures | 4-4c | Swipe down dismiss, 300ms animation, keyboard shortcuts all deferred. |
| 4-4 | DraftEditor lacking shadcn Textarea | 4-4c | AC7: missing auto-save, AI highlighting, quick-edit chips. |
| 4-5 | Brief telemetry signals (`brief.viewed`) | 4-3 | Not emitted. No data on user engagement. |

### Epic 3 — Client Management (11 items)

| # | Item | Notes |
|------|------|-------|
| 3-1 | TeamAccessPanel on client detail page | Stub placeholder "coming soon" exists but never wired. |
| 3-2 | Member-picker wiring | Exists as component but never imported. |
| 3-3 | Retainer historical timeline UI | Query exists but no component. |
| 3-4 | Full-page overlay for wizard (AC1) | Still centered dialog on all viewports. |
| 3-5 | Zod email validation in wizard | No `.email()` on email field. |

### Epic 5 — Time Tracking (11 items)

| # | Item | Notes |
|------|------|-------|
| 5-1 | Time-of-day picker for entries | Required for billing overlap detection (5-4a). |
| 5-2 | Gap/overlap detector UI | Detectors work but UI for users to see/manage them deferred. |
| 5-3 | Zero-entry day flagging | Requires workspace calendar config (post-MVP). |
| 5-4 | Timezone mismatch on UI | Payment date TZ inconsistency in 7-3 is same root problem. |

---

## Recommended UI Sprint Stories

Based on this audit, the following stories should be created before Epic 8:

| Priority | Story | Dependencies | Value |
|----------|-------|-------------|-------|
| P0 | **Time Entry Picker UI** | 7-3a (billing done) | Unblocks core invoicing workflow |
| P0 | **Toast/Notification System** | None | Unblocks every epic (4 deferred items, 7-3 alert()) |
| P0 | **Edit Invoice Page** | 7-1, 7-2, 7-3 | Users need to correct invoices |
| P1 | **Modal Accessibility Kit** | Radix Dialog | Fixes focus trap across 8+ modals |
| P1 | **Overdue Detection + Badge** | 7-3 (status exists) | Completes status lifecycle |
| P1 | **Document Attachments UI** | 7-1 (schema done) | FR45 fulfillment |
| P2 | **Mobile Form Responsive Pass** | 3-3, 4-4c, 7-x | Cross-epic consistency |

---

## Appendix: Full 111-Item List

See Epic 7 Retrospective, Section "What Didn't Go Well #3" and `epic-7-retro-2026-05-27.md` for complete item-level details.

---

Alice (Product Owner): "This audit makes the invisible visible. Time entry picker is the single most important item — it's the gap between 'billing works' and 'users can actually invoice their time.' I'm scheduling a UI sprint before Epic 8 starts."
