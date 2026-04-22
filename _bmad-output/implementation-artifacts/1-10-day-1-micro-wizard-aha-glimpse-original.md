# Story 1.10: Day 1 Micro-Wizard & AHA Glimpse

Status: ready-for-dev

## Story

As a new user,
I want a guided first-session experience with a glimpse of agent capability,
so that I understand the platform's value within minutes of signing up.

## Acceptance Criteria

### AC-to-Task Mapping

| AC | Tasks |
|----|-------|
| AC-1 | Task 1, Task 2 |
| AC-2 | Task 3, Task 4 |
| AC-3 | Task 3, Task 4 |
| AC-4 | Task 2, Task 5 |
| AC-5 | Task 3, Task 4 |
| AC-6 | Task 2, Task 5 |
| AC-7 | Task 1, Task 2, Task 3, Task 6 |
| AC-8 | Task 6 |
| AC-9 | Task 6 |
| AC-10 | Task 6 |
| AC-11 | Task 6 |

### Criteria

1. **AC-1: Day 1 Micro-Wizard flow (FR69, UX-DR30)**
   Given a new user completes authentication and workspace creation, when they enter the workspace for the first time, then a Day 1 Micro-Wizard guides them through a brief setup flow. The wizard flow covers: signup complete → create first client → log first time entry → see first agent proposal. Total flow completes in under 5 minutes. Per FR69, UX-DR30.

2. **AC-2: Onboarding progress tracking (FR73)**
   Given the wizard is active, when the user progresses through steps, then an onboarding checklist with progress tracking is visible. Each completed step shows a checkmark. The checklist persists across sessions — if the user abandons, they resume where they left off. Per FR73.

3. **AC-3: Mock agent action demonstrates capability (FR70, UX-DR31)**
   Given the user reaches the agent demo step, when the mock Inbox Agent activates, then a simulated email triage action appears within 30 seconds. The mock action shows: (a) a realistic-looking email from a simulated client, (b) the agent's categorization ("action-needed"), (c) a draft response proposal, (d) the approve/reject keyboard pattern (A/R keys). The mock completes within seconds, demonstrating the approval/reject pattern. Per FR70, UX-DR31.

4. **AC-4: Wizard concludes with CTA**
   Given the user completes the agent demo step, when the wizard finishes, then a call-to-action prompts connecting their first real data source (Gmail inbox). The CTA is the primary button. A secondary "Skip for now" option is available but de-emphasized.

5. **AC-5: Working-style preference questions set initial trust levels (FR71, UX-DR32)**
   Given the wizard is in progress, when the user reaches the preferences step, then 2-3 working-style preference questions are presented. Answers map to initial trust levels stored in the trust matrix (supervised for all new agent-action pairs). Questions cover: communication style preference (hands-on vs. hands-off), review comfort level, and automation enthusiasm. Per FR71, UX-DR32.

6. **AC-6: Initial trust matrix seeded (FR29)**
   Given the user completes the preference questions, when the wizard saves preferences, then the trust matrix is initialized as a sparse `jsonb` structure with all agent-action-type pairs set to `supervised`. Working-style answers bias the matrix but do NOT auto-promote any pair — all start supervised. Per FR29.

7. **AC-7: GuidedFlow — one agent at a time (UX-DR30, UX-DR33, UX-DR34)**
   Given the wizard introduces agents, when the demo runs, then only the Inbox Agent is shown. The workspace is deliberately sparse — no sidebar, no other agents visible. Free tier layout: no sidebar, inbox IS the product. The sidebar activates on second agent (reveal pattern, not paywall). The GuidedFlow component introduces one agent at a time to prevent overwhelm. Per UX-DR30, UX-DR33, UX-DR34.

8. **AC-8: WCAG 2.1 AA accessibility (FR97, NFR41-NFR45)**
   Given the wizard is active, when any interactive element is present, then all elements are keyboard-navigable with visible focus indicators. Focus auto-advances on step transitions. ARIA live regions announce step changes and mock agent actions. Color is never the sole indicator of state or progress (text + icon labels always accompany). Skip-to-content link is available. Per FR97, NFR41-NFR45.

9. **AC-9: ARIA live regions for dynamic content (NFR42, UX-DR47)**
   Given the mock agent action runs, when content updates dynamically, then ARIA live regions announce: agent activation, proposal appearance, approval/rejection result. Screen readers receive descriptive announcements for all state changes. Per NFR42, UX-DR47.

10. **AC-10: Reduced motion support**
    Given a user has `prefers-reduced-motion: reduce` enabled, when the wizard displays animations, then all motion is instant (0ms durations) with opacity-only fallbacks. Trust badge ceremonies use simplified transitions (100ms max). Full functionality preserved.

11. **AC-11: Skeleton loading matching content shape**
    Given the wizard loads a step, when data is being fetched, then skeleton UI matching the content shape displays for a minimum of 300ms. No generic spinners. Per UX loading state patterns.

## Tasks / Subtasks

> **Task dependencies:** Task 1 → Task 2 → Task 3 (parallel with Task 4) → Task 5 → Task 6.

- [ ] Task 1: Onboarding data model and route foundation (AC: #1, #7)
  - [ ] 1.1: Create migration `supabase/migrations/XXXX_create_onboarding_state.sql` — `onboarding_state` table with columns: `id uuid primary key`, `workspace_id uuid references workspaces(id) not null`, `current_step text not null default 'welcome'`, `completed_steps text[] not null default '{}'`, `preferences jsonb not null default '{}'`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. RLS: user can only read/write own workspace's onboarding state. Index on `workspace_id`.
  - [ ] 1.2: Create `apps/web/lib/actions/onboarding/get-onboarding-state.ts` — Server Action returning `ActionResult<OnboardingState | null>`. Reads from `onboarding_state` table filtered by session `workspace_id`.
  - [ ] 1.3: Create `apps/web/lib/actions/onboarding/save-onboarding-step.ts` — Server Action accepting `{ step: OnboardingStep, data?: Record<string, unknown> }`. Upserts `onboarding_state` row. Returns `ActionResult<OnboardingState>`.
  - [ ] 1.4: Create `apps/web/lib/actions/onboarding/complete-onboarding.ts` — Server Action that marks all steps complete and sets `onboarding_completed_at` on the workspace record. Returns `ActionResult<void>`.
  - [ ] 1.5: Create `apps/web/app/(auth)/setup/page.tsx` — Server Component that checks if user has a workspace and if onboarding is incomplete. Renders `SetupWizard` Client Component with initial onboarding state as props. Redirects to workspace dashboard if onboarding is already complete.
  - [ ] 1.6: Create `packages/types/src/onboarding.ts` — Zod schemas and types: `OnboardingStep` enum (`welcome`, `create-client`, `log-time`, `preferences`, `agent-demo`, `complete`), `OnboardingState`, `WorkingStylePreferences`, `OnboardingProgress`.

- [ ] Task 2: Setup wizard multi-step component (AC: #1, #2, #5, #6)
  - [ ] 2.1: Create `packages/ui/src/components/setup-wizard/setup-wizard.tsx` — "use client" component. Multi-step wizard with step navigation. Uses `useReducer` for wizard state machine (`WizardState`: `currentStep`, `stepData`, `isTransitioning`). Each step transition: (a) saves current step via Server Action, (b) advances with 300ms transition animation, (c) auto-advances focus to first interactive element. Progress bar at top showing completed/current/future steps. ≤200 lines.
  - [ ] 2.2: Create `packages/ui/src/components/setup-wizard/progress-bar.tsx` — Step indicator showing: completed (checkmark + label), current (highlighted), upcoming (muted). Uses token colors. Color + text labels (never color alone). Respects `prefers-reduced-motion`. ≤80 lines.
  - [ ] 2.3: Create `packages/ui/src/components/setup-wizard/step-wrapper.tsx` — Wraps each step with enter/exit animations (300ms, cubic-bezier(0.4, 0, 0.2, 1)). Handles focus management: auto-focuses first interactive element on enter. Announces step change via `aria-live="polite"`. ≤80 lines.
  - [ ] 2.4: Create `packages/ui/src/components/setup-wizard/welcome-step.tsx` — Welcome screen with: workspace name confirmation, brief value proposition ("Your inbox shouldn't require a strategy"), "Let's get started" primary CTA. Skeleton loading state for initial data fetch. ≤80 lines.
  - [ ] 2.5: Create `packages/ui/src/components/setup-wizard/create-client-step.tsx` — Quick client creation form: client name (required), contact email (optional). Single-column layout, labels above inputs, smart defaults. Uses `useActionState` for form submission. Inline validation on blur. On success, passes created client to next step. ≤120 lines.
  - [ ] 2.6: Create `packages/ui/src/components/setup-wizard/log-time-step.tsx` — Quick time entry: pre-filled with the client just created, today's date, 30-minute duration, editable notes field ("What did you work on?"). Demonstrates timer concept. Single submit. ≤80 lines.
  - [ ] 2.7: Create `packages/ui/src/components/setup-wizard/preferences-step.tsx` — 2-3 working-style questions rendered as radio button groups: (a) "How do you prefer to review agent suggestions?" → "Review every one / Show me the important ones / Trust the agent", (b) "How comfortable are you with automation?" → "I want full control / Surprise me within bounds / Let the agent handle routine tasks". Answers stored as `WorkingStylePreferences`. Uses `useFormState` pattern. ≤120 lines.
  - [ ] 2.8: Create `packages/ui/src/components/setup-wizard/complete-step.tsx` — CTA screen: "Connect your Gmail inbox to unlock your Inbox Agent" primary CTA. "Skip for now" secondary link. Shows a brief summary of what was set up (client name, time entry, preferences saved). ≤80 lines.

- [ ] Task 3: Mock agent demo (AC: #3, #7)
  - [ ] 3.1: Create `packages/ui/src/components/setup-wizard/agent-demo-step.tsx` — "use client" component. Orchestrates the mock Inbox Agent experience: (1) Agent activation animation (badge appears, thinking pulse), (2) Simulated incoming email appears (from mock client created in step 2.5), (3) Agent categorization badge ("action-needed"), (4) Draft response proposal card, (5) Keyboard triage: A approve / R reject. The entire sequence completes within 30 seconds. Uses staged timeouts for realism. ≤200 lines.
  - [ ] 3.2: Create `packages/ui/src/components/setup-wizard/mock-agent-proposal.tsx` — Simulated AgentProposalCard for the demo. Shows: agent identity color (Inbox blue), email subject line, agent reasoning (collapsed by default, expandable), draft response preview, approve/reject actions with keyboard shortcuts. Optimistic UI on approval (300ms, green flash, item moves to "handled"). Uses existing design tokens. ≤120 lines.
  - [ ] 3.3: Create `packages/ui/src/components/setup-wizard/mock-email-data.ts` — Static mock data for the demo email. Includes: from (mock client), subject, body, agent categorization reasoning, draft response text. Content is realistic and uses the client name from step 2.5. ≤50 lines.
  - [ ] 3.4: Create `packages/ui/src/components/setup-wizard/agent-activation-animation.tsx` — Agent badge entrance animation: fade in + subtle pulse + status ring. Uses `--flow-agent-inbox` color, `--flow-duration-expressive: 300ms`, `cubic-bezier(0.34, 1.56, 0.64, 1)` spring easing for the thinking state. Respects `prefers-reduced-motion`. ≤60 lines.

- [ ] Task 4: Trust initialization from preferences (AC: #5, #6)
  - [ ] 4.1: Create `packages/trust/src/initial-trust.ts` — Pure function `deriveInitialTrustMatrix(preferences: WorkingStylePreferences): TrustMatrix`. Maps preference answers to trust levels. ALL pairs start at `supervised`. The preferences influence the system's suggestion cadence (not the actual trust levels). Returns the full sparse matrix structure (~72 cells per VA, all supervised). ≤80 lines.
  - [ ] 4.2: Create `packages/trust/src/initial-trust.test.ts` — Unit tests: all pairs start supervised regardless of preferences, matrix structure completeness, preference storage in metadata.
  - [ ] 4.3: Create `apps/web/lib/actions/onboarding/seed-trust-matrix.ts` — Server Action accepting `WorkingStylePreferences`. Calls `deriveInitialTrustMatrix()`, persists to workspace's trust_matrix column (jsonb). Validates workspace_id from session. Returns `ActionResult<void>`.

- [ ] Task 5: GuidedFlow and ZeroState components (AC: #7)
  - [ ] 5.1: Create `packages/ui/src/components/guided-flow/guided-flow.tsx` — "use client" component that introduces one agent at a time. Currently only introduces Inbox Agent. Extensible for progressive unlock pattern: `Inbox → first approval → Calendar ready → Calendar appears`. Receives `activeAgents: AgentId[]` and renders appropriate content. ≤80 lines.
  - [ ] 5.2: Create `packages/ui/src/components/guided-flow/zero-state.tsx` — Reusable empty state component: calm icon + one sentence + one action (or reassurance). Props: `icon`, `message`, `actionLabel?`, `onAction?`. Used for: trust dashboard ("Your agents are learning"), inbox ("All clear"), reports ("Your first report arrives Friday"). ≤60 lines.

- [ ] Task 6: Accessibility and quality (AC: #8, #9, #10, #11)
  - [ ] 6.1: Add `aria-live="polite"` region to `StepWrapper` announcing step transitions: "Step 2 of 6: Create your first client".
  - [ ] 6.2: Add `aria-live="polite"` to mock agent demo announcing: agent activation, proposal appearance, approval/rejection result.
  - [ ] 6.3: Verify all wizard steps have logical tab order, visible focus indicators (`:focus-visible` with 2px ring, 3:1 contrast), and focus auto-advance on step transitions.
  - [ ] 6.4: Add `prefers-reduced-motion` support: all animations use `useReducedMotion` hook. Reduced motion → instant transitions (0ms), opacity-only changes.
  - [ ] 6.5: Verify color is never the sole indicator: progress bar uses text labels + icons, agent status uses text + icon + color, form validation uses icon + text (not just red border).
  - [ ] 6.6: Create skeleton components for each wizard step matching content shape. Minimum 300ms display.
  - [ ] 6.7: Skip-to-content link in setup wizard page.

## Dev Notes

### Previous Story Learnings (Story 1.9)

- **Server Action path:** Implementation goes in `apps/web/lib/actions/`, route-level files re-export. Per architecture.md convention.
- **workspace_id injection:** Packages (`shared`, `ui`, `trust`) never access Supabase session. App layer provides workspace_id via React context or Server Actions.
- **Jotai atoms for client state:** All mutable client state uses Jotai atoms. No React Context for state (only for DI like `UndoWorkspaceContext`).
- **ActionResult<T> contract:** `{ success: true; data: T } | { success: false; error: FlowError }`. Discriminated union, `success` is discriminant.
- **Test colocation:** `*.test.ts(x)` next to source files. Integration tests in `__tests__/` at route-group level.
- **File limit:** 200 lines soft, 250 hard. React components ≤80 lines.
- **Animation patterns:** 300ms for macro transitions, cubic-bezier(0.4, 0, 0.2, 1). `useReducedMotion` hook from `packages/ui/src/hooks/use-reduced-motion.ts`.
- **Existing hooks to reuse:** `useReducedMotion`, `useFocusTrap` (from Story 1.8).
- **Existing shortcut infrastructure:** `packages/shared/src/shortcuts/registry.ts`, `input-guard.ts`.

### Architecture Compliance

- **Route location:** `apps/web/app/(auth)/setup/` — wizard runs BEFORE workspace layout (no sidebar, no dark workspace theme). Per [Source: architecture.md#Route Structure].
- **Server Actions for mutations** — wizard step saves, client creation, time entry logging, trust seeding all via Server Actions returning `ActionResult<T>`. Per [Source: architecture.md#Server Actions].
- **RSC + Client split:** `page.tsx` is a Server Component that fetches initial onboarding state. `SetupWizard` and all step components are `"use client"`. Per [Source: docs/project-context.md#Component Boundaries].
- **Jotai for client state:** Wizard step state uses `useReducer` (local, not shared). Onboarding progress could use Jotai atom if other components need to read it (e.g., sidebar progress indicator). Per [Source: architecture.md#State Management].
- **No barrel files inside feature folders** — barrel at `packages/ui/src/components/setup-wizard/index.ts` only.
- **Named exports only** — default exports only for page components (`page.tsx`).
- **revalidateTag() only** — never `revalidatePath()`.
- **workspace_id from session only** — Server Actions derive workspace_id from session, never accept from client input.
- **Supabase client:** `@supabase/ssr` on server, one client per request. Never raw `supabase-js`.
- **Zod for validation** — all Server Action inputs validated with Zod schemas.
- **Money as cents** — not relevant for this story but be aware if time entry amounts appear.

### Key Technical Decisions

**TD-1: Mock agent is client-side simulation, no agent infrastructure.** The agent orchestrator (pg-boss, AgentOrchestrator seam) doesn't exist yet (Epic 2). The mock Inbox Agent is entirely client-side: staged timeouts simulate agent processing, static mock data for the email, optimistic UI for approve/reject. This avoids creating throwaway backend infrastructure. The demo proves the UX pattern, not the agent architecture.

**TD-2: Onboarding state as database table, not localStorage.** Progress must persist across sessions and be accessible from Server Components. A dedicated `onboarding_state` table with RLS provides this. The table is small (one row per workspace) and deleted after onboarding completes (or kept for analytics).

**TD-3: Trust matrix seeded but all supervised.** Working-style preference answers are stored as metadata on the trust matrix, but NO agent-action pair starts above supervised. The preferences influence the system's future suggestion cadence (how aggressively it offers trust promotions). This is a safe default — new users must earn trust through the real system.

**TD-4: Wizard step state via useReducer, not URL params.** The wizard is a linear flow. `useReducer` manages current step, step data, and transition state. URL params (`?step=2`) are NOT used because: (a) the wizard is a one-time flow, (b) deep-linking individual steps is unnecessary, (c) the progress is persisted server-side anyway.

**TD-5: GuidedFlow is a generic component, not wizard-specific.** The `GuidedFlow` component introduces agents one at a time. It's used in the wizard (demo step) but also extensible for the real progressive unlock pattern after onboarding. Free tier: only Inbox. Second agent activation: sidebar reveals with Calendar. This component will grow with Epic 2.

**TD-6: Mock email uses the client created in step 2.5.** The demo is personalized — the mock email comes from the client the user just created. This creates the "miracle moment" described in the UX spec: the agent demonstrates it "understands your business" by referencing the user's actual client.

### Scope Boundaries

**In scope:**
- Multi-step setup wizard with 6 steps
- Mock Inbox Agent demo (client-side simulation)
- Working-style preference questions → trust matrix initialization
- Onboarding progress tracking (persistent)
- GuidedFlow and ZeroState components (reusable)
- Skeleton loading for each step
- Full WCAG 2.1 AA accessibility
- `prefers-reduced-motion` support

**Explicitly out of scope:**
- **Real agent infrastructure** — no pg-boss, no AgentOrchestrator, no LLM calls. Deferred to Epic 2.
- **Real Gmail OAuth flow** — the CTA at the end links to where OAuth will live (Epic 4), but the connection itself is not implemented here.
- **Real email processing** — the demo uses static mock data. No Inbox Agent executor.
- **Agent trust graduation logic** — only the initial supervised matrix is seeded. Graduation logic deferred to Story 2.3.
- **Sidebar progressive unlock** — the wizard runs in `(auth)/setup/` route (no sidebar). The free-tier sidebar logic is part of the workspace layout (Story 1.6) and will be updated when Epic 2 introduces real agents.
- **Abandonment detection (NFR52)** — deferred to Story 10.1 which handles the full setup wizard experience including re-engagement.
- **Demo action within 30 seconds of REAL agent activation (FR70)** — this story implements the mock demo. The real 30-second target for actual agent activation is Story 10.1.
- **Notification system** — no real notifications in the demo. Notification infrastructure deferred to Story 10.3.
- **Onboarding analytics tracking** — deferred to Story 10.1 (full setup wizard analytics).

### File Structure

```
packages/types/src/
  onboarding.ts                           # OnboardingStep, OnboardingState, WorkingStylePreferences schemas + types

packages/trust/src/
  initial-trust.ts                        # deriveInitialTrustMatrix() pure function
  initial-trust.test.ts                   # Unit tests

packages/ui/src/components/
  setup-wizard/
    setup-wizard.tsx                      # "use client" — multi-step orchestrator
    setup-wizard.test.tsx
    progress-bar.tsx                      # Step indicator with text labels
    progress-bar.test.tsx
    step-wrapper.tsx                      # Animation + focus management + ARIA
    step-wrapper.test.tsx
    welcome-step.tsx                      # Step 1: Welcome
    create-client-step.tsx                # Step 2: Quick client creation
    create-client-step.test.tsx
    log-time-step.tsx                     # Step 3: Quick time entry
    log-time-step.test.tsx
    preferences-step.tsx                  # Step 4: Working-style questions
    preferences-step.test.tsx
    agent-demo-step.tsx                   # Step 5: Mock Inbox Agent demo
    agent-demo-step.test.tsx
    mock-agent-proposal.tsx               # Simulated proposal card
    mock-agent-proposal.test.tsx
    mock-email-data.ts                    # Static mock data
    agent-activation-animation.tsx        # Badge entrance animation
    agent-activation-animation.test.tsx
    complete-step.tsx                     # Step 6: CTA + summary
    complete-step.test.tsx
    index.ts                              # Barrel (package boundary only)
  guided-flow/
    guided-flow.tsx                       # One-agent-at-a-time introducer
    guided-flow.test.tsx
    zero-state.tsx                        # Calm icon + sentence + action
    zero-state.test.tsx
    index.ts

apps/web/lib/actions/onboarding/
  get-onboarding-state.ts                 # Read onboarding progress
  get-onboarding-state.test.ts
  save-onboarding-step.ts                 # Save step progress
  save-onboarding-step.test.ts
  complete-onboarding.ts                  # Mark onboarding complete
  complete-onboarding.test.ts
  seed-trust-matrix.ts                    # Initialize trust from preferences
  seed-trust-matrix.test.ts

apps/web/app/(auth)/setup/
  page.tsx                                # Server Component — gate + render wizard
  layout.tsx                              # Setup layout (no sidebar, centered)
  loading.tsx                             # Skeleton matching wizard shape
  actions.ts                              # Re-exports from lib/actions/onboarding/

supabase/migrations/
  XXXX_create_onboarding_state.sql        # onboarding_state table + RLS
```

### Testing Requirements

Per [Source: architecture.md#Testing Patterns] and [Source: docs/project-context.md#Testing]:

**Unit tests (co-located):**
- `setup-wizard.test.tsx` — step transitions, progress tracking, back navigation, skip functionality
- `progress-bar.test.tsx` — completed/current/upcoming rendering, text labels present
- `step-wrapper.test.tsx` — focus management, ARIA announcements, animation class application
- `create-client-step.test.tsx` — form validation, submission, error handling
- `preferences-step.test.tsx` — radio selection, answer storage, form state
- `agent-demo-step.test.tsx` — mock sequence timing, approve/reject keyboard handling, optimistic UI
- `mock-agent-proposal.test.tsx` — proposal rendering, keyboard shortcuts (A/R), reasoning expand
- `agent-activation-animation.test.tsx` — animation states, reduced motion fallback
- `complete-step.test.tsx` — CTA rendering, skip option
- `guided-flow.test.tsx` — agent introduction logic, progressive pattern
- `zero-state.test.tsx` — icon + message + action rendering
- `initial-trust.test.ts` — matrix structure, all-supervised default, preference storage

**Integration tests:**
- `get-onboarding-state.test.ts` — read with RLS, null for completed workspace
- `save-onboarding-step.test.ts` — upsert, workspace_id from session only, step validation
- `complete-onboarding.test.ts` — marks workspace, cleanup
- `seed-trust-matrix.test.ts` — matrix seeded, all supervised, preferences stored

**E2E (Playwright, critical path):**
- Full wizard flow: welcome → create client → log time → preferences → agent demo → complete
- Wizard resume after page reload (persistence test)
- Keyboard-only navigation through entire wizard
- Mock agent approval via keyboard (A key)
- Screen reader announcements for step changes (ARIA verification)

**Accessibility tests:**
- Tab order through each step is logical
- Focus auto-advances on step transition
- `aria-live` announces step changes and agent actions
- Color never sole indicator (text + icon present)
- `:focus-visible` ring visible on all interactive elements
- `prefers-reduced-motion` disables animations

### Emotional Design Notes

Per [Source: ux-design-specification.md#Emotional Design]:

The wizard targets the **"Wonder"** emotion of Day 1. Key design principles:

1. **90 seconds to convert skepticism into belief.** The mock agent demo is the "miracle moment" — the user sees something actually get done for them. The proposal references their real client. The language matches their stated preference.

2. **"Design the exhale, not the click."** After the agent demo approval, the user should feel relief: "Handled. You're welcome." The approval should feel like exhaling, not processing.

3. **No blank-page paralysis.** Every step has content and guidance. The welcome step has a value proposition. The empty states have reassurance. Opinionated defaults over flexibility.

4. **Agent as teammate, not tool.** The mock Inbox Agent uses warm tone: "I noticed an email from [Client Name]" — not "Processing email..." The VA's name is bigger than the agent's.

5. **Slow reading is healthy.** The demo doesn't rush. The user can take their time reading the proposal. This is not friction — it IS the trust-building process.

6. **Professional celebration.** After approval: subtle acknowledgment animation (not confetti). "Nice call. Inbox Agent will learn from this."

### Project Structure Notes

- Setup wizard lives in `(auth)/setup/` route group — this is BEFORE workspace layout. No sidebar, no dark workspace theme. The wizard has its own centered layout.
- Server Actions implementation in `lib/actions/onboarding/` per architecture convention. Route-level `actions.ts` re-exports.
- `packages/trust/src/initial-trust.ts` is a pure function — no Supabase dependency. The Server Action calls it and persists the result.
- `mock-email-data.ts` uses the client name from the previous step via React props (not API call).

### References

- [Source: epics.md#Story 1.10] — Story definition and acceptance criteria
- [Source: prd.md#FR69-FR73] — Onboarding functional requirements
- [Source: prd.md#NFR51-NFR53] — Onboarding NFRs (5 min, abandonment detection, SLA)
- [Source: architecture.md#Route Structure] — `(auth)/setup/` route group
- [Source: architecture.md#Server Actions] — `lib/actions/` convention
- [Source: architecture.md#State Management] — Jotai atoms, useReducer for local state
- [Source: architecture.md#Agent Orchestration] — AgentOrchestrator seam (for future real agents)
- [Source: architecture.md#Agent Signal Schema] — Signal structure (for future integration)
- [Source: architecture.md#Testing] — Testing patterns, mock boundaries
- [Source: architecture.md#Component Strategy] — RSC by default, "use client" when needed
- [Source: architecture.md#Package Structure] — packages/trust, packages/ui, packages/types
- [Source: ux-design-specification.md#GuidedFlow + ZeroState] — Onboarding component pattern
- [Source: ux-design-specification.md#Empty State Patterns] — Zero state design
- [Source: ux-design-specification.md#Critical Success Moments] — Day 1 emotional arc
- [Source: ux-design-specification.md#Motion Language] — Duration and easing tokens
- [Source: ux-design-specification.md#Trust Progression UI] — Trust density and badges
- [Source: ux-design-specification.md#Free Tier Layout] — No sidebar, inbox IS the product
- [Source: ux-design-specification.md#Agent Visual Language] — Agent identity colors
- [Source: docs/project-context.md] — 180 rules including strict TS, component limits, testing
- [Source: _bmad-output/implementation-artifacts/1-9-undo-conflict-resolution.md] — Previous story patterns, hooks, atoms

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
