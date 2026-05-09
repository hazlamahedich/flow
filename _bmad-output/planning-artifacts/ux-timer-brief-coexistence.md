# UX Spec: Timer Sidebar + Morning Brief Responsive Coexistence

**Epic:** 5 (Time Tracking)
**Date:** 2026-05-09
**Source:** T4 from Epic 4 retro

---

## Problem

The timer sidebar (Epic 5) and morning brief panel (Epic 4) both occupy the right-side panel area. On mobile/tablet viewports, they must coexist without layout conflicts or information overload.

## Layout Strategy

### Desktop (≥1280px)

| Left (240px) | Center (flex) | Right (360px) |
|---|---|---|
| Sidebar nav | Main content | **Timer panel** (default) or **Morning Brief** (when active) |

- Right panel is shared context area, not duplicated
- Tab/toggle at top of right panel switches between Timer and Brief views
- Timer is sticky (always accessible); Brief slides in as overlay when new brief arrives
- Auto-dismiss Brief overlay after 30s or on user swipe/click-away

### Tablet (768px–1279px)

- Sidebar collapses to icon rail (80px)
- Right panel becomes slide-over drawer from right edge
- Timer panel: minimized floating pill (running time + stop button) at bottom-right
- Brief: full-width overlay slide-in from bottom (sheet pattern)
- Only one panel visible at a time; the other minimized

### Mobile (<768px)

- No sidebar; bottom tab bar navigation
- Timer: persistent bottom bar (like music player) — shows running time, tap to expand
- Morning Brief: accessed via tab bar or notification badge; full-screen view
- Timer and Brief are mutually exclusive views
- Brief "dismiss" returns to previous view

## Interaction Patterns

1. **Timer while reading Brief:** Timer pill remains visible at bottom of Brief view (desktop/tablet). On mobile, Brief has a timer indicator badge.
2. **Brief notification while timing:** Brief slides in as notification toast with key summary. Tap to expand, swipe to dismiss. Timer continues uninterrupted.
3. **Conflict resolution:** If both try to occupy right panel simultaneously, Timer wins (primary workflow). Brief queues as notification.

## Animation Specs

- Right panel tab switch: 200ms ease-out
- Brief overlay slide-in: 300ms ease-out from right (desktop), bottom (tablet/mobile)
- Timer pill expand: 200ms ease-out
- Auto-dismiss brief: fade-out 150ms after 30s

## Accessibility

- Tab switch has `role="tablist"` with proper ARIA
- Timer pill has `aria-live="polite"` for running time updates
- Brief overlay has focus trap; Escape closes
- Keyboard shortcut: `Cmd+B` for Brief, `Cmd+T` for Timer

## Implementation Notes

- Shared `RightPanel` component with `<Tabs>` from shadcn/ui
- Timer state persists across panel switches via Zustand store
- Brief data cached for 24h; refetch on morning cron trigger
- Responsive breakpoints match existing `mobile-responsive.spec.ts` pattern
