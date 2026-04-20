---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - prd.md
  - architecture.md
  - ux-design-specification.md
  - trust-graduation-mini-spec.md
  - inbox-agent-spec.md
  - calendar-agent-spec.md
---

# Flow OS - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Flow OS, decomposing the requirements from the PRD, UX Design Specification, Architecture Decision Document, and companion specs into implementable stories.

## Requirements Inventory

### Functional Requirements

**Workspace & User Management**
- FR1: Workspace owner can create a workspace and invite team members via email
- FR2: Workspace owner can assign roles (Owner, Admin, Member, ClientUser) to control access levels
- FR3: Team members can access only the clients and data their role permits, enforced at the data layer
- FR4: Workspace owner can revoke access for team members, with immediate effect across all active sessions
- FR5: Seasonal subcontractors can be granted time-bound access that automatically expires on a set date
- FR6: Workspace owner can transfer ownership to another member via a confirmed succession flow
- FR7: Users can authenticate via magic link with a 15-minute expiry and optional "remember this device" toggle
- FR8: Client users can access the portal via a secure, time-limited link without creating an account, with abuse prevention mechanisms
- FR9: Users can update their profile information (name, email, timezone, avatar)
- FR10: Workspace owner can view active sessions and revoke any session remotely

**Client Management**
- FR11: Users can create client records with contact details, service agreements, and billing preferences
- FR12: Users can view all clients in a filterable/sortable list with health indicators
- FR13: Users can edit client details, with changes reflected across all associated data (invoices, reports, time entries)
- FR14: Users can archive clients to remove them from active views while preserving historical data
- FR15: Users can import client records from CSV file (deferred to v1.1)
- FR16: Users can associate team members with specific clients to scope their access

**AI Agent System**
- FR17: Users can activate and configure individual AI agents per workspace
- FR18: Users can review what each agent is about to do and why before approving execution
- FR19: Users can approve, modify, or reject agent-proposed actions individually or in batch
- FR20: Users can deactivate an agent at any time, with in-flight tasks either completed or gracefully cancelled
- FR21: Users can view a complete history of all agent actions, including inputs, outputs, and human overrides
- FR22: Users can adjust agent schedules and trigger conditions
- FR23: When agents coordinate on related work, users can see a unified activity timeline
- FR24: When agent output fails validation, the user is notified with explanation and suggested resolution
- FR25: Users can provide feedback on agent outputs to improve future performance
- FR26: Agent actions are subject to execution time limits, with incomplete actions paused
- FR27: Users can issue corrected versions of agent output to clients with audit trail
- FR28: Agents follow a coordination protocol via shared signals, each functioning independently if others are inactive

**Inbox Agent**
- FR28a: Users can connect client Gmail inboxes via OAuth, mapped to exactly one client
- FR28b: Inbox Agent categorizes incoming emails: urgent, action-needed, info, noise
- FR28c: Inbox Agent generates Morning Brief daily at configurable time
- FR28d: Inbox Agent extracts action items and surfaces draft responses at trust level 2+
- FR28e: Users can correct email categorizations, tracked as trust metric
- FR28f: Inbox Agent learns VA writing style from approved drafts
- FR28g: Cross-client data isolation enforced at agent run level
- FR28h: Email content sanitized before LLM processing

**Calendar Agent**
- FR28i: Users can connect client Google Calendars via OAuth
- FR28j: Calendar Agent detects scheduling conflicts in real-time
- FR28k: Calendar Agent consumes scheduling requests from Inbox Agent
- FR28l: On VA approval, Calendar Agent creates events via API
- FR28m: Calendar Agent detects client bypass events, emits signals to Client Health
- FR28n: Calendar Agent proposes resolution chains for cancelled/rescheduled events
- FR28o: Calendar Agent generates daily calendar preview for Morning Brief

**Trust & Autonomy System**
- FR29: Users can configure trust levels as per-agent per-action-type matrix
- FR30: System suggests trust adjustments with 7-day cooldown on downgrade
- FR31: Pre-check pass but post-execution violation halts delivery, alerts user
- FR32: Users can override any automated trust decision manually
- FR33: Users can define pre-conditions before agent acts
- FR34: Auto-trust failure triggers downgrade to supervised for that instance

**Invoicing & Billing**
- FR35: Users can create invoices with line items tied to time entries or fixed services
- FR36: Users can send invoices via email with secure payment link
- FR37: Users can create recurring invoices that auto-generate
- FR38: Users can record partial payments with balance tracked automatically
- FR39: Clients can pay invoices online via Stripe
- FR40: Users can view invoice status in centralized list
- FR41: Users can void or credit-note invoices with audit-trail reason
- FR42: Payment events processed exactly once (idempotency)
- FR43: Users can reconcile time entries against invoiced amounts
- FR44: Duplicate invoices prevented by dedup logic
- FR45: Users can attach supporting documents to invoices (deferred to v1.1)

**Time Tracking**
- FR46: Users can log time entries manually with client, project, date, duration, notes
- FR47: Users can start/stop a timer associated with a client and project
- FR48: Users can edit time entries with automatic flagging of downstream effects
- FR49: Time Integrity agent detects anomalies and surfaces them
- FR50: Users can view time entries by client, project, date range, or team member

**Client Portal**
- FR51: Client users can view invoices and payment history without a Flow OS account
- FR52: Client users can pay invoices directly through the portal
- FR53: Client users can approve or request changes to agent-generated reports
- FR54: Client users cannot see other clients' data or internal workspace info

**Subscription & Tier Management**
- FR55: Workspace owner can view and change subscription tier at any time
- FR56: System enforces tier limits with proactive notifications and one-click upgrade
- FR57: Downgrade preserves excess data in read-only form
- FR58: Workspace owner can manage payment methods and view billing history
- FR59: Subscription lifecycle: Active → Past Due → Suspended → Deleted with reactivation
- FR60: Agent jobs paused in Past Due/Suspended states, resume on reactivation
- FR61: Free tier users informed of 5% transaction fee at invoice creation
- FR62: Subscription changes prorated per-transition

**Reporting**
- FR63: Users can generate weekly client reports with customizable parameters
- FR64: Weekly Report agent auto-drafts reports for user review
- FR65: Users can customize report templates per client
- FR66: Users can review chronological log of all agent actions with full context
- FR67: Users can export reports as PDF
- FR68: Users can share reports with clients through the portal

**Onboarding & Setup**
- FR69: Setup wizard guides to first real action within first session
- FR70: First agent activation shows demo action within 30 seconds
- FR71: Setup wizard includes working-style preference questions for initial trust levels
- FR72: Users can activate/deactivate individual agents after setup
- FR73: Onboarding checklist with progress tracking guides to first client-facing action

**Client Engagement & Communication**
- FR73a: Users can define retainer agreements per client with automatic tracking
- FR73b: Users can view unified communication timeline per client
- FR73c: System detects scope creep at 90% retainer allocation and alerts VA
- FR73d: Users can create invoices from flat-rate retainers
- FR73e: "New Client Setup" wizard in under 5 minutes

**Dashboard, Navigation & Discovery**
- FR74: Home dashboard with pending approvals, agent activity, invoices, health alerts
- FR75: Persistent navigation to all major areas
- FR76: Meaningful empty states with CTAs
- FR77: Search across all entities via command palette
- FR78: Undo most recent action within 30 seconds

**Notifications & Communication**
- FR79: In-app notifications for agent actions, trust changes, payment events
- FR80: Configurable notification preferences by type and channel
- FR81: Alerts for agent failures with resolution path
- FR82: Client email notifications for invoices, payments, reports

**Error Handling & Recovery**
- FR83: Stripe payment failure shows error reason with retry options
- FR84: Agent error preserves partial state, offers retry or manual completion
- FR85: Expired magic link provides one-click resend
- FR86: CSV import reports failed rows (v1.1)
- FR87: Soft delete vs hard delete distinction

**Data Management & Compliance**
- FR88: Users can export all workspace data in portable formats
- FR89: GDPR deletion with tiered retention schema
- FR90: Hash-chain integrity verification on audit trail
- FR91: Tenant provisioning creates fully isolated workspace
- FR92: Workspace deletion with export option and 30-day recovery window

**Concurrency & Data Integrity**
- FR93: Concurrent edit conflict detection with both versions presented
- FR94: Warning when editing invoiced time entries
- FR95: Agent-human conflict detection with human priority
- FR96: Idempotent write operations

**Accessibility & Platform**
- FR97: WCAG 2.1 AA compliance
- FR98: Mobile-responsive critical workflows
- FR99: Keyboard shortcuts with discoverable reference

**Analytics & Validation**
- FR100: Usage analytics with agent completion rates and trust distribution
- FR101: Validation thesis metrics tracking
- FR102: Per-client financial summaries

### Non-Functional Requirements

**Performance (11)**
- NFR01: Page load <2s (P95)
- NFR02: Agent actions <30s single, <120s multi-step (P95)
- NFR03: Agent approval queue <1s interactive for 50 items (P95)
- NFR04: Dashboard <3s initial load (P95)
- NFR05: Stripe webhook <5s processing
- NFR06: Search/command palette <500ms
- NFR07: Timer start/stop <500ms optimistic
- NFR07a: Email categorization <60s (P95)
- NFR07b: Calendar conflict detection <30s (P95)
- NFR07c: Morning Brief generation <10s

**Security (14)**
- NFR08-NFR16d: TLS 1.3, AES-256, RLS on every table, magic link expiry, prompt injection defense (3 layers MVP), PII tokenization, session invalidation, rate limiting, Stripe hosted checkout, zero cross-tenant leakage, cross-client isolation, email sanitization, OAuth encryption, voice profile encryption

**Reliability (6)**
- NFR17-NFR22: Tiered uptime (99-99.9%), agent recovery <5min, daily backups, saga pattern, LLM fallback, at-least-once notifications

**Scalability (3)**
- NFR23-NFR25: 100 concurrent workspaces, query performance at 2-3x volume, 20 concurrent agent actions

**Observability (5)**
- NFR26-NFR30: Structured JSON logs, LLM cost per workspace, alerting within 2min, error rate monitoring, synthetic health checks

**Data Lifecycle (7)**
- NFR31-NFR37: Data export <24h, GDPR tiered deletion, audit retention by tier, US-only residency, SOC 2 readiness, DPA available, quarterly isolation verification

**Cost Governance (3)**
- NFR38-NFR40: Per-workspace LLM budget, cost estimation before execution, daily spend alerts

**Accessibility (5)**
- NFR41-NFR45: Keyboard operable, ARIA live regions, non-color indicators, logical focus order, contrast ratios

**Integration (5)**
- NFR46-NFR50: Stripe retry (1s/5s/30s), LLM circuit breaker, email retry, 30s API timeouts, plain-language errors

**Onboarding (3)**
- NFR51-NFR53: First agent task <5min, abandonment detection, tiered support SLA

**Billing Accuracy (3)**
- NFR54-NFR56: Usage metering ≥99.9%, real-time usage visibility, 30-day dispute window

### Additional Requirements (from Architecture)

- **Starter Template:** Custom Turborepo scaffold (no existing starter covers 180 rules)
- **Monorepo:** 9 packages (ui, trust, editor, types, state, db, agents, test-utils, config)
- **Single App with Route Groups:** (workspace) + (portal)/[slug] in one Next.js app
- **Orchestration:** pg-boss with 4-method AgentOrchestrator seam
- **Agent Import DAG:** No cross-agent imports, enforced via ESLint
- **Blast Radius Taxonomy:** P0-P3 test depth scaling
- **RLS Defense-in-Depth:** Middleware gate → RLS policies → Audit anomaly scan
- **200-Line File Limit:** With decomposition pattern for complex actions
- **Custom Turborepo scaffold** as first implementation story (architecture specifies exact init commands)
- **Shared Server Actions** in `apps/web/lib/actions/` to prevent duplication between route groups
- **test-utils sub-adapters:** core/, db/, agents/, ui/ with barrel re-exports core only
- **Trust mini-spec:** 5 tables, state machine, 0-200 scoring, 15 action types, versioned snapshots, event-sourced transitions
- **Pre-implementation requirements:** env var catalog, feature flag pattern, polling scaling threshold, service_role CI rule, financial property tests, non-empty agent output assertion

### UX Design Requirements

**Design System & Tokens**
- UX-DR1: Implement 3-layer token system (semantic, emotional, brand) as CSS variables
- UX-DR2: Agent identity color system — 6 permanent HSL colors with status overlay
- UX-DR3: Dual-theme architecture — workspace dark + portal light/warm
- UX-DR4: Portal brand tokens (8-12 CSS vars) with runtime swap via RSC
- UX-DR5: Typography system — Inter + JetBrains Mono via next/font/google
- UX-DR6: 4px base spacing grid with trust-density-responsive gap system
- UX-DR7: Motion language — cubic-bezier easing, 150ms/300ms durations, prefers-reduced-motion

**Custom Domain Components**
- UX-DR8: AgentProposalCard — triage unit with keyboard shortcuts (A/R/E/Tab)
- UX-DR9: TrustBadge — visual trust level indicator per agent
- UX-DR10: PersistentTimer — always-visible sidebar timer with project picker
- UX-DR11: ClientPortalShell — branded wrapper for all portal views
- UX-DR12: CommandPalette — Cmd+K with 15-20 actions, search across entities
- UX-DR13: WorkspaceShell — sidebar + topbar + agent status strip
- UX-DR14: PortalShell — branded header + client navigation
- UX-DR15: AgentCadenceTiers — high/low/ambient rendering in single AgentCard

**Trust Progression UI**
- UX-DR16: Trust density viewport — gap/border/badge density per trust level (16/20/28px)
- UX-DR17: Trust transition ceremony — badge pulse, whisper notification, VA chooses
- UX-DR18: Trust regression UI — explained not punished, dignified rollback language
- UX-DR19: Monthly stick-time audit — temporary re-densification in Auto mode
- UX-DR20: Trust milestone celebrations — "100 tasks, no stumbles" earned markers

**Agent Inbox UX**
- UX-DR21: Inbox shape adapts to volume (0-3 calm, 4-12 active, 13+ collapsed clusters)
- UX-DR22: "The Inhale" — summary sentence before items render
- UX-DR23: "The Exhale" — completion screen with visible impact stories
- UX-DR24: Keyboard-driven triage flow — arrow navigate, A/R/E/Tab/S/T/→ actions
- UX-DR25: Flood state handling — batch mode at 147+ items, grouped by sender/urgency
- UX-DR26: Accordion reasoning — one expanded at a time, or 360px detail pane
- UX-DR27: "Handled quietly" section — gold accent divider, collapsed green items
- UX-DR28: Proactive transparency — surface what mattered since last check-in
- UX-DR29: Agency owner actions — Coach, Elevate, Shadow, Triage-to-VA, Set Precedent

**Onboarding & First Experience**
- UX-DR30: Setup wizard — signup → client → time entry → agent proposal in <5 min
- UX-DR31: Demo action within 30 seconds of first agent activation
- UX-DR32: Working-style preference questions that set initial trust levels
- UX-DR33: Free tier layout — no sidebar, inbox IS the product
- UX-DR34: Sidebar activates on second agent — reveal pattern, not paywall

**Portal Design**
- UX-DR35: Portal as trophy case — warm cream, premium feel, not clinical
- UX-DR36: Hero metric "Zero-Thought Tasks" — tasks that left client's mind
- UX-DR37: Invoice as value receipt — shows what hours bought
- UX-DR38: "Powered by Flow OS" footer with referral tracking
- UX-DR39: Next-week preview — TV cliffhanger pattern for retention
- UX-DR40: "Message Sarah" with response time estimate

**Emotional Design Patterns**
- UX-DR41: Morning Brief as habit anchor — "already handled" before "needs attention"
- UX-DR42: Anti-Hover guarantee — no escalation during absence
- UX-DR43: Context-shift detection — offer to reduce auto after extended absence
- UX-DR44: Pause Mode — agents hold the fort, return to Summary Mode
- UX-DR45: Graceful downgrade — show accumulated trust data, not threat
- UX-DR46: Wednesday micro-affirmation for agency — team member trust milestone story

**Accessibility**
- UX-DR47: ARIA live regions for dynamic content (inbox, timer, notifications)
- UX-DR48: Logical focus order in approval flows — auto-advance on action
- UX-DR49: Screen reader descriptive trust announcements
- UX-DR50: Skip-to-content and discoverable shortcut reference

**Responsive Design**
- UX-DR51: Mobile triage — condensed cards with swipe gestures
- UX-DR52: Sidebar collapse at tablet (240px → 56px)
- UX-DR53: Detail pane → full-page overlay on mobile

### FR Coverage Map

FR1: Epic 1 — Workspace creation and member invitation
FR2: Epic 1 — Role assignment (Owner, Admin, Member, ClientUser)
FR3: Epic 1 — Data-layer access scoping by role
FR4: Epic 1 — Immediate access revocation across sessions
FR5: Epic 1 — Time-bound subcontractor access
FR6: Epic 1 — Ownership transfer via succession flow
FR7: Epic 1 — Magic link authentication (15-min expiry, remember device)
FR8: Epic 9 — Client portal access via time-limited link (no account)
FR9: Epic 1 — User profile management (name, email, timezone, avatar)
FR10: Epic 1 — Active session viewing and remote revocation
FR11: Epic 3 — Client record creation with contact/agreements/billing
FR12: Epic 3 — Filterable/sortable client list with health indicators
FR13: Epic 3 — Client editing with cascading data updates
FR14: Epic 3 — Client archiving with historical data preservation
FR15: Epic 9 — CSV client import (deferred to v1.1)
FR16: Epic 3 — Team member association with clients for access scoping
FR17: Epic 2 — Agent activation and configuration per workspace
FR18: Epic 2 — Agent action transparency/explainability before execution
FR19: Epic 2 — Approve, modify, or reject agent actions (individual/batch)
FR20: Epic 2 — Agent deactivation with graceful in-flight task handling
FR21: Epic 2 — Complete agent action history with inputs/outputs/overrides
FR22: Epic 2 — Agent schedule and trigger condition adjustment
FR23: Epic 2 — Unified activity timeline for coordinated agent work
FR24: Epic 2 — Agent output validation failure notification
FR25: Epic 2 — Agent output feedback (thumbs up/down with note)
FR26: Epic 2 — Agent execution time limits with pause/resume/cancel
FR27: Epic 2 — Corrected client delivery with audit trail
FR28: Epic 2 — Agent coordination protocol (shared signals, common event format)
FR28a: Epic 4 — Gmail OAuth inbox connection (delegated/direct, 1:1 client mapping)
FR28b: Epic 4 — Email categorization (urgent, action-needed, info, noise)
FR28c: Epic 4 — Morning Brief daily generation at configurable time
FR28d: Epic 4 — Action item extraction with draft responses at trust level 2+
FR28e: Epic 4 — Email categorization correction tracking as trust metric
FR28f: Epic 4 — Writing style learning from approved drafts and per-client tone
FR28g: Epic 4 — Cross-client data isolation at agent run level
FR28h: Epic 4 — Email content sanitization before LLM processing
FR28i: Epic 6 — Google Calendar OAuth connection with configurable access
FR28j: Epic 6 — Real-time scheduling conflict detection
FR28k: Epic 6 — Scheduling request consumption from Inbox Agent
FR28l: Epic 6 — Event creation on VA-approved booking proposals
FR28m: Epic 6 — Client bypass detection and rate tracking
FR28n: Epic 6 — Cascade rescheduling for cancelled/rescheduled events
FR28o: Epic 6 — Daily calendar preview in Morning Brief
FR29: Epic 2 — Trust level configuration (per-agent, per-action-type matrix)
FR30: Epic 2 — Automated trust level suggestions with 7-day cooldown
FR31: Epic 2 — Post-execution constraint violation halts delivery, downgrades to supervised
FR32: Epic 2 — Manual trust decision override and revert
FR33: Epic 2 — User-defined pre-conditions for agent actions
FR34: Epic 2 — Auto-trust pre-check failure downgrades to supervised
FR35: Epic 7 — Invoice creation with line items (time entries or fixed services)
FR36: Epic 7 — Invoice delivery via email with secure payment link
FR37: Epic 9 — Recurring invoices on defined schedule
FR38: Epic 7 — Partial payment recording with automatic balance tracking
FR39: Epic 9 — Client online payment via Stripe
FR40: Epic 7 — Invoice status tracking (draft→paid→voided lifecycle)
FR41: Epic 7 — Invoice void/credit-note with audit-trail reason
FR42: Epic 9 — Idempotent payment and subscription lifecycle event processing
FR43: Epic 7 — Time entry reconciliation against invoiced amounts
FR44: Epic 9 — Duplicate invoice detection (same client, line items, date range)
FR45: Epic 7 — Supporting document attachment (deferred to v1.1)
FR46: Epic 5 — Manual time entry logging (client, project, date, duration, notes)
FR47: Epic 5 — Start/stop timer with client and project association
FR48: Epic 5 — Time entry editing with downstream invoice warnings
FR49: Epic 5 — Time Integrity agent anomaly detection (gaps, overlaps, low-hours)
FR50: Epic 5 — Time entry views by client/project/date/member
FR51: Epic 9 — Client portal invoice and payment history viewing
FR52: Epic 9 — Client portal invoice payment
FR53: Epic 9 — Client portal report approval/change requests
FR54: Epic 9 — Client portal strict data isolation
FR55: Epic 9 — Subscription tier viewing and changing (Free/Pro/Agency)
FR56: Epic 9 — Tier limit enforcement with proactive notifications
FR57: Epic 9 — Downgrade data preservation (read-only for exceeding clients)
FR58: Epic 9 — Payment method management and billing history
FR59: Epic 9 — Subscription lifecycle management (Active→Past Due→Suspended→Deleted)
FR60: Epic 9 — Agent job pause on subscription suspension, resume on reactivation
FR61: Epic 9 — Free tier 5% transaction fee notification
FR62: Epic 9 — Prorated subscription changes
FR63: Epic 8 — Weekly client reports (time, tasks, agent activity)
FR64: Epic 8 — Weekly Report agent auto-draft generation
FR65: Epic 8 — Customizable report templates (format, sections, branding)
FR66: Epic 8 — Chronological agent action log with full context
FR67: Epic 8 — PDF report export
FR68: Epic 8 — Report sharing via client portal
FR69: Epic 10 — Setup wizard to first real action in first session
FR70: Epic 10 — Demo agent action within 30 seconds of activation
FR71: Epic 10 — Working-style preference question setting initial trust levels
FR72: Epic 10 — Individual agent activation/deactivation post-setup
FR73: Epic 10 — Onboarding checklist with progress tracking
FR73a: Epic 3 — Retainer agreements (hourly, flat monthly, package-based)
FR73b: Epic 4 — Unified communication timeline per client
FR73c: Epic 3 — Scope creep detection at 90% of retainer allocation
FR73d: Epic 7 — Invoice creation from flat-rate retainers
FR73e: Epic 3 — New Client Setup wizard (under 5 minutes)
FR74: Epic 1 — Home dashboard (approvals, agent activity, invoices, health alerts)
FR75: Epic 1 — Persistent navigation to all functional areas
FR76: Epic 1 — Meaningful empty states with specific CTAs
FR77: Epic 1 — Cross-entity search via command palette
FR78: Epic 1 — Undo most recent action within 30 seconds
FR79: Epic 10 — In-app notifications (approvals, trust changes, payments)
FR80: Epic 10 — Notification preference configuration by type and channel
FR81: Epic 10 — Agent action failure/unexpected output alerts
FR82: Epic 9 — Client email notifications (invoices, payments, reports)
FR83: Epic 7 — Stripe payment failure error display with retry options
FR84: Epic 10 — Agent error partial state preservation with retry path
FR85: Epic 10 — Magic link expiry message with one-click resend
FR86: (Deferred to v1.1) — CSV import malformed data row reporting
FR87: Epic 10 — Soft delete (30-day recovery) vs hard delete (permanent)
FR88: Epic 10 — Workspace data export (CSV, JSON)
FR89: Epic 10 — GDPR-compliant data deletion with tiered retention
FR90: Epic 10 — Audit trail with hash-chain integrity verification
FR91: Epic 1 — Fully isolated tenant workspace provisioning
FR92: Epic 10 — Workspace deletion with data export option and 30-day recovery
FR93: Epic 1 — Simultaneous edit conflict detection and resolution
FR94: Epic 5 — Invoiced time entry edit discrepancy warning
FR95: Epic 10 — Agent-human concurrent conflict detection (human priority)
FR96: Epic 10 — Idempotent write operations across system
FR97: Epic 1 — WCAG 2.1 AA accessibility standards
FR98: Epic 1 — Mobile viewport support for critical workflows
FR99: Epic 1 — Keyboard shortcuts for approval queue, timer, agent actions
FR100: Epic 8 — Usage analytics (agent completion, approval rates, trust distribution)
FR101: Epic 8 — Validation thesis metrics tracking
FR102: Epic 7 — Per-client financial summaries (invoiced, paid, outstanding)

### Uncovered / Deferred Requirements

FR15: Deferred to v1.1 — CSV client import
FR45: Deferred to v1.1 — Invoice document attachments
FR86: Deferred to v1.1 — CSV import malformed data reporting

## Epic List

### Epic 1: Foundation, Auth & Day 1 Spark
Workspace setup, magic-link auth, RLS, tenant isolation, persistent layout shell (sidebar, dashboard skeleton), Day 1 Micro-Wizard giving a "first agent glimpse" (mock agent action), keyboard shortcuts, command palette, empty states with CTAs, design system tokens (dual-theme), dark theme, Inter + JetBrains Mono typography, conflict resolution for concurrent edits.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR9, FR10, FR74, FR75, FR76, FR77, FR78, FR91, FR93, FR97, FR98, FR99
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3, UX-DR7, UX-DR9, UX-DR17, UX-DR18, UX-DR19, UX-DR20, UX-DR21, UX-DR24, UX-DR25, UX-DR27

### Epic 2: Agent Infrastructure & Trust System
Agent orchestrator (pg-boss + AgentOrchestrator seam), agent signal schema, trust matrix (per-agent per-action-type: supervised/confirm/auto), pre-check + post-check gates, trust graduation with 7-day cooldown, manual override, `packages/trust` interface, agent history/audit timeline, trust progression UI, agent badge system (identity color + trust dot + status ring), approval queue with keyboard triage, agent coordination protocol.
**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34
**UX-DRs covered:** UX-DR4, UX-DR5, UX-DR8, UX-DR10, UX-DR13, UX-DR14, UX-DR22, UX-DR23

### Epic 3: Client Management
Client CRUD, contact details, service agreements, billing preferences, health indicators, archive/restore, team member scoping, retainer agreements (hourly/flat/package), scope-creep detection at 90%, New Client Setup wizard (under 5 minutes), meaningful empty states.
**FRs covered:** FR11, FR12, FR13, FR14, FR16, FR73a, FR73c, FR73e
**UX-DRs covered:** UX-DR25

### Epic 4: Morning Brief — The Aha Moment
Inbox Agent: Gmail OAuth connect, email categorization (4 tiers), action item extraction, Morning Brief daily generation at configurable time (default 6:00 AM), cross-client isolation, email sanitization, trust-based draft responses at level 2+, writing style learning, "Inhale before exhale" inbox pattern, orchestrated workflow inbox, empty inbox reassurance design, unified communication timeline per client.
**FRs covered:** FR28a, FR28b, FR28c, FR28d, FR28e, FR28f, FR28g, FR28h, FR73b
**UX-DRs covered:** UX-DR6, UX-DR7, UX-DR10, UX-DR11, UX-DR15, UX-DR22

### Epic 5: Time Tracking
Manual time entries, start/stop timer (persistent sidebar), edit with downstream invoice warnings, time entry views by client/project/date/member, Time Integrity agent for anomaly detection (gaps, overlaps, low-hours days), timer acknowledges within 500ms via optimistic UI.
**FRs covered:** FR46, FR47, FR48, FR49, FR50, FR94
**UX-DRs covered:** UX-DR11

### Epic 6: Calendar Agent & Scheduling
Google Calendar OAuth, real-time conflict detection, scheduling request consumption from Inbox Agent, booking proposals + VA approval flow, event creation, client bypass detection, cascade rescheduling, daily calendar preview in Morning Brief.
**FRs covered:** FR28i, FR28j, FR28k, FR28l, FR28m, FR28n, FR28o
**UX-DRs covered:** UX-DR10

### Epic 7: Invoicing & Payments
Invoice creation (line items tied to time entries or flat-rate retainers), send via email with payment link, partial payments, status tracking (draft→paid→voided), void/credit-note with audit trail, duplicate detection, time reconciliation, Stripe payment failure handling with retry, per-client financial summaries. Document attachment placeholder for v1.1.
**FRs covered:** FR35, FR36, FR38, FR40, FR41, FR43, FR45, FR73d, FR83, FR102
**UX-DRs covered:** UX-DR20

### Epic 8: Reporting & Client Health
Weekly client reports (time + tasks + agent activity), Weekly Report agent auto-drafts, customizable report templates (format/sections/branding), agent action chronological log, PDF export, share reports via portal, Client Health agent, usage analytics, validation thesis metrics, Friday Feeling ritual.
**FRs covered:** FR63, FR64, FR65, FR66, FR67, FR68, FR100, FR101
**UX-DRs covered:** UX-DR16

### Epic 9: Client Portal, Subscriptions & Billing
Client portal (light theme, portal branding presets), invoice viewing + payment, report approval, strict data isolation, Stripe payment integration, subscription tiers (Free/Pro/Agency), tier limit enforcement, downgrade data preservation, billing history, subscription lifecycle (Active→Past Due→Suspended→Deleted), agent job pause on suspension, proration, recurring invoices (moved from Epic 7), idempotent webhook processing, 5% free-tier transaction fee notice, CSV client import (v1.1 placeholder), duplicate invoice dedup, client email notifications.
**FRs covered:** FR8, FR15, FR37, FR39, FR42, FR44, FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR82
**UX-DRs covered:** UX-DR12, UX-DR26

### Epic 10: Onboarding, Polish & Launch Readiness
Setup wizard to first real action in first session, working-style preference → initial trust levels, onboarding checklist with progress, agent activation/deactivation, demo action within 30 seconds, in-app notifications, notification preferences, agent failure alerts, error handling & recovery (agent partial state, magic link expiry, soft/hard delete), data export (CSV/JSON), GDPR-compliant deletion (PII 30-day, financial 7-year), audit trail with hash-chain, agent-human concurrent conflict detection, workspace deletion with recovery, idempotent writes, context-shift detection, proactive transparency on return, agency owner actions layer.
**FRs covered:** FR69, FR70, FR71, FR72, FR73, FR79, FR80, FR81, FR84, FR85, FR87, FR88, FR89, FR90, FR92, FR95, FR96
**UX-DRs covered:** UX-DR28, UX-DR29, UX-DR30

## Epic 1: Foundation, Auth & Day 1 Spark

Workspace setup, magic-link auth, RLS, tenant isolation, persistent layout shell (sidebar, dashboard skeleton), Day 1 Micro-Wizard giving a "first agent glimpse" (mock agent action), keyboard shortcuts, command palette, empty states with CTAs, design system tokens (dual-theme), dark theme, Inter + JetBrains Mono typography, conflict resolution for concurrent edits.

### Story 1.1a: Turborepo Scaffold & CI Pipeline

As a developer,
I want a Turborepo monorepo scaffolded with shared build infrastructure and CI,
So that all subsequent stories build on a verified, consistently configured foundation.

**Acceptance Criteria:**

**Given** no existing project structure
**When** the scaffold is created
**Then** the monorepo root contains `turbo.json`, root `package.json` with pnpm workspaces, `.nvmrc` (Node 20 LTS), and `packages/` directory — without `apps/web` or any runtime application code
**And** six packages exist as buildable stubs: `packages/config` (shared TS/ESLint configs), `packages/tokens` (empty, target for 1.1b), `packages/ui` (depends on tokens), `packages/shared`, `packages/test-utils` (re-exports vitest + RTL, renderSmoke helper), `packages/db` (drizzle config + empty schema barrel)
**And** `packages/config` provides shared `tsconfig.base.json` (strict + noUncheckedIndexedArrayAccess + exactOptionalPropertyTypes) and `eslint.config.base.js` (no any, no @ts-ignore, no @ts-expect-error)
**And** `turbo.json` pipeline defines build/test/lint/typecheck tasks with correct dependsOn chains
**And** `pnpm build` succeeds across all packages with exit code 0 in under 60 seconds
**And** `pnpm test` succeeds with at least one smoke test importing from a workspace package
**And** `pnpm lint` succeeds with zero errors — no-any rule enforced
**And** CI pipeline (GitHub Actions) runs on PR: install → build → lint → test

### Story 1.1b: Design System Tokens & Consumption Proof

As a developer,
I want the design system token layer implemented with a verified consumption pattern,
So that all subsequent UI stories use a consistent, accessible, and testable design foundation.

**Dependencies:** Story 1.1a must be completed.

**Acceptance Criteria:**

**Given** the Turborepo scaffold exists with CI passing
**When** the design system tokens are implemented
**Then** `packages/tokens` exports typed JS objects and CSS custom properties for: color primitives, semantic colors (light + dark), typography, spacing, breakpoints, focus ring tokens
**And** workspace dark theme values defined under `[data-theme="dark"]`: base #0A0A0B, panels #161618, elevated #1E1E21
**And** light theme values defined under `[data-theme="light"]` with light-appropriate values
**And** theme switching via `data-theme` attribute on `<html>`, `setTheme()`/`getTheme()` functions, localStorage persistence
**And** 6 agent identity colors defined as permanent HSL tokens: Inbox (blue), Calendar (violet), AR Collection (amber), Weekly Report (green), Client Health (rose), Time Integrity (orange)
**And** semantic status colors: green handled, yellow needs attention, red act now
**And** typography via `next/font/google`: Inter body (13px), JetBrains Mono for code/agents (12px)
**And** 4px base spacing grid mapped to Tailwind preset
**And** layout grid constants: 240px/56px sidebar, 960px main, 360px detail pane, breakpoints 640/768/1024/1280
**And** Tailwind plugin maps CSS vars to utility classes
**And** proof `Button` component in `packages/ui` consumes tokens via Tailwind plugin (primary + secondary variants, ~30 lines)
**And** `packages/test-utils` exports `renderWithTheme()` helper used by Button test
**And** token validation script asserts valid CSS values, no orphans, no duplicates
**And** WCAG AA contrast check passes for all semantic color pairs in both themes (4.5:1 text, 3:1 large text)
**And** focus ring token produces visible indicator meeting 2px minimum + 3:1 contrast
**And** consumption README documents import pattern, Tailwind usage, theme switching, adding new tokens
**And** `turbo build && turbo test && turbo lint` all pass

### Story 1.2: Database Foundation & Tenant Isolation

As a developer,
I want the core database schema with RLS and tenant isolation,
So that every workspace's data is fully isolated from day one.

**Acceptance Criteria:**

**Given** the Turborepo scaffold exists
**When** database migration runs
**Then** `packages/db` contains a Supabase/Postgres client with `requireTenantContext()` middleware per architecture requirements
**And** RLS is enforced on every workspace-scoped table with `workspace_id ::text` cast per NFR09
**And** a `workspaces` table exists with tenant provisioning that creates a fully isolated workspace per FR91
**And** a `users` table exists with profile fields (name, email, timezone, avatar) per FR9
**And** a `workspace_members` table exists with role column (Owner, Admin, Member, ClientUser) per FR2
**And** an `app_config` table exists for tier limits and feature flags per architecture requirements
**And** RLS defense-in-depth is in place: middleware gate, RLS policies, audit anomaly scan per architecture requirements
**And** `packages/test-utils` includes factory-based test tenant provisioning per architecture requirements
**And** RLS test matrix scaffolding exists for every workspace-scoped table (pgTAP) per architecture requirements

### Story 1.3: Magic Link Authentication

As a user,
I want to authenticate via magic link,
So that I can securely access my workspace without a password.

**Acceptance Criteria:**

**Given** the database foundation is in place
**When** a user enters their email on the login page
**Then** a magic link is sent with a 15-minute expiry per FR7 and NFR10
**And** a maximum of 5 generation attempts per email per hour are enforced per NFR10
**And** an optional "remember this device" toggle is available per FR7
**And** upon clicking the magic link, the user is authenticated and redirected to their workspace
**And** session tokens are invalidated on role change/access revocation within 60 seconds per NFR13
**And** all data is encrypted in transit (TLS 1.3) per NFR08
**And** a loading state shows skeleton UI during authentication per UX-DR24

### Story 1.4: Workspace & Team Management

As a workspace owner,
I want to create a workspace, invite members, and manage roles,
So that my team can collaborate with appropriate access levels.

**Acceptance Criteria:**

**Given** a user is authenticated via magic link
**When** the user creates a workspace
**Then** they become the workspace owner (role: Owner) per FR1
**And** they can invite team members via email per FR1
**And** they can assign roles (Owner, Admin, Member, ClientUser) per FR2
**And** they can revoke access for team members with immediate effect across all active sessions per FR4
**And** they can grant seasonal subcontractors time-bound access that auto-expires per FR5
**And** they can transfer ownership via a confirmed succession flow per FR6
**And** team members can access only the clients and data their role permits per FR3
**And** the workspace owner can view active sessions and revoke any session remotely per FR10

### Story 1.5: User Profile Management

As a user,
I want to update my profile information,
So that my identity and preferences are accurate across the platform.

**Acceptance Criteria:**

**Given** a user is authenticated
**When** they navigate to profile settings
**Then** they can update their name, email, timezone, and avatar per FR9
**And** email changes require re-verification via magic link
**And** avatar uploads are stored securely with size constraints
**And** timezone selection affects all time displays across the workspace

### Story 1.6: Persistent Layout Shell & Navigation

As a user,
I want a persistent layout with sidebar navigation,
So that I can move between all major functional areas without losing context.

**Acceptance Criteria:**

**Given** a user is authenticated and in a workspace
**When** the app loads
**Then** a persistent sidebar (240px, collapses to 56px icon-only) is visible per UX-DR19
**And** navigation to all major functional areas is accessible from the sidebar per FR75
**And** the sidebar timer slot is present (empty placeholder for Epic 5) per UX-DR11
**And** a mobile-responsive layout supports critical workflows on mobile viewports per FR98
**And** sidebar collapse at tablet breakpoint (240px → 56px) per UX-DR52
**And** free tier layout shows no sidebar — inbox IS the product per UX-DR33
**And** sidebar activates on second agent activation via reveal pattern, not paywall per UX-DR34
**And** navigation transitions complete within 2 seconds (P95) per NFR01

### Story 1.7: Home Dashboard

As a user,
I want a home dashboard summarizing my workspace state,
So that I can quickly understand what needs my attention.

**Acceptance Criteria:**

**Given** a user is in their workspace with the layout shell
**When** they navigate to the home dashboard
**Then** they see sections for pending approvals, agent activity, outstanding invoices, and client health alerts per FR74
**And** the dashboard initial load completes within 3 seconds (P95) per NFR04
**And** empty states show specific calls-to-action (e.g., "Add your first client") per FR76 and UX-DR25
**And** skeleton UI displays during initial load per UX-DR24
**And** all sections are keyboard-navigable per FR99

### Story 1.8: Command Palette & Keyboard Shortcuts

As a user,
I want a command palette and keyboard shortcuts,
So that I can navigate and act quickly without touching the mouse.

**Acceptance Criteria:**

**Given** a user is in their workspace
**When** they press Cmd+K (or Ctrl+K)
**Then** a command palette opens with search across all entities per FR77 and UX-DR9
**And** results return within 500ms per NFR06
**And** 15-20 high-value actions are available in the palette per UX-DR9
**When** the user presses keyboard shortcuts
**Then** the approval queue, time tracker, and agent actions are operable via keyboard per FR99
**And** all interactive elements are operable via keyboard with visible focus indicators meeting WCAG 2.1 AA per NFR41

### Story 1.9: Undo & Conflict Resolution

As a user,
I want to undo recent actions and resolve concurrent edit conflicts,
So that mistakes are reversible and simultaneous edits don't cause data loss.

**Acceptance Criteria:**

**Given** a user performs an action in the workspace
**When** the action completes
**Then** the user can undo their most recent action within 30 seconds per FR78
**And** the undo triggers an optimistic UI update with rollback animation per UX-DR23
**Given** two users edit the same record simultaneously
**When** the conflict is detected
**Then** both versions are presented for resolution per FR93
**And** all system write operations employ idempotency mechanisms per NFR-related architecture requirements

### Story 1.10: Day 1 Micro-Wizard & Aha Glimpse

As a new user,
I want a guided first-session experience with a glimpse of agent capability,
So that I understand the platform's value within minutes of signing up.

**Acceptance Criteria:**

**Given** a new user completes authentication and workspace creation
**When** they enter the workspace for the first time
**Then** a Day 1 Micro-Wizard guides them through a brief setup flow
**And** the wizard includes a mock agent action that demonstrates agent capability (e.g., a simulated email triage)
**And** the mock action completes within seconds, showing the approval/reject pattern
**And** the wizard concludes with a call-to-action to connect their first real data source
**And** a demo agent action appears within 30 seconds of first activation per UX-DR31
**And** working-style preference questions set initial trust levels per UX-DR32
**And** the setup wizard flow covers signup → client → time entry → agent proposal in under 5 minutes per UX-DR30
**And** all interactive elements meet WCAG 2.1 AA standards per FR97
**And** dynamic content updates are announced to screen readers via ARIA live regions per NFR42 and UX-DR47
**And** color is never the sole indicator of state per NFR43
**And** ARIA live regions are implemented for dynamic content (inbox, timer, notifications) per UX-DR47
**And** skip-to-content link and discoverable shortcut reference are available per UX-DR50

## Epic 2: Agent Infrastructure & Trust System

Agent orchestrator (pg-boss + AgentOrchestrator seam), agent signal schema, trust matrix (per-agent per-action-type: supervised/confirm/auto), pre-check + post-check gates, trust graduation with 7-day cooldown, manual override, `packages/trust` interface, agent history/audit timeline, trust progression UI, agent badge system (identity color + trust dot + status ring), approval queue with keyboard triage, agent coordination protocol.

### Story 2.1: Agent Orchestrator Core & Signal Schema

As a developer,
I want the agent orchestration engine and signal schema,
So that all agents have a unified runtime for task execution and inter-agent communication.

**Acceptance Criteria:**

**Given** the database and monorepo foundation exist
**When** the agent orchestrator is implemented
**Then** `packages/agents` contains an `AgentOrchestrator` seam interface with 4 methods: enqueue, dequeue, complete, fail per architecture requirements
**And** pg-boss is configured as the job queue backend
**And** an `agent_signals` table exists with immutable insert-only records, correlation IDs, and causation IDs per architecture requirements
**And** agent modules follow `packages/agents/{agent-name}/` structure with zero cross-agent imports per architecture requirements
**And** the agent job queue supports up to 20 concurrent agent actions at launch per NFR25
**And** agent execution failures are recovered or escalated within 5 minutes per NFR18
**And** agent actions use compensating transactions (saga pattern) per NFR20
**And** every agent action emits structured JSON log with workspace_id, agent_type, correlation_id, action_type, duration_ms, outcome per NFR26

### Story 2.2: Agent Activation, Configuration & Scheduling

As a workspace owner,
I want to activate, configure, and schedule individual AI agents,
So that each agent operates according to my workspace needs.

**Acceptance Criteria:**

**Given** the agent orchestrator is running
**When** a workspace owner navigates to agent settings
**Then** they can activate and configure individual agents (Inbox, Calendar, AR Collection, Weekly Report, Client Health, Time Integrity) per workspace per FR17
**And** they can adjust agent schedules and trigger conditions (e.g., AR reminder frequency, report day/time) per FR22
**And** they can deactivate an agent at any time, with in-flight tasks either completed or gracefully cancelled per FR20
**And** the user is informed of the outcome of any in-flight task cancellation
**And** LLM provider failures are handled via multi-provider routing with automatic fallback per NFR21
**And** LLM API calls implement circuit breaker: 5 consecutive failures → 60-second circuit open per NFR47
**And** agent action cost is estimated and logged before execution for operations exceeding configurable threshold per NFR39
**And** LLM cost is tracked per workspace per day with alerts at 80% and 100% of monthly budget per NFR27

### Story 2.3: Trust Matrix & Graduation System

As a user,
I want to configure trust levels per agent and action type,
So that agents operate at the autonomy level I'm comfortable with.

**Acceptance Criteria:**

**Given** at least one agent is activated
**When** the user configures trust settings
**Then** they can set trust levels as a per-agent per-action-type matrix: supervised, confirm, or auto per FR29
**And** the system suggests trust level adjustments based on accumulated agent performance data with a 7-day cooldown per FR30
**And** the user can override any automated trust decision and manually set or revert trust levels at any time per FR32
**And** the user can define pre-conditions that must be satisfied before an agent acts per FR33
**And** `packages/trust` interface is implemented as an independent gate from RLS per architecture requirements
**And** trust graduation and RLS operate as independent gates per architecture requirements
**And** trust regression UI explains changes without punishment, using dignified rollback language per UX-DR18
**And** LLM cost ceiling is enforced per workspace per billing period per NFR38

### Story 2.4: Pre-Check & Post-Check Gates

As a user,
I want safety gates around agent actions,
So that agents are prevented from taking harmful or invalid actions.

**Acceptance Criteria:**

**Given** an agent is about to execute an action
**When** the pre-check runs
**Then** if the pre-check passes but post-execution output violates a constraint, the system halts delivery, alerts the user, and downgrades that action type to supervised per FR31
**And** when an auto-trust action fails pre-checks, the system downgrades the action to supervised mode and notifies the user per FR34
**And** validation layer boundaries are enforced: Server Actions always validate, Route Handlers always validate, agent execute() always validates per architecture requirements
**And** `ActionResult<T>` contract is used for every Server Action per architecture requirements
**And** `FlowError` discriminated union error types are used across all package boundaries per architecture requirements

### Story 2.5: Agent Approval Queue & Keyboard Triage

As a user,
I want to review, approve, modify, or reject agent-proposed actions,
So that I maintain control over what agents do on my behalf.

**Acceptance Criteria:**

**Given** an agent proposes an action requiring approval
**When** the user opens the approval queue
**Then** they see pending actions rendered within 1 second for up to 50 items (P95) per NFR03
**And** they can approve, modify, or reject actions individually or in batch per FR19
**And** they can review what each agent is about to do and why (transparency/explainability) per FR18
**And** keyboard-first triage is available: A approve, R reject, E edit inline, Tab expand reasoning, S snooze, T take over, arrow navigate per UX-DR8
**And** agent proposal cards use inline edit mode (no modal), expand/collapse reasoning, one-line summary per UX-DR22
**And** optimistic UI updates fire on approval actions (300ms), rollback animates visibly with inline explanation per UX-DR23
**And** logical focus order in approval flows is maintained with auto-advance on action per UX-DR48
**And** agent actions are subject to execution time limits, with incomplete actions paused and the user offered resume or cancel per FR26

### Story 2.6: Agent Badge System & Trust Progression UI

As a user,
I want visual indicators of agent identity, trust level, and status,
So that I can instantly recognize each agent and its autonomy state.

**Acceptance Criteria:**

**Given** agents are activated in the workspace
**When** agents appear in the UI
**Then** each agent displays a badge with agent icon in identity color + trust level dot (building/established/auto) + status ring when action needed per UX-DR4
**And** trust progression UI visually evolves: Supervised shows full reasoning and detail; Confirm shows shorter proposals; Auto shows mostly green handled items with minimal chrome per UX-DR5
**And** trust color transitions are discrete and announced: building blue → established violet → auto green per UX-DR13
**And** regression returns quietly to blue with whisper text per UX-DR13
**And** trust recovery path shows dignified rollback with "Of course. Let's walk together again for a while." language; one-click undo per UX-DR14
**And** screen readers announce trust level changes with descriptive trust announcements per UX-DR49
**And** trust milestone celebrations display earned markers (e.g., "100 tasks, no stumbles") per UX-DR20
**And** trust transitions include a ceremony — badge pulse, whisper notification, VA chooses to acknowledge per UX-DR17
**And** graceful downgrade shows accumulated trust data, not threats per UX-DR45

### Story 2.7: Agent Action History & Coordination Timeline

As a user,
I want to view a complete history of all agent actions and see how agents coordinate,
So that I have full visibility into agent behavior.

**Acceptance Criteria:**

**Given** agents have executed actions
**When** the user views the activity timeline
**Then** they see a complete history of all agent actions, including inputs, outputs, and human overrides per FR21
**And** when agents coordinate on related work, they see a unified activity timeline showing which agents contributed and how actions connected per FR23
**And** when agent output fails validation, the user is notified with explanation including error code, affected entity, and suggested resolution per FR24
**And** users can provide feedback on agent outputs (thumbs up/down with optional note) to improve future performance per FR25
**And** when an agent produces already-delivered output with an error, the user can issue a corrected version with audit trail per FR27
**And** the orchestrated workflow inbox shows a single operating rhythm, not six separate channels per UX-DR10

## Epic 3: Client Management

Client CRUD, contact details, service agreements, billing preferences, health indicators, archive/restore, team member scoping, retainer agreements (hourly/flat/package), scope-creep detection at 90%, New Client Setup wizard (under 5 minutes), meaningful empty states.

### Story 3.1: Client Data Model & CRUD

As a user,
I want to create, view, edit, and archive client records,
So that I can manage all client information in one place.

**Acceptance Criteria:**

**Given** a user is authenticated in a workspace
**When** they navigate to clients
**Then** they can create client records with contact details, service agreements, and billing preferences per FR11
**And** they can view all clients in a filterable/sortable list with health indicators per FR12
**And** they can edit client details, with changes reflected across all associated data (invoices, reports, time entries) per FR13
**And** they can archive clients to remove them from active views while preserving historical data per FR14
**And** they can associate team members with specific clients to scope their access per FR16
**And** empty states show specific CTAs ("Add your first client") per UX-DR25

### Story 3.2: Retainer Agreements & Scope Creep Detection

As a user,
I want to define retainer agreements and get alerted to scope creep,
So that I can manage client expectations and billing accurately.

**Acceptance Criteria:**

**Given** a client record exists
**When** the user configures a retainer agreement
**Then** they can set retainer type: hourly rate, flat monthly fee, or package-based per FR73a
**And** the system detects scope creep when time tracked exceeds 90% of retainer allocation per FR73c
**And** scope creep alerts surface in the dashboard and notification system
**And** retainer data is available for invoice generation in Epic 7

### Story 3.3: New Client Setup Wizard

As a user,
I want a guided wizard to set up a new client quickly,
So that I can onboard clients in under 5 minutes.

**Acceptance Criteria:**

**Given** a user clicks "Add Client"
**When** the New Client Setup wizard launches
**Then** the wizard guides through contact details, service agreement, billing preferences, and retainer setup in a streamlined flow per FR73e
**And** the wizard completes in under 5 minutes for a standard client setup
**And** upon completion, the client appears in the client list with all configured data
**And** the wizard shows meaningful progress indicators at each step

## Epic 4: Morning Brief — The Aha Moment

Inbox Agent: Gmail OAuth connect, email categorization (4 tiers), action item extraction, Morning Brief daily generation at configurable time (default 6:00 AM), cross-client isolation, email sanitization, trust-based draft responses at level 2+, writing style learning, "Inhale before exhale" inbox pattern, orchestrated workflow inbox, empty inbox reassurance design, unified communication timeline per client.

### Story 4.1: Gmail OAuth & Inbox Connection

As a user,
I want to connect client Gmail inboxes via OAuth,
So that the Inbox Agent can process incoming emails for my clients.

**Acceptance Criteria:**

**Given** a client record exists and the Inbox Agent is activated
**When** the user connects a Gmail inbox
**Then** OAuth flow completes with delegated or direct access per FR28a
**And** each inbox is mapped to exactly one client per FR28a
**And** OAuth tokens are encrypted at rest with refresh token rotation per NFR16c
**And** cross-client data isolation is enforced at the agent run level per FR28g and NFR16a

### Story 4.2: Email Categorization & Sanitization Pipeline

As a user,
I want incoming emails automatically categorized and sanitized,
So that I see what matters without exposure to malicious content.

**Acceptance Criteria:**

**Given** a Gmail inbox is connected
**When** a new email arrives
**Then** the Inbox Agent categorizes it into four tiers: urgent, action-needed, info, and noise per FR28b
**And** email categorization completes within 60 seconds of arrival (P95) per NFR07a
**And** email content is sanitized before LLM processing: HTML stripped, signatures removed, tracking pixels removed, prompt injection patterns stripped per FR28h and NFR16b
**And** PII tokenization is applied before data enters LLM prompts per NFR12
**And** LLM prompt injection defense is active: input sanitization, system prompt guardrails, output validation per NFR11
**And** single-step agent actions complete within 30 seconds (P95) per NFR02

### Story 4.3: Morning Brief Generation

As a user,
I want a daily Morning Brief summarizing overnight email activity,
So that I start each day knowing exactly what needs my attention.

**Acceptance Criteria:**

**Given** the Inbox Agent is active with connected inboxes
**When** the configured time arrives (default 6:00 AM, configurable)
**Then** the Morning Brief is generated per FR28c
**And** Morning Brief generation completes within 10 seconds of trigger per NFR07c
**And** the brief follows the "Inhale before exhale" pattern: summary sentence before items (e.g., "Your team handled 47 things overnight. Three need your eyes.") per UX-DR6
**And** the Morning Brief acts as a habit anchor — "already handled" content appears before "needs attention" per UX-DR41
**And** empty inbox shows reassurance design: "All clear — your agents handled everything overnight" per UX-DR15
**And** the brief surfaces in the orchestrated workflow inbox per UX-DR10

### Story 4.4: Action Item Extraction & Draft Responses

As a user,
I want action items extracted from emails with draft responses,
So that I can quickly handle urgent items without starting from scratch.

**Acceptance Criteria:**

**Given** emails are categorized as urgent or action-needed
**When** the Inbox Agent processes them
**Then** action items are extracted and surfaced with draft responses at trust level 2+ per FR28d
**And** the user can correct email categorizations, with corrections tracked as the trust metric for the Inbox Agent per FR28e
**And** the Inbox Agent learns the VA's writing style from approved drafts and per-client tone preferences per FR28f
**And** inbox density adapts: 0-3 items calm generous spacing, 4-12 grouped by agent type with urgency badges, 13+ collapsed clusters with priority-first sort per UX-DR7
**And** mobile triage uses condensed cards with swipe gestures per UX-DR51
**And** detail pane converts to full-page overlay on mobile viewports per UX-DR53
**And** flood state handling activates batch mode at 147+ items, grouped by sender/urgency per UX-DR25
**And** accordion reasoning shows one expanded at a time, or uses the 360px detail pane per UX-DR26
**And** "Handled quietly" section uses gold accent divider with collapsed green items per UX-DR27
**And** flood state handling activates batch mode at 147+ items, grouped by sender/urgency per UX-DR25
**And** accordion reasoning shows one expanded at a time, or uses the 360px detail pane per UX-DR26
**And** "Handled quietly" section uses gold accent divider with collapsed green items per UX-DR27

### Story 4.5: Unified Communication Timeline

As a user,
I want a unified communication timeline per client,
So that I can see all client interactions in chronological context.

**Acceptance Criteria:**

**Given** client emails are being processed
**When** the user navigates to a client detail view
**Then** they see a unified communication timeline per client showing all processed emails and agent actions per FR73b
**And** the timeline is filterable by date range and communication type
**And** agent proposal cards in the timeline use inline edit mode with expand/collapse reasoning per UX-DR22

## Epic 5: Time Tracking

Manual time entries, start/stop timer (persistent sidebar), edit with downstream invoice warnings, time entry views by client/project/date/member, Time Integrity agent for anomaly detection (gaps, overlaps, low-hours days), timer acknowledges within 500ms via optimistic UI.

### Story 5.1: Time Entry Data Model & Manual Logging

As a user,
I want to log time entries manually,
So that I can track work done for clients and projects.

**Acceptance Criteria:**

**Given** a user is authenticated with at least one client
**When** they log a time entry
**Then** they can specify client, project, date, duration, and notes per FR46
**And** time entries are scoped to the current workspace with RLS enforced
**And** time entries can be viewed by client, project, date range, or team member per FR50

### Story 5.2: Persistent Sidebar Timer

As a user,
I want a start/stop timer always visible in the sidebar,
So that I can track time with one click without leaving my current view.

**Acceptance Criteria:**

**Given** the layout shell is present
**When** the user clicks the timer in the sidebar
**Then** a timer starts associated with a client and project per FR47
**And** the timer acknowledges within 500ms via optimistic UI update per NFR07
**And** the sidebar timer slot (240px sidebar, collapses to 56px icon-only) shows elapsed time per UX-DR11
**And** the user can stop the timer with one click, creating a time entry
**And** a project picker is available for quick assignment per UX-DR11

### Story 5.3: Time Entry Editing & Invoice Impact Warnings

As a user,
I want to edit time entries with awareness of invoice impacts,
So that I can correct entries without inadvertently affecting billing.

**Acceptance Criteria:**

**Given** a time entry exists
**When** the user edits it
**Then** the edit is saved and the system automatically flags downstream effects on invoiced amounts per FR48
**And** when editing a time entry already invoiced, the system warns of the discrepancy per FR94
**And** edits are reflected across all associated data

### Story 5.4: Time Integrity Agent

As a user,
I want the Time Integrity agent to detect anomalies in my time tracking,
So that I can maintain accurate records without manual review.

**Acceptance Criteria:**

**Given** the Time Integrity agent is activated
**When** time entries are logged or reviewed
**Then** the agent detects anomalies: gaps, overlaps, and low-hours days per FR49
**And** anomalies are surfaced for user review through the approval queue
**And** the agent follows the trust matrix (supervised/confirm/auto) configured in Epic 2
**And** anomaly detection runs within the agent execution time limits per NFR02

## Epic 6: Calendar Agent & Scheduling

Google Calendar OAuth, real-time conflict detection, scheduling request consumption from Inbox Agent, booking proposals + VA approval flow, event creation, client bypass detection, cascade rescheduling, daily calendar preview in Morning Brief.

### Story 6.1: Google Calendar OAuth & Connection

As a user,
I want to connect client Google Calendars via OAuth,
So that the Calendar Agent can manage scheduling on my behalf.

**Acceptance Criteria:**

**Given** a client record exists and the Calendar Agent is activated
**When** the user connects a Google Calendar
**Then** OAuth flow completes with read-write access for the VA's personal calendar per FR28i
**And** configurable access per client calendar is available per FR28i
**And** OAuth tokens are encrypted at rest with refresh token rotation per NFR16c
**And** all external API calls timeout within 30 seconds per NFR49

### Story 6.2: Real-Time Conflict Detection

As a user,
I want the Calendar Agent to detect scheduling conflicts,
So that I avoid double-bookings across client calendars.

**Acceptance Criteria:**

**Given** Google Calendars are connected
**When** an event is created or modified
**Then** the Calendar Agent detects scheduling conflicts in real-time per FR28j
**And** conflict detection completes within 30 seconds of event change (P95) per NFR07b
**And** conflicts are surfaced through the agent approval queue from Epic 2

### Story 6.3: Booking Proposals & Event Creation

As a user,
I want the Calendar Agent to propose bookings and create events on approval,
So that scheduling is handled with my oversight.

**Acceptance Criteria:**

**Given** the Inbox Agent extracts a scheduling request (from Epic 4)
**When** the Calendar Agent processes it
**Then** it consumes the scheduling request, checks availability, and proposes optimal time slots per FR28k
**And** on VA approval of a booking proposal, the Calendar Agent creates the event on the appropriate calendar via API per FR28l
**And** multi-step agent actions complete within 120 seconds (P95) per NFR02
**And** the Calendar Agent communicates with the Inbox Agent via shared signal records (no direct imports) per FR28

### Story 6.4: Bypass Detection & Cascade Rescheduling

As a user,
I want to know when clients bypass me for scheduling and have cascade rescheduling handled,
So that I maintain control over client calendar management.

**Acceptance Criteria:**

**Given** the Calendar Agent is monitoring client calendars
**When** a client creates an event bypassing the VA
**Then** the Calendar Agent detects it and tracks bypass rates per client per FR28m
**And** bypass events surface as informational items in the inbox per UX-DR10
**When** an event is cancelled or rescheduled
**Then** the Calendar Agent identifies dependent events and proposes a resolution for the full chain per FR28n
**And** the daily calendar preview is included as part of the Morning Brief per FR28o

## Epic 7: Invoicing & Payments

Invoice creation (line items tied to time entries or flat-rate retainers), send via email with payment link, partial payments, status tracking (draft→paid→voided), void/credit-note with audit trail, duplicate detection, time reconciliation, Stripe payment failure handling with retry, per-client financial summaries. Document attachment placeholder for v1.1.

### Story 7.1: Invoice Data Model & Creation

As a user,
I want to create invoices with line items tied to time entries or fixed services,
So that I can bill clients accurately for work performed.

**Acceptance Criteria:**

**Given** time entries or retainer agreements exist for a client
**When** the user creates an invoice
**Then** they can add line items tied to time entries or fixed services per FR35
**And** they can create invoices from flat-rate retainers (not just time entries) per FR73d
**And** invoice status follows the lifecycle: draft → sent → viewed → partially paid → paid → overdue → voided per FR40
**And** duplicate invoice submissions for the same client, same line items, and same date range result in a single invoice per FR44
**And** supporting document attachment capability is stubbed for v1.1 per FR45

### Story 7.2: Invoice Delivery & Payment Link

As a user,
I want to send invoices to clients via email with a secure payment link,
So that clients can review and pay invoices conveniently.

**Acceptance Criteria:**

**Given** an invoice is in draft status
**When** the user sends the invoice
**Then** it is delivered to the client via email with a secure payment link per FR36
**And** email delivery tracks status and retries failed sends up to 3 times over 30 minutes per NFR48
**And** integration errors are surfaced to users in plain language per NFR50
**And** the invoice status updates to "sent" and tracks "viewed" status

### Story 7.3: Partial Payments & Balance Tracking

As a user,
I want to record partial payments against invoices,
So that I can track outstanding balances accurately.

**Acceptance Criteria:**

**Given** an invoice has been sent
**When** a partial payment is recorded
**Then** the balance is tracked automatically per FR38
**And** invoice status reflects partially paid state
**And** payment history is visible on the invoice detail

### Story 7.4: Void, Credit Note & Time Reconciliation

As a user,
I want to void or credit-note invoices and reconcile time entries,
So that billing corrections are handled cleanly with full audit trails.

**Acceptance Criteria:**

**Given** an invoice exists
**When** the user voids or issues a credit note
**Then** an audit-trail reason is recorded per FR41
**And** the invoice status updates to voided or credit-noted accordingly
**And** users can reconcile time entries against invoiced amounts per FR43
**And** per-client financial summaries show total invoiced, paid, and outstanding per FR102

### Story 7.5: Stripe Payment Failure Handling

As a user,
I want clear error handling when Stripe payments fail,
So that I can take alternative action quickly.

**Acceptance Criteria:**

**Given** a Stripe payment is attempted
**When** payment processing fails
**Then** the user sees the error reason and is offered retry or alternative action options per FR83
**And** Stripe integration never stores full card numbers, CVV, or raw bank account details per NFR15
**And** API rate limiting is enforced: webhook verified by signature, general API 100 req/min per user per NFR14

## Epic 8: Reporting & Client Health

Weekly client reports (time + tasks + agent activity), Weekly Report agent auto-drafts, customizable report templates (format/sections/branding), agent action chronological log, PDF export, share reports via portal, Client Health agent, usage analytics, validation thesis metrics, Friday Feeling ritual.

### Story 8.1: Weekly Client Reports

As a user,
I want to generate weekly client reports aggregating time, tasks, and agent activity,
So that I can review and share client progress.

**Acceptance Criteria:**

**Given** time entries and agent actions exist for a client in a reporting period
**When** the user generates a weekly report
**Then** it aggregates time, tasks, and agent activity per FR63
**And** users can customize report templates (format, sections, branding) for individual clients per FR65
**And** reports can be exported as PDF for delivery outside the platform per FR67
**And** reports can be shared with clients through the portal for review and approval per FR68

### Story 8.2: Weekly Report Agent Auto-Drafts

As a user,
I want the Weekly Report agent to auto-draft reports,
So that I can review polished reports instead of writing them from scratch.

**Acceptance Criteria:**

**Given** the Weekly Report agent is activated
**When** the reporting period ends
**Then** the agent auto-drafts a report based on the period's data for user review per FR64
**And** the draft follows the client's customized template if one exists
**And** the draft appears in the approval queue following the trust matrix from Epic 2
**And** users can review a chronological log of all AI agent actions with full context per FR66

### Story 8.3: Client Health Agent & Usage Analytics

As a user,
I want a Client Health agent and usage analytics,
So that I can proactively manage client relationships and track agent performance.

**Acceptance Criteria:**

**Given** clients exist with activity data
**When** the Client Health agent runs
**Then** it surfaces health indicators based on engagement, payment, and communication patterns
**And** workspace owners can view usage analytics showing agent task completion rates, approval rates, and trust level distribution per FR100
**And** the system tracks validation thesis metrics for product decisions per FR101

### Story 8.4: Friday Feeling Ritual

As a user,
I want a weekly summary of accumulated value each Friday,
So that I see the tangible impact of my agents and feel motivated.

**Acceptance Criteria:**

**Given** agents have been active during the week
**When** Friday arrives (configurable day)
**Then** a "Friday Feeling" summary is generated: "Here's what you accomplished. Now go live your life." per UX-DR16
**And** the summary shows accumulated value: tasks handled, time saved, trust milestones reached
**And** a completion screen ("The Exhale") shows visible impact stories per UX-DR23
**And** a Wednesday micro-affirmation highlights team member trust milestone stories for agency workspaces per UX-DR46
**And** the summary surfaces in the orchestrated workflow inbox per UX-DR10

## Epic 9: Client Portal, Subscriptions & Billing

Client portal (light theme, portal branding presets), invoice viewing + payment, report approval, strict data isolation, Stripe payment integration, subscription tiers (Free/Pro/Agency), tier limit enforcement, downgrade data preservation, billing history, subscription lifecycle (Active→Past Due→Suspended→Deleted), agent job pause on suspension, proration, recurring invoices (moved from Epic 7), idempotent webhook processing, 5% free-tier transaction fee notice, CSV client import (v1.1 placeholder), duplicate invoice dedup, client email notifications.

### Story 9.1: Client Portal Foundation & Light Theme

As a client user,
I want a clean portal to view my invoices and reports,
So that I can access my information without creating an account.

**Acceptance Criteria:**

**Given** a client user receives a secure, time-limited link
**When** they access the portal
**Then** they can view their invoices and payment history without needing a Flow OS account per FR51 and FR8
**And** they cannot see other clients' data or any internal workspace information per FR54
**And** the portal uses a light theme: warm cream #FAFAF8 surface, warm gold #D4A574 accent, warm gray borders per UX-DR26
**And** portal branding supports curated presets (Minimalist, Warm Host, Bold Professional) with constrained customization (8 visual vars + 4 content vars max) per UX-DR12
**And** portal design follows "trophy case" philosophy — warm cream, premium feel, not clinical per UX-DR35
**And** portal includes a "Powered by Flow OS" footer with referral tracking per UX-DR38
**And** abuse prevention mechanisms are active per FR8

### Story 9.2: Client Portal Invoice Payment & Report Approval

As a client user,
I want to pay invoices and approve reports through the portal,
So that I can complete transactions and provide feedback directly.

**Acceptance Criteria:**

**Given** a client user is in the portal
**When** they view an invoice
**Then** they can pay it directly through the portal per FR52
**And** client users receive email notifications for new invoices, payment confirmations, and shared reports per FR82
**When** a report is shared with them
**Then** they can approve or request changes to agent-generated reports per FR53
**And** the portal displays a hero metric "Zero-Thought Tasks" showing tasks that left the client's mind per UX-DR36
**And** invoices display as value receipts showing what hours bought per UX-DR37
**And** a next-week preview section follows the TV cliffhanger pattern for retention per UX-DR39
**And** a "Message [VA name]" option shows with response time estimate per UX-DR40

### Story 9.3: Stripe Payment Integration & Webhook Processing

As a user,
I want Stripe-integrated payments with reliable webhook processing,
So that online payments are processed securely and exactly once.

**Acceptance Criteria:**

**Given** an invoice with a payment link exists
**When** a client pays via Stripe
**Then** the payment is processed through a Stripe-integrated flow per FR39
**And** the system processes payment and subscription lifecycle events exactly once per event per FR42
**And** Stripe webhook retry uses exponential backoff (1s, 5s, 30s), max 3 retries per NFR46
**And** Stripe webhook processing completes within 5 seconds per NFR05
**And** duplicate invoice submissions for the same client, same line items, and same date range result in a single invoice per FR44

### Story 9.4: Subscription Tiers & Tier Limits

As a workspace owner,
I want to manage my subscription tier with clear limits,
So that I understand what I'm paying for and can scale as needed.

**Acceptance Criteria:**

**Given** a workspace exists
**When** the owner views subscription settings
**Then** they can view and change their tier (Free, Pro, Agency) at any time per FR55
**And** the system enforces tier limits and proactively notifies the user as they approach limits per FR56
**And** subscription changes are prorated on a per-transition basis per FR62
**And** Free tier users are informed of the 5% transaction fee on Stripe payments at invoice creation per FR61
**And** the `app_config` table drives tier limits and feature flags (data, not code) per architecture requirements

### Story 9.5: Subscription Lifecycle & Downgrade Handling

As a workspace owner,
I want graceful subscription lifecycle management,
So that my data is preserved and agents behave appropriately during transitions.

**Acceptance Criteria:**

**Given** a subscription state transition occurs
**When** the transition processes
**Then** lifecycle follows: Active → Past Due (7-day grace) → Suspended (read-only, 30 days) → Deleted per FR59
**And** when entering Past Due/Suspended, scheduled agent jobs are paused; agents resume on reactivation per FR60
**And** when a user downgrades, existing data is preserved read-only for clients exceeding the new tier limit per FR57
**And** workspace owner can manage payment methods and view billing history per FR58

### Story 9.6: Recurring Invoices

As a user,
I want to create recurring invoices that auto-generate on schedule,
So that retainer-based clients are billed automatically.

**Acceptance Criteria:**

**Given** a retainer agreement exists for a client
**When** the user sets up a recurring invoice
**Then** invoices auto-generate on a defined schedule per FR37
**And** generated invoices follow the same creation rules as manual invoices (status lifecycle, line items)
**And** recurring invoice generation is paused when subscription enters Past Due/Suspended state per FR60

### Story 9.7: Billing Accuracy & Usage Visibility

As a workspace owner,
I want real-time usage visibility and billing accuracy,
So that I can trust my billing data.

**Acceptance Criteria:**

**Given** a workspace has active subscriptions
**When** the owner views billing
**Then** usage metering accuracy is ≥99.9% with Stripe billing reflecting actual usage within 1-hour reconciliation window per NFR54
**And** real-time usage visibility is available for workspace owners per NFR55
**And** a dispute window of 30 days for billing discrepancies is enforced per NFR56

## Epic 10: Onboarding, Polish & Launch Readiness

Setup wizard to first real action in first session, working-style preference → initial trust levels, onboarding checklist with progress, agent activation/deactivation, demo action within 30 seconds, in-app notifications, notification preferences, agent failure alerts, error handling & recovery (agent partial state, magic link expiry, soft/hard delete), data export (CSV/JSON), GDPR-compliant deletion (PII 30-day, financial 7-year), audit trail with hash-chain, agent-human concurrent conflict detection, workspace deletion with recovery, idempotent writes, context-shift detection, proactive transparency on return, agency owner actions layer.

### Story 10.1: Setup Wizard & First-Session Experience

As a new user,
I want a setup wizard that gets me to my first real action in the first session,
So that I experience value immediately.

**Acceptance Criteria:**

**Given** a new user completes workspace creation
**When** they enter the setup wizard
**Then** they are guided to their first real action within the first session per FR69
**And** upon activating their first agent, the user sees a demo action within 30 seconds per FR70
**And** the wizard includes a working-style preference question that sets initial trust levels per FR71
**And** the system provides an onboarding checklist with progress tracking per FR73
**And** new user completes signup to first agent task execution within 5 minutes per NFR51

### Story 10.2: Agent Activation Management Post-Setup

As a user,
I want to activate or deactivate individual agents after initial setup,
So that I can customize which agents work for me over time.

**Acceptance Criteria:**

**Given** onboarding is complete
**When** the user navigates to agent settings
**Then** they can activate or deactivate individual agents at any time per FR72
**And** deactivation follows the graceful in-flight task handling from Epic 2
**And** onboarding abandonment is detected with re-engagement prompt at 24 hours per NFR52

### Story 10.3: In-App Notifications & Preferences

As a user,
I want configurable in-app notifications,
So that I'm alerted to important events without being overwhelmed.

**Acceptance Criteria:**

**Given** a user is in their workspace
**When** relevant events occur
**Then** they receive in-app notifications for agent actions requiring approval, trust level changes, and payment events per FR79
**And** they can configure notification preferences by type and channel per FR80
**And** they are alerted when an agent action fails or produces unexpected output per FR81
**And** notification delivery uses at-least-once semantics with deduplication per NFR22

### Story 10.4: Error Handling & Agent Recovery

As a user,
I want graceful error handling and recovery paths,
So that failures don't leave me stuck or lose data.

**Acceptance Criteria:**

**Given** an agent encounters an error during execution
**When** the error occurs
**Then** the system preserves partial state, notifies the user, and offers a retry or manual-completion path per FR84
**Given** a magic link expires
**When** the user clicks the expired link
**Then** the system provides a message and a one-click resend option per FR85
**And** the system distinguishes between soft delete (recoverable within 30 days) and hard delete (permanent, for PII compliance) per FR87

### Story 10.5: Data Export, Audit Trail & GDPR Compliance

As a workspace owner,
I want data export, audit trails, and GDPR-compliant deletion,
So that I control my data and meet regulatory requirements.

**Acceptance Criteria:**

**Given** a workspace owner requests data management
**When** they initiate an export
**Then** they can export all workspace data in portable formats (CSV, JSON) within 24 hours per FR88 and NFR31
**And** all data mutations are recorded in an audit trail with hash-chain integrity verification per FR90
**And** workspace owner can request full data deletion in compliance with GDPR, with tiered retention: PII 30 days, financial records 7 years, audit trail preserved with PII tokens per FR89 and NFR32
**And** audit log retention follows tier limits: Free 30 days, Pro 90 days, Agency 1 year per NFR33
**And** when a workspace is voluntarily deleted, the owner is presented with a data export option and 30-day recovery window per FR92

### Story 10.6: Concurrency Safety & Idempotency

As a user,
I want the system to handle concurrent agent-human actions safely,
So that human intent always takes priority.

**Acceptance Criteria:**

**Given** an agent and a human act on the same entity concurrently
**When** the conflict is detected
**Then** the system detects the conflict and human intent always takes priority per FR95
**And** all system write operations employ idempotency mechanisms per FR96

### Story 10.7: Observability & Health Monitoring

As a system operator,
I want comprehensive observability and health monitoring,
So that I can detect and respond to issues proactively.

**Acceptance Criteria:**

**Given** the system is running
**When** monitoring is active
**Then** critical alerts surface within 2 minutes; warning alerts within 15 minutes per NFR28
**And** API error rate stays below 1% rolling 1-hour; agent failure rate below 3% rolling 1-hour per NFR29
**And** synthetic health checks run every 5 minutes against critical user paths per NFR30
**And** daily database backups with PITR available for previous 7 days per NFR19
**And** daily LLM spend alert when total platform cost exceeds 120% of 7-day rolling average per NFR40

### Story 10.8: Context-Shift Detection & Proactive Transparency

As a user,
I want the system to adapt when I've been away and surface what mattered,
So that returning to the platform feels seamless and informative.

**Acceptance Criteria:**

**Given** a user has been absent for an extended period
**When** they return
**Then** context-shift detection offers to reduce auto-handling after extended absence per UX-DR28
**And** proactive transparency surfaces what mattered since last check-in, ranked by importance per UX-DR29
**And** time-based `last_seen_at` is tracked to enable these features
**And** the Anti-Hover guarantee ensures no escalation during absence per UX-DR42
**And** a Pause Mode is available where agents hold the fort and user returns to Summary Mode per UX-DR44
**And** monthly stick-time audit offers temporary re-densification in Auto mode per UX-DR19

### Story 10.9: Agency Owner Actions Layer

As an agency owner,
I want role-based progressive disclosure of team management actions,
So that I can coach and oversee my team at the right level.

**Acceptance Criteria:**

**Given** an agency owner is managing team members
**When** they access the agency actions layer
**Then** progressive disclosure shows actions: Coach, Elevate, Shadow, Triage-to-VA, Set Precedent per UX-DR30
**And** actions are scoped to the agency owner role only
**And** support response SLA is enforced: Free (community), Pro (24-hour email), Agency (4-hour email + priority) per NFR53
