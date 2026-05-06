# Story 4.3: Morning Brief Generation

Status: Ready for Review

## Story

As a user,
I want a daily Morning Brief summarizing overnight email activity across all my connected client inboxes,
So that I start each day knowing exactly what needs my attention.

## Acceptance Criteria

1. **AC1 — Scheduled Generation (FR28c):** The system must generate a Morning Brief daily at a configurable time (default 6:00 AM workspace-local) using **Trigger.dev** as the scheduling engine. The job must enumerate all active workspaces and generate one brief per workspace. Schedule configuration is stored in `morning_brief_settings` table (default 6:00 AM UTC if no override). Phase 1: hardcoded 6:00 AM UTC; configurable time is deferred to 4-3b.
2. **AC2 — Generation Performance (NFR07c):** Morning Brief generation must complete within 10 seconds per workspace (P95) for standard overnight volume (baseline: 5 connected client inboxes, ~200 emails). Performance is measured from Trigger.dev handler invocation to DB persist + signal emission. Use pre-computed category labels (not raw `body_clean`) for LLM input.
3. **AC3 — "Inhale before exhale" Pattern (UX-DR6):** The brief output schema must place `summaryLine` as the first field. The LLM returns structured JSON where the summary sentence precedes all item arrays. Prompt template enforces: one summary sentence → handled items → needs-attention items.
4. **AC4 — Habit Anchor & Prioritization (UX-DR41):** The brief must clearly separate "already handled" items (auto-categorized as info/noise) from "needs attention" items (urgent/action-needed). "Already handled" array MUST appear before "needs attention" array in the JSON schema and rendered output. Each handled item shows what action was taken (e.g., "Categorized as info" or "Auto-archived").
5. **AC5 — Reassurance Design (UX-DR15):** Two distinct empty states: (a) no inboxes connected → onboarding nudge "Connect an inbox to get your first Morning Brief", (b) all caught up → "All clear — your agents handled everything overnight" with `last_checked_at` timestamp.
6. **AC6 — Orchestrated Inbox Surface (UX-DR10):** The Morning Brief must be surfaced as an interactive workflow panel at the top of the Dashboard (`apps/web/app/(workspace)/dashboard/page.tsx`). Items must be actionable: dismiss, open thread, view details. The brief is not a static card — it is a workflow entry point.
7. **AC7 — Persistence & Signal (Architecture):** Brief is stored in `morning_briefs` table (workspace-scoped, NOT client-scoped). One brief per workspace per day. `morning_brief.generated` signal emitted on success, `morning_brief.generation_failed` on failure. Brief history retained for 30 days. Visual indicator distinguishes unread (new) vs. read briefs.
8. **AC8 — Thread Summaries (FR28c):** When a thread has >3 emails, the brief must include a one-sentence thread summary (e.g., "3 emails from Acme Corp about Project Phoenix timeline"). This is a FR28c hard requirement — the brief must contain thread-level detail, not just category counts.
9. **AC9 — Idempotency:** `(workspace_id, brief_date)` is a unique constraint on `morning_briefs`. Duplicate Trigger.dev invocations for the same workspace/date must upsert (update existing) rather than create duplicates. Uses `id`-based idempotency key.
10. **AC10 — Error State (NFR07c fallback):** If LLM call fails (timeout, malformed response, API error), the system persists a brief with `generation_status: 'failed'` and `error_message`. Dashboard renders "Technical issue generating today's brief — retrying shortly." Signal `morning_brief.generation_failed` is emitted with error details.
11. **AC11 — Multi-client Isolation (NFR16a):** Context assembly enforces `ContextBoundary` — each client's emails are assembled separately, then aggregated. Zero cross-client context leakage in the LLM prompt. Verified by test with multi-client workspace.
12. **AC12 — Telemetry (PRD Metrics):** Instrument: `brief.generated` (timestamp), `brief.viewed` (first render on Dashboard), `brief.interaction_complete` (last action on brief). These enable tracking signup-to-first-brief (<48h), daily engagement (day 14), and review time (<5min). Events stored in existing `signals` table.

## Developer Context

### Group A: Type System & Schema Updates

- [x] Task 1: Extend Type System
  - [x] 1.1 In `packages/agents/inbox/schemas.ts`, add `MorningBriefActionInput` interface:
    ```typescript
    export interface MorningBriefActionInput {
      workspaceId: string;
      signalId: string;
      actionType: 'morning_brief_generation';
      triggerEventId?: string;
    }
    ```
  - [x] 1.2 Update `InboxActionInput` discriminated union:
    ```typescript
    export type InboxActionInput =
      | EmailProcessingInput
      | EmailCategorizationInput
      | MorningBriefActionInput;
    ```
  - [x] 1.3 Add `MorningBriefProposal` interface (distinct from `InboxProposal`):
    ```typescript
    export interface MorningBriefProposal {
      summaryLine: string;
      handledItems: HandledItem[];
      needsAttentionItems: NeedsAttentionItem[];
      threadSummaries: ThreadSummary[];
      reassuranceMessage?: string;
      clientBreakdown: ClientBreakdown[];
    }
    ```
  - [x] 1.4 Add `HandledItem`, `NeedsAttentionItem`, `ThreadSummary`, `ClientBreakdown` types.
  - [x] 1.5 Export Zod schemas for all new types using `z.object()`.

### Group B: Trigger.dev Scheduled Job

- [x] Task 2: Setup Trigger.dev Infrastructure
  - [x] 2.1 Install `@trigger.dev/sdk` if not already present.
  - [x] 2.2 Create `packages/agents/inbox/jobs/morning-brief.ts` as a scheduled task.
  - [x] 2.3 Job handler: enumerate all active workspaces via `supabase.from('workspaces').select('id')` using `service_role`.
  - [x] 2.4 For each workspace, call `generateMorningBrief(workspaceId)`.
  - [x] 2.5 Configure cron: `0 6 * * *` (6:00 AM UTC default). Phase 1 hardcoded; workspace overrides deferred.
  - [x] 2.6 Set Trigger.dev timeout to 30 seconds per workspace (SLA is 10s but allow margin).

### Group C: Context Assembly (Multi-client Aggregation)

- [x] Task 3: Implement Context Assembler
  - [x] 3.1 Create `packages/agents/inbox/brief-context.ts` (NEW file — do NOT bloat executor.ts).
  - [x] 3.2 Implement `getMorningBriefContext(workspaceId: string, since: Date)`:
    - Query `emails` table for items since `since`, filtered by `workspace_id`, grouped by `client_id` then `category`.
    - Compute `since` as: `COALESCE(last_successful_brief.generated_at, now() - interval '24 hours')`.
    - Query `email_categorizations` for auto-handled items (category: info, noise).
    - Query `signals` where `agent_id = 'inbox'` AND `signal_type IN ('email.received', 'email.client_urgent')` since `since`.
    - Identify threads with >3 emails for thread summarization (AC8).
  - [x] 3.3 Assemble per-client context maps, then aggregate into workspace-level summary.
  - [x] 3.4 Use only pre-computed data: `{category, subject, sender, confidence}` per email. DO NOT pull `body_clean` or raw bodies into context.
  - [x] 3.5 Implement empty state detection: (a) no connected inboxes, (b) no emails, (c) all handled.

### Group D: AI Generation Engine

- [x] Task 4: Develop Morning Brief Prompt & Schema
  - [x] 4.1 Create `packages/agents/inbox/brief-generator.ts` using Vercel AI SDK.
  - [x] 4.2 Provider: **Groq** (fast, <3s) as primary for scheduled background task. Anthropic as fallback if Groq fails. Configure via `llm-router`.
  - [x] 4.3 Define Zod output schema matching `MorningBriefProposal`:
    ```typescript
    const morningBriefOutputSchema = z.object({
      summaryLine: z.string(),
      handledItems: z.array(z.object({
        emailId: z.string().uuid(),
        subject: z.string(),
        sender: z.string(),
        actionTaken: z.string(),
        clientName: z.string(),
      })),
      needsAttentionItems: z.array(z.object({
        emailId: z.string().uuid(),
        subject: z.string(),
        sender: z.string(),
        category: z.enum(['urgent', 'action']),
        reason: z.string(),
        clientName: z.string(),
      })),
      threadSummaries: z.array(z.object({
        threadKey: z.string(),
        emailCount: z.number(),
        summary: z.string(),
        clientName: z.string(),
      })),
      reassuranceMessage: z.string().optional(),
      clientBreakdown: z.array(z.object({
        clientId: z.string().uuid(),
        clientName: z.string(),
        totalEmails: z.number(),
        urgentCount: z.number(),
        actionCount: z.number(),
        handledCount: z.number(),
      })),
    });
    ```
  - [x] 4.4 System prompt enforces: (a) summary sentence first, (b) handled before needs-attention, (c) thread summaries for threads >3, (d) per-client breakdown, (e) reassurance for empty states.
  - [x] 4.5 Enforce `ContextBoundary`: build prompt with client-grouped sections, never mix client data in same prompt section.
  - [x] 4.6 LLM call wrapped in try/catch with 8-second timeout. On failure: return error state (AC10).
  - [x] 4.7 Zod parse failure: retry once with same context. Second failure: persist error brief.

### Group E: Data Layer & Persistence

- [x] Task 5: Database Schema (Migration)
  - [x] 5.1 Create migration for `morning_briefs` table:
    ```sql
    CREATE TABLE morning_briefs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      brief_date date NOT NULL DEFAULT CURRENT_DATE,
      content jsonb NOT NULL,
      generation_status text NOT NULL DEFAULT 'pending'
        CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
      error_message text,
      email_count_handled integer NOT NULL DEFAULT 0,
      email_count_attention integer NOT NULL DEFAULT 0,
      generated_at timestamptz NOT NULL DEFAULT now(),
      viewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (workspace_id, brief_date)
    );
    CREATE INDEX idx_morning_briefs_workspace_date ON morning_briefs(workspace_id, brief_date DESC);
    CREATE INDEX idx_morning_briefs_workspace_generated ON morning_briefs(workspace_id, generated_at DESC);
    ```
  - [x] 5.2 Create RLS policy: workspace members can read their own workspace's briefs. Service role has full access.
  - [x] 5.3 Create Drizzle schema: `packages/db/schema/morning-briefs.ts` with matching table definition, export from barrel.

- [x] Task 6: Save & Signal
  - [x] 6.1 Implement `saveMorningBrief` in `packages/db/src/queries/inbox/briefs.ts` using upsert on `(workspace_id, brief_date)`.
  - [x] 6.2 Emit `morning_brief.generated` signal with payload: `{ brief_id, workspace_id, urgent_count, action_count, handled_count, client_count }`.
  - [x] 6.3 On failure, emit `morning_brief.generation_failed` with payload: `{ workspace_id, error_message, error_type }`.

### Group F: Executor Integration

- [x] Task 7: Wire into Executor
  - [x] 7.1 In `packages/agents/inbox/executor.ts`, add dispatch branch for `actionType === 'morning_brief_generation'` that calls `generateMorningBrief(input.workspaceId)`.
  - [x] 7.2 Create thin wrapper `generateMorningBrief(workspaceId)` in `packages/agents/inbox/index.ts` that orchestrates: context assembly → LLM generation → persist → signal.
  - [x] 7.3 Ensure executor.ts remains under 200-line limit. Brief generation logic lives in `brief-generator.ts` and `brief-context.ts`.

### Group G: UI Integration (Dashboard)

- [x] Task 8: Morning Brief Component
  - [x] 8.1 Create `apps/web/components/dashboard/MorningBrief.tsx` (Server Component).
  - [x] 8.2 Query `morning_briefs` for today's brief, filtered by `workspace_id` via RLS.
  - [x] 8.3 Render structure: summary line → handled section (gold accent divider, `UX-DR27`) → needs-attention section.
  - [x] 8.4 Handled items: collapsed green items, expandable to show action taken.
  - [x] 8.5 Needs-attention items: actionable — dismiss, open thread link, view email detail.
  - [x] 8.6 Empty states: (a) no inboxes → onboarding nudge, (b) all clear → reassurance with timestamp.
  - [x] 8.7 Error state: "Technical issue generating today's brief" with retry indication.
  - [x] 8.8 Unread indicator: bold header if `viewed_at IS NULL`.
- [x] Task 9: Surface in Dashboard
  - [x] 9.1 Integrate `MorningBrief` into `apps/web/app/(workspace)/dashboard/page.tsx` as the top-most element.
  - [x] 9.2 Skeleton loading state matches the brief structure (summary + 2 sections).
  - [x] 9.3 On brief view, update `viewed_at` via Server Action (marks as read).

### Group H: Testing

- [x] Task 10: Unit Tests — Context Assembly
  - [x] 10.1 `packages/agents/inbox/__tests__/brief-context.test.ts`:
    - Verify multi-client aggregation (3 clients, each with different email counts).
    - Verify `since` computation: first run (24h lookback), subsequent run (since last brief).
    - Verify empty state detection: no inboxes, no emails, all handled.
    - Verify thread detection: emails grouped by subject/thread with >3 count.
    - Verify cross-client isolation: Client A's emails don't appear in Client B's context map.
    - Verify query uses pre-computed data only (no `body_clean` access).

- [x] Task 11: Unit Tests — Brief Generator
  - [x] 11.1 `packages/agents/inbox/__tests__/brief-generator.test.ts`:
    - Mock Vercel AI SDK `generateText` to return valid structured JSON → verify Zod parse success.
    - Mock malformed JSON response → verify retry + fallback error state.
    - Mock non-JSON response → verify error state.
    - Mock empty response → verify error state.
    - Mock timeout (>8s) → verify error state.
    - Verify output schema: `handledItems` array appears before `needsAttentionItems` in JSON.
    - Verify summary line is non-empty string.
    - Verify thread summaries present when threads >3 emails.
    - Verify `ContextBoundary`: prompt content is grouped by client, no cross-client mixing.

- [x] Task 12: Unit Tests — Persistence
  - [x] 12.1 `packages/db/src/queries/inbox/__tests__/briefs.test.ts`:
    - Verify upsert: insert first brief, then upsert same date → one row updated.
    - Verify idempotency: two saves for same `(workspace_id, brief_date)` → single row.
    - Verify signal emission on success: `morning_brief.generated` with correct payload.
    - Verify signal emission on failure: `morning_brief.generation_failed` with error details.

- [x] Task 13: RLS Test
  - [x] 13.1 `supabase/tests/morning-briefs-rls.sql`:
    - Workspace A user can read Workspace A's briefs.
    - Workspace A user CANNOT read Workspace B's briefs.
    - Verify `::text` cast on `workspace_id` comparisons.

- [x] Task 14: Latency Test
  - [x] 14.1 `packages/agents/inbox/__tests__/brief-latency.test.ts`:
    - Mock LLM with 3-second delayed response (realistic).
    - Measure full pipeline: context assembly + generation + persist.
    - Assert `duration < 10000ms` for 5-client, 200-email scenario.

- [x] Task 15: ATDD Verification
  - [x] 15.1 `apps/web/__tests__/acceptance/morning-brief.test.ts`:
    - Simulate Trigger.dev handler invocation with workspace ID.
    - Verify: morning_brief row created with `generation_status = 'completed'`.
    - Verify: signal emitted with correct payload.
    - Verify: Dashboard renders brief content.
    - Verify: duplicate invocation → upsert, one row.
    - Verify: LLM failure → `generation_status = 'failed'`, error signal emitted.

## Technical Requirements & Guardrails

- **LLM Routing:** Groq primary (fast, <3s) for scheduled background tasks. Anthropic fallback. Via `llm-router`.
- **RLS Compliance:** Every user-facing query filters by `workspace_id` using `::text` cast. Service role used only for scheduled job execution.
- **Latency:** Use pre-computed `email_categorizations` data (category, subject, sender). NEVER pull `body_clean` or raw bodies into brief generation. <10s per workspace at P95.
- **Error Handling:** LLM failure → persist error brief + emit failure signal. Dashboard shows error state. Job retries via Trigger.dev (max 2 retries, 30s backoff).
- **Empty States:** Two distinct states (AC5): no-inbox nudge vs. all-clear reassurance.
- **Idempotency:** UNIQUE constraint on `(workspace_id, brief_date)`. Upsert pattern prevents duplicates.
- **Isolation:** `ContextBoundary` enforced: per-client context assembly, zero cross-client leakage in LLM prompts.
- **File Size:** executor.ts stays under 200 lines. Brief logic in `brief-generator.ts` and `brief-context.ts`.
- **Naming:** Job names follow `agent:inbox:morning-brief` convention.

## Previous Story Intelligence (4.2)

- **Sanitized Data:** Story 4.2 stores categories in `email_categorizations` table with `category`, `confidence`, `is_corrected`. Morning brief queries this table, NOT raw `body_clean`.
- **Signals:** 4.2 emitted `email.received` and `email.client_urgent`. 4.3 queries signal records since last brief for "handled" aggregation.
- **Isolation:** Continue using `ContextBoundary` pattern from 4.2.
- **Executor Pattern:** executor.ts uses discriminated union dispatch on `actionType`. Add `morning_brief_generation` branch.

## Deferred to Story 4-3b

The following items are explicitly deferred to a follow-up story to keep scope manageable:
- Configurable brief time (per-workspace override of 6:00 AM default)
- Calendar Agent preview integration (FR28o) — requires Calendar Agent signal contract
- Push notification on brief generation
- Manual brief refresh / regeneration
- Multi-VA workspace brief scoping (per-VA filtered briefs)
- First-brief special experience (onboarding framing)
- Brief delta view (changes since yesterday)

## Git Intelligence Summary

- Recent work established the `executor.ts` pattern and pg-boss job types for categorization.
- Naming conventions use `agent:{agent_name}:{action}` for jobs.
- `packages/agents/inbox/` contains: `__tests__/`, `categorizer.ts`, `cleanup.ts`, `executor.ts`, `history-worker.ts`, `index.ts`, `initial-sync.ts`, `pre-check.ts`, `sanitizer.ts`, `schemas.ts`.

## Project Context Reference

- Refer to `docs/project-context.md` for Next.js 15, React 19, and Supabase RLS rules.
- Trigger.dev is the ONLY authorized scheduler for this task. Route handler at `/api/webhooks/trigger-dev`.
- 200-line file soft limit, 250 hard. Functions ≤50 lines logic, ≤80 lines components.
- Named exports only. Server Components by default.
- No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- Money is integers in cents. RLS is the security perimeter.

### Review Findings

**Decisions Resolved:**
- [x] [Review][Patch] D1 — Create Trigger.dev scheduled job (AC1)
- [x] [Review][Patch] D2 — Wire up Open/Dismiss buttons with server actions (AC6)
- [x] [Review][Patch] D3 — Use ContextBoundary for multi-client isolation, extend for aggregation (AC11)
- [x] [Review][Patch] D4 — Switch briefs.ts to use snake_case keys matching raw Supabase pattern (absorbs P1)

**Patches Applied:**
- [x] [Review][Patch] P2 — Handle null client_id in brief-context.ts [brief-context.ts:72]
- [x] [Review][Patch] P3 — Add telemetry signals (brief.viewed, brief.interaction_complete) [morning-brief-tracker.tsx]
- [x] [Review][Patch] P4 — Restrict UPDATE RLS to viewed_at only [migration:49-70]
- [x] [Review][Patch] P5 — Clear LLM timeout timer + AbortController [brief-generator.ts:70-73]
- [x] [Review][Patch] P6 — Fix hasInboxes to query client_inboxes [brief-context.ts:151-156]
- [x] [Review][Patch] P7 — Replace string matching with explicit isFallback flag [index.ts:22]
- [x] [Review][Patch] P8 — Wrap insertSignal in try-catch in briefs.ts [briefs.ts:44-58]
- [x] [Review][Patch] P9 — Strip markdown fences before JSON.parse [brief-generator.ts:76]
- [x] [Review][Patch] P10 — Handle uncategorized emails [brief-context.ts:94-112]
- [x] [Review][Patch] P11 — Order email_categorizations by confidence [brief-context.ts:41-44]
- [x] [Review][Patch] P12 — Add error handling for lastBrief query [brief-context.ts:17-23]
- [x] [Review][Patch] P13 — Validate briefId as UUID [actions/morning-brief.ts:10]
- [x] [Review][Patch] P14 — Add .strict() to morningBriefOutputSchema [schemas.ts:93-130]
- [x] [Review][Patch] P15 — Add summaryLine .min(1) [schemas.ts:94]
- [x] [Review][Patch] P16 — Pass briefDate explicitly to saveMorningBrief [index.ts:17-24]
- [x] [Review][Patch] P17 — Emit correct signal type for failed briefs [briefs.ts:30]
- [x] [Review][Patch] P18 — Add LIMIT to email/signal queries [brief-context.ts:32-36]
- [x] [Review][Patch] P19 — Early return for empty context [brief-generator.ts:30-45]
- [x] [Review][Patch] P20 — Fix cross-package import [morning-brief.tsx:3]
- [x] [Review][Patch] P21 — Handle hydration timestamp [morning-brief.tsx:154]

**Deferred:**
- [x] [Review][Defer] W1 — 30-day retention cleanup [migration] — deferred, blocked by Trigger.dev job setup
- [x] [Review][Defer] W2 — Timezone mismatch on brief_date [morning-brief.tsx, migration] — deferred, pre-existing architectural concern
- [x] [Review][Defer] W3 — StrictMode double-fire on markBriefViewed [morning-brief-tracker.tsx] — deferred, dev-only harmless
- [x] [Review][Defer] W4 — Signals query fetched but unused [brief-context.ts:52-58] — deferred, wasted I/O non-breaking

## Story Completion Status

- [x] Status: Ready for Review (code review patches applied)
