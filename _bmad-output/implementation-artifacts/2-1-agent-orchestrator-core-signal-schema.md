# Story 2.1: Agent Orchestrator Core & Signal Schema

Status: ready-for-dev

## Story

As a developer,
I want the agent orchestration engine and signal schema,
So that all agents have a unified runtime for task execution and inter-agent communication.

## Acceptance Criteria

1. **Given** the database and monorepo foundation exist, **When** the agent orchestrator is implemented, **Then** `packages/agents/orchestrator/` contains an `AgentOrchestrator` seam interface with 4 methods: `enqueue`, `dequeue`, `complete`, `fail` — per architecture "Orchestration Strategy: Seam, Not Abstraction" decision [Source: architecture.md#Orchestration Strategy]
2. **And** pg-boss is configured as the job queue backend inside `PgBossOrchestrator` implementation, with job naming convention `agent:{agent_name}:{action}` per project-context.md#Agent System Architecture
3. **And** an `agent_signals` table exists with immutable insert-only records, correlation IDs, and causation IDs per architecture.md#Agent Signal Schema — exact contract [Source: architecture.md#Communication Patterns]
4. **And** an `agent_runs` table exists tracking the state machine: `queued → running → paused → completed → failed → timed_out` per project-context.md#Agent Execution Lifecycle
5. **And** agent modules follow `packages/agents/{agent-name}/` structure with zero cross-agent imports, enforced via ESLint `no-restricted-imports` per architecture.md#Agent Import DAG [Source: architecture.md#Structural Refinements]
6. **And** the agent job queue supports up to 20 concurrent agent actions at launch per NFR25
7. **And** agent execution failures are recovered or escalated within 5 minutes per NFR18
8. **And** agent actions use compensating transactions (saga pattern) per NFR20
9. **And** every agent action emits structured JSON log with `workspace_id`, `agent_type`, `correlation_id`, `action_type`, `duration_ms`, `outcome` per NFR26
10. **And** RLS is enforced on `agent_signals` and `agent_runs` with `workspace_id::text` cast pattern per NFR09 and existing Epic 1 conventions [Source: 1-2-database-foundation story, AC#2]
11. **And** `packages/agents/shared/` contains `audit-writer.ts`, `trust-client.ts`, `pii-tokenizer.ts`, `llm-router.ts`, `circuit-breaker.ts` stubs per architecture.md directory structure
12. **And** all 6 agent module directories exist as stubs: `inbox/`, `calendar/`, `ar-collection/`, `weekly-report/`, `client-health/`, `time-integrity/` — each with `index.ts`, `executor.ts`, `pre-check.ts`, `schemas.ts` exports per project-context.md#Agent Module Contract
13. **And** `AgentId` type defined as union: `'inbox' | 'calendar' | 'ar-collection' | 'weekly-report' | 'client-health' | 'time-integrity'` in `packages/types/src/agents.ts`
14. **And** pgTAP RLS tests pass for `agent_signals` and `agent_runs` across all role × operation × cross-tenant combinations as P0 gate
15. **And** `packages/test-utils/src/agents/agent-harness.ts` exists for agent integration testing with job submission, polling, and state assertion per architecture.md#Job Handler Testability

## Tasks / Subtasks

```
Task 1 ──── Task 2 ──── Task 3 ──── Task 4 ──── Task 5 ──── Task 6 ──── Task 7
(migrations) (types)   (orch)     (shared)    (stubs)     (RLS tests) (test-utils)
```

- [ ] Task 1: Agent database tables — migrations (AC: #3, #4, #6, #10, #14)
  - [ ] 1.1 Create `supabase/migrations/<timestamp>_agent_signals.sql` — `agent_signals` table:
    ```
    id uuid PK default gen_random_uuid()
    correlation_id uuid NOT NULL
    causation_id uuid NULL (NULL for initial, parent signal ID for triggered)
    agent_id text NOT NULL CHECK (agent_id IN ('inbox','calendar','ar-collection','weekly-report','client-health','time-integrity'))
    signal_type text NOT NULL — format: '{agent}.{verb}.{noun}' e.g. 'inbox.categorized.email'
    version smallint NOT NULL DEFAULT 1 — schema version, additive only
    payload jsonb NOT NULL DEFAULT '{}' — Zod-validated per signalType
    tenant_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
    created_at timestamptz NOT NULL DEFAULT now()
    ```
    Indexes: `idx_agent_signals_correlation_id` on `correlation_id`, `idx_agent_signals_tenant_created` on `(tenant_id, created_at)`, `idx_agent_signals_causation_id` on `causation_id`, `idx_agent_signals_agent_type` on `(tenant_id, agent_id)`. RLS enabled. Append-only trigger (no UPDATE/DELETE — raises exception). Comment block: purpose, related FR28.
  - [ ] 1.2 Create `supabase/migrations/<timestamp>_agent_runs.sql` — `agent_runs` table:
    ```
    id uuid PK default gen_random_uuid()
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
    agent_id text NOT NULL (same CHECK as agent_signals)
    job_id text NOT NULL — pg-boss job ID
    signal_id uuid NULL REFERENCES agent_signals(id)
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','paused','completed','failed','timed_out'))
    input jsonb NOT NULL DEFAULT '{}'
    output jsonb NULL
    error jsonb NULL — stores FlowError JSON
    trust_tier_at_execution text NULL — snapshot of trust tier when run started
    correlation_id uuid NOT NULL
    started_at timestamptz NULL
    completed_at timestamptz NULL
    created_at timestamptz NOT NULL DEFAULT now()
    updated_at timestamptz NOT NULL DEFAULT now()
    ```
    Indexes: `idx_agent_runs_workspace_status` on `(workspace_id, status)`, `idx_agent_runs_workspace_created` on `(workspace_id, created_at DESC)`, `idx_agent_runs_job_id` on `job_id` UNIQUE, `idx_agent_runs_correlation_id` on `correlation_id`, `idx_agent_runs_agent_workspace` on `(agent_id, workspace_id)`. RLS enabled. `updated_at` trigger. Comment block.
  - [ ] 1.3 Create `supabase/migrations/<timestamp>_agent_rls_policies.sql` — RLS policies for both tables. `agent_signals`: workspace members can SELECT own tenant; only service_role can INSERT (via orchestrator). No UPDATE/DELETE for anyone. `agent_runs`: workspace members can SELECT own tenant; orchestrator (service_role) can INSERT/UPDATE; no DELETE. All policies use `workspace_id::text = auth.jwt()->>'workspace_id'` pattern.

- [ ] Task 2: Type definitions in `packages/types/` (AC: #3, #13)
  - [ ] 2.1 Create `packages/types/src/agents.ts` — Named exports:
    - `AgentId` = union type of 6 agent string literals
    - `AgentSignal` interface matching architecture.md#Agent Signal Schema exact contract (id, correlationId, causationId, agentId, signalType, version, payload, tenantId, createdAt)
    - `agentSignalSchema` Zod schema for `AgentSignal` runtime validation
    - `AgentRunStatus` = union of state machine states
    - `AgentRun` interface (id, workspaceId, agentId, jobId, signalId, status, input, output, error, trustTierAtExecution, correlationId, startedAt, completedAt, createdAt, updatedAt)
    - `agentRunSchema` Zod schema for `AgentRun`
    - `AgentWorkflowState` discriminated union from architecture.md#Agent Orchestration State Machine (pending | running | waiting_approval | completed | failed)
    - `signalTypePattern` helper regex/type: ``${AgentId}.${string}.${string}``
  - [ ] 2.2 Export from `packages/types/src/index.ts`

- [ ] Task 3: AgentOrchestrator seam + pg-boss implementation (AC: #1, #2, #6, #7, #8, #9)
  - [ ] 3.1 Add `pg-boss` dependency: `pnpm add -w pg-boss` and add to `packages/agents/package.json`
  - [ ] 3.2 Create `packages/agents/orchestrator/types.ts` — `AgentOrchestrator` interface (~40 lines):
    ```typescript
    export interface AgentOrchestrator {
      enqueue(job: { agentId: AgentId; payload: unknown; tenantId: string; correlationId: string; causationId?: string }): Promise<string>
      dequeue(agentId: AgentId, timeoutMs?: number): Promise<AgentJob | null>
      complete(jobId: string, result: unknown): Promise<void>
      fail(jobId: string, error: FlowError): Promise<void>
    }
    ```
    Plus `AgentJob` type (id, agentId, payload, tenantId, correlationId, causationId).
  - [ ] 3.3 Create `packages/agents/orchestrator/pg-boss.ts` — `PgBossOrchestrator implements AgentOrchestrator`. Constructor receives pg-boss connection config. `enqueue` creates job named `agent:{agentId}:{action}` (action extracted from payload). `dequeue` fetches from pg-boss. `complete`/`fail` delegate to pg-boss with structured logging. Each method wraps in try/catch that emits structured JSON log. Connection pool bounded for 20 concurrent agent actions (NFR25) — pg-boss `max` config parameter.
  - [ ] 3.4 Create `packages/agents/orchestrator/pg-boss.test.ts` — Unit tests with pg-boss mocked: enqueue creates job with correct name pattern, dequeue returns null on empty queue, complete marks job done, fail records error, structured logging emitted on each operation, connection pool config respects NFR25 limit.
  - [ ] 3.5 Create `packages/agents/orchestrator/factory.ts` — `createOrchestrator(connectionConfig)` returns `AgentOrchestrator` instance. Single import point. Named export.
  - [ ] 3.6 Create `packages/agents/orchestrator/index.ts` — re-exports `AgentOrchestrator`, `AgentJob`, `createOrchestrator`. Does NOT re-export `PgBossOrchestrator` (implementation detail).

- [ ] Task 4: Shared agent utilities — stubs (AC: #11)
  - [ ] 4.1 Create `packages/agents/shared/audit-writer.ts` — `writeAuditLog(params: { workspaceId, agentId, action, outcome, correlationId, durationMs, meta? })` that inserts to `audit_log` via service client. Structured JSON log format per NFR26. Named export. Stub implementation that logs to console in development, full implementation inserts to DB.
  - [ ] 4.2 Create `packages/agents/shared/audit-writer.test.ts` — verify structured log shape, workspace_id presence, all required fields.
  - [ ] 4.3 Create `packages/agents/shared/trust-client.ts` — `getTrustTier(agentId: AgentId, tenantId: string): Promise<TrustTier>` that reads trust matrix from DB. Returns 'supervised' if no matrix found (safe default). Named export.
  - [ ] 4.4 Create `packages/agents/shared/trust-client.test.ts` — returns supervised for missing matrix, returns correct tier when present.
  - [ ] 4.5 Create `packages/agents/shared/pii-tokenizer.ts` — `tokenizePII(text: string, tenantId: string): { tokenizedText: string; tokens: Map<string, string> }` and `detokenizePII(text: string, tokens: Map<string, string>): string`. Regex-based entity detection (emails, phone numbers, dollar amounts). Named exports. Stub with core regex patterns.
  - [ ] 4.6 Create `packages/agents/shared/pii-tokenizer.test.ts` — email detection, phone detection, dollar amount detection, roundtrip tokenization.
  - [ ] 4.7 Create `packages/agents/shared/llm-router.ts` — `createLLMRouter()` that wraps Vercel AI SDK with model-tier routing: cheap model (Groq) for categorization/extraction, quality model (Anthropic) for drafts/reports. Named export. Stub that returns the Vercel AI SDK functions.
  - [ ] 4.8 Create `packages/agents/shared/llm-router.test.ts` — verify model selection logic, fallback behavior.
  - [ ] 4.9 Create `packages/agents/shared/circuit-breaker.ts` — `CircuitBreaker` class with 5-failure threshold → 60s open state per NFR47. Named export.
  - [ ] 4.10 Create `packages/agents/shared/circuit-breaker.test.ts` — transitions closed→open after 5 failures, recovers after timeout, resets on success.
  - [ ] 4.11 Create `packages/agents/shared/index.ts` — explicit re-exports only: audit-writer, trust-client, pii-tokenizer, llm-router, circuit-breaker. NOTHING else.

- [ ] Task 5: Agent module stubs (AC: #5, #12)
  - [ ] 5.1 Create `packages/agents/inbox/` directory with: `index.ts` (exports execute, preCheck, types, schemas), `executor.ts` (stub: typed signature `execute(input: InboxInput): Promise<InboxProposal>`), `pre-check.ts` (stub: `preCheck(proposal): Promise<{passed: boolean; errors: string[]}>`), `schemas.ts` (stub: `inboxInputSchema`, `inboxProposalSchema` as Zod schemas), `types.ts` (inferred types from schemas). Each file ≤40 lines.
  - [ ] 5.2 Repeat 5.1 pattern for `calendar/`, `ar-collection/`, `weekly-report/`, `client-health/`, `time-integrity/` — each with agent-specific input/proposal type names per project-context.md#Naming Conventions (e.g., `ArCollectionProposal`, `InboxPreCheckResult`).
  - [ ] 5.3 Add ESLint rule to `packages/config/eslint/no-restricted-imports.js` (update existing) — forbid `agents/{module-a} → agents/{module-b}` for all cross-agent pairs. FORBIDDEN: `agents/* → orchestrator/*` (agents use interface only). FORBIDDEN: `agents/shared/* → agents/{module}/*` (shared is upstream only). Verify with `agent-dependencies.json` committed to `packages/agents/`.
  - [ ] 5.4 Create `packages/agents/__tests__/agent-contracts.test.ts` — skeleton: imports all 6 agent input/output schemas, validates each schema parses valid fixture and rejects invalid fixture. This is the contract test harness from architecture.md — populated with real fixtures when agents are implemented.

- [ ] Task 6: Drizzle schema + RLS tests (AC: #10, #14)
  - [ ] 6.1 Create `packages/db/src/schema/agent-signals.ts` — Drizzle pgTable matching migration from Task 1.1
  - [ ] 6.2 Create `packages/db/src/schema/agent-runs.ts` — Drizzle pgTable matching migration from Task 1.2
  - [ ] 6.3 Update `packages/db/src/schema/index.ts` — re-export new schema tables
  - [ ] 6.4 Create `packages/db/src/queries/agents/signals.ts` — `insertSignal(signal)`, `getSignalsByCorrelationId(correlationId, tenantId)`, `getSignalsByTenant(tenantId, limit, offset)`. All use RLS-scoped client. Named exports.
  - [ ] 6.5 Create `packages/db/src/queries/agents/signals.test.ts` — unit tests with mocked Supabase client.
  - [ ] 6.6 Create `packages/db/src/queries/agents/runs.ts` — `insertRun(run)`, `updateRunStatus(runId, status, update)`, `getRunsByTenant(tenantId, filters)`, `getRunByJobId(jobId, tenantId)`. All use RLS-scoped client. Named exports.
  - [ ] 6.7 Create `packages/db/src/queries/agents/runs.test.ts` — unit tests with mocked Supabase client.
  - [ ] 6.8 Update `packages/db/src/queries/agents/index.ts` — barrel re-export
  - [ ] 6.9 Create `supabase/tests/rls_agent_signals.sql` — pgTAP: test tenant A member cannot see tenant B signals; service_role can insert; no UPDATE/DELETE succeeds for any role. Follow existing `rls_workspaces.sql` pattern.
  - [ ] 6.10 Create `supabase/tests/rls_agent_runs.sql` — pgTAP: test tenant A member cannot see tenant B runs; service_role can insert/update; no DELETE for any role.

- [ ] Task 7: Test utilities for agents (AC: #15)
  - [ ] 7.1 Create `packages/test-utils/src/agents/agent-harness.ts` — `AgentTestHarness` class: `submitJob(agentId, payload)` → enqueues via orchestrator mock, `waitForCompletion(timeoutMs)` → polls for terminal state, `assertFinalState(expected)` → validates run status/output. Factory pattern: `createAgentHarness(config)`. Named exports.
  - [ ] 7.2 Create `packages/test-utils/src/agents/agent-harness.test.ts` — verify harness submit/wait/assert flow with mock orchestrator.
  - [ ] 7.3 Create `packages/test-utils/src/agents/agent-contracts.ts` — `assertSchemaCompatibility(fromSchema, toSchema, fixtures)` — validates that every valid output from agent A is accepted by agent B's input schema. Named export.
  - [ ] 7.4 Create `packages/test-utils/src/agents/llm-mock.ts` — `createLLMMock(responses)` — returns deterministic LLM responses for testing. Named export.
  - [ ] 7.5 Update `packages/test-utils/src/agents/index.ts` — barrel re-export
  - [ ] 7.6 Run `pnpm build && pnpm test && pnpm lint` — zero errors

## Dev Notes

### Architecture Constraints (MUST follow)

- **AgentOrchestrator is a seam, not an abstraction.** 4 methods only: `enqueue`, `dequeue`, `complete`, `fail`. pg-boss implements it. Agents never import orchestrator directly — they receive it via dependency injection or factory. Swappable to LISTEN/NOTIFY or Temporal by changing one file. [Source: architecture.md#Orchestration Strategy]
- **Zero cross-agent imports.** Agent modules communicate ONLY via shared signal records in the database. ESLint `no-restricted-imports` enforced + CI DAG assertion against `agent-dependencies.json`. [Source: architecture.md#Agent Import DAG]
- **Signals are immutable insert-only.** Never UPDATE or DELETE a signal. `causationId` links triggered signals to their parent. `version` is additive — never remove fields. [Source: architecture.md#Agent Signal Schema]
- **Service role ONLY in agent execution context.** `createServiceClient()` only used inside orchestrator (for job queue operations) and agent executors (for DB writes). Never in user-facing code. [Source: project-context.md#Critical Implementation Rules]
- **RLS as security perimeter.** `workspace_id::text = auth.jwt()->>'workspace_id'` pattern on ALL agent tables. Service role queries must include explicit `workspace_id` filter. [Source: 1-2-database-foundation story convention]
- **200-line file limit.** Orchestrator implementation may approach this — decompose if needed. Types/interfaces in `packages/types/`, implementation in `packages/agents/orchestrator/`. [Source: project-context.md#Code Quality]
- **Named exports only.** Default exports only for Next.js page components. [Source: project-context.md#Import/Export Patterns]
- **Zod validation at agent entry points.** `execute()` receives `unknown`, parses with Zod schema before processing. Agent output validated via Zod before any side effect. [Source: architecture.md#Validation Layer Boundary]
- **Structured error handling.** All errors use `FlowError` discriminated union. No raw `Error` across package boundaries. Agent errors set `retryable: boolean` + `agentId` for tracing. [Source: architecture.md#Error Handling Patterns]

### Import DAG (enforced)

```
ALLOWED:   agents/{module} → trust, shared, db, agents/shared, types
FORBIDDEN: agents/{module} → agents/orchestrator/* (use interface only)
FORBIDDEN: agents/{module-a} → agents/{module-b}
FORBIDDEN: agents/shared → agents/{module}
FORBIDDEN: ui → trust (components receive trust state as props)
```

### Existing Codebase to Extend

- `packages/db/src/client.ts` — `createServerClient()`, `createBrowserClient()`, `createServiceClient()` already exist from Story 1.2. Use these directly. Do NOT recreate.
- `packages/db/src/rls-helpers.ts` — `requireTenantContext()` already exists. Use for all agent DB queries in user-facing paths.
- `packages/db/src/cache-policy.ts` — `invalidateAfterMutation()` already exists. Orchestrator calls this after agent mutations.
- `packages/types/src/flow-error.ts` — `FlowError` discriminated union already exists from Story 1.2. Import from `@flow/types`.
- `packages/test-utils/src/db/tenant-factory.ts` — `createTestTenant()` already exists. Use for agent integration tests.
- `supabase/migrations/` — existing migrations through `20260425080000_fix_rls_recursion.sql`. New agent migrations must use later timestamps.
- ESLint no-restricted-imports config already exists in `packages/config/eslint/no-restricted-imports.js` from Story 1.1a. **Update** it — do not replace.

### Signal Type Naming Convention

Pattern: `{agent}.{verb}.{noun}`
Examples:
- `inbox.categorized.email`
- `calendar.confirmed.event`
- `calendar.proposed.slots`
- `trust.graduated.action`
- `ar-collection.reminded.invoice`

### pg-boss Configuration Notes

- pg-boss runs in Postgres — connection pool bound. `max` config must account for 20 concurrent agent actions (NFR25) PLUS regular app queries.
- Job naming: `agent:{agent_name}:{action}` per project-context.md convention.
- Retry config per agent: count, delay, backoff. Default: 3 retries, exponential backoff starting at 1s.
- Dead-letter queue monitoring: failed jobs > 3 retries = P1 incident.
- pg-boss schema installation: pg-boss creates its own tables (`pgboss.job`, etc.) on first start. This happens in the orchestrator factory.

### State Machine Transitions

```
queued ──→ running ──→ completed
  │           │
  │           ├──→ paused ──→ running (resume)
  │           │       └──→ failed (cancel)
  │           │
  │           └──→ failed
  │           └──→ timed_out
  └──→ failed (pre-check failure)
```

Every transition recorded as agent signal (immutable audit trail).

### Project Structure Notes

- New files in `packages/agents/` follow the exact directory structure from architecture.md#Complete Project Directory Structure
- New files in `packages/types/src/agents.ts` — zero runtime deps, only types and Zod schemas
- New files in `packages/db/src/queries/agents/` — follow existing domain-structured pattern from `queries/clients/`, `queries/workspaces/`
- New files in `packages/test-utils/src/agents/` — follow sub-adapter pattern: imports `@flow/agents`, `@flow/types`
- Agent module stubs are minimal — real implementation comes in Stories 2.2-2.7 and Epics 4-8
- `packages/agents/package.json` — single package for all 6 agents + orchestrator + shared. NOT separate packages per agent.

### References

- [Source: architecture.md#Orchestration Strategy — AgentOrchestrator seam design]
- [Source: architecture.md#Agent Import DAG — import enforcement rules]
- [Source: architecture.md#Communication Patterns — AgentSignal exact contract]
- [Source: architecture.md#Agent Orchestration State Machine — workflow states]
- [Source: architecture.md#Complete Project Directory Structure — packages/agents/ layout]
- [Source: architecture.md#Mock Boundary Table — pg-boss mock in unit, real in integration]
- [Source: architecture.md#Job Handler Testability — 3-level testing per agent]
- [Source: architecture.md#Agent Contract Tests — schema compatibility assertions]
- [Source: project-context.md#Agent System Architecture — 6 agents, module isolation, signal records]
- [Source: project-context.md#Agent Execution Lifecycle — state machine, idempotency, concurrency]
- [Source: project-context.md#Agent Module Contract — executor, preCheck, schemas exports]
- [Source: project-context.md#Agent Pre-Checks & Trust — deterministic pre-checks, trust levels]
- [Source: project-context.md#Never Do This — no cross-agent imports, no polling loops for signals]
- [Source: docs/project-context.md#Testing Rules — agent testing requirements, RLS testing]
- [Source: 1-2-database-foundation story — existing DB client, RLS helpers, tenant factory]
- [Source: epics.md#Story 2.1 — acceptance criteria and story definition]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
