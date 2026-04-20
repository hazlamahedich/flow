---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - prd.md
  - product-brief-flow.md
  - ux-design-specification.md
  - project-context.md
workflowType: 'architecture'
project_name: 'flow'
user_name: 'team mantis'
date: '2026-04-19'
lastStep: 8
status: 'complete'
completedAt: '2026-04-19'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (102 FRs across 17 domains):**

| Domain | FR Count | Architectural Weight |
|--------|----------|---------------------|
| AI Agent System (6 agents + coordination) | 12 (FR17-28) | **Critical** — Agent mesh, signal bus, trust gates, pre-checks |
| Inbox Agent (email triage) | 8 (FR28a-28h) | **Critical** — Gmail Pub/Sub, push-triggered, voice profiles, PII |
| Calendar Agent (scheduling) | 7 (FR28i-28o) | **High** — Google Calendar webhooks, conflict detection, race conditions |
| Trust & Autonomy System | 6 (FR29-34) | **Critical** — Per-agent per-action-type matrix, graduation, rollback, cooldown |
| Invoicing & Billing | 11 (FR35-45) | **Critical** — Financial state machine, Stripe integration, idempotency, integer cents |
| Subscription & Tier Management | 8 (FR55-62) | **High** — 3-tier lifecycle, proration, downgrade data preservation |
| Workspace & User Management | 10 (FR1-10) | **High** — Multi-tenant RLS, 4 roles, client scoping, time-bound access |
| Client Management | 6 (FR11-16) | **Medium** — CRUD with health indicators, member-client junction |
| Time Tracking | 5 (FR46-50) | **Medium** — Timer persistence, anomaly detection, downstream invoice effects |
| Client Portal | 4 (FR51-54) | **High** — Subdomain isolation, magic-link auth, zero cross-client visibility |
| Client Engagement & Communication | 5 (FR73a-73e) | **Medium** — Retainer tracking, unified timeline, scope creep detection |
| Reporting | 6 (FR63-68) | **Medium** — Auto-draft reports, PDF export, portal sharing |
| Onboarding & Setup | 5 (FR69-73) | **Medium** — Setup wizard, demo action, preference questions |
| Dashboard, Navigation & Discovery | 5 (FR74-78) | **Medium** — Home dashboard, Cmd+K palette, search across entities |
| Notifications & Communication | 4 (FR79-82) | **Low** — In-app + email, configurable per type/channel |
| Error Handling & Recovery | 5 (FR83-87) | **Medium** — Partial state preservation, soft/hard delete distinction |
| Data Management & Compliance | 5 (FR88-92) | **High** — GDPR tiered deletion, hash-chain audit, workspace isolation |
| Concurrency & Data Integrity | 4 (FR93-96) | **High** — Optimistic locking, agent-human conflict resolution, idempotency |
| Accessibility & Platform | 3 (FR97-99) | **Medium** — WCAG 2.1 AA, keyboard-first, mobile-responsive |
| Analytics & Validation | 3 (FR100-102) | **Low** — Usage analytics, validation metrics, financial summaries |

**Non-Functional Requirements (56 NFRs across 11 categories):**

| Category | Key NFRs | Architectural Impact |
|----------|----------|---------------------|
| Performance (7) | p95 API <200ms, page load <2s, email categorization <60s, Morning Brief <10s | Server Components by default, optimistic UI, streaming priority |
| Security (14) | RLS on every table, PII tokenization, prompt injection defense (3 layers MVP), OAuth encryption, zero cross-tenant leakage | Defense-in-depth agent pipeline, provider abstraction, canary tokens |
| Reliability (6) | Tiered uptime (99-99.9%), agent failure recovery <5min, saga pattern, multi-provider LLM fallback | Circuit breaker pattern, job queue with retry, compensating transactions |
| Scalability (3) | 100 concurrent workspaces, 20 concurrent agent actions, pg-boss connection pool bound | Supabase Team plan readiness, read replica roadmap |
| Observability (5) | Structured JSON per agent action, LLM cost per workspace, synthetic health checks every 5min | Correlation IDs through causal chain, cost gates in CI |
| Data Lifecycle (7) | GDPR tiered deletion (PII 30d / financial 7yr / audit preserved), hash-chain integrity, quarterly isolation verification | Append-only audit log, PII token replacement for hash chains |
| Cost Governance (3) | Hard per-workspace LLM budget, cost estimated before execution, daily platform spend alerts | Model-tier routing, budget gates |
| Accessibility (5) | WCAG 2.1 AA, keyboard navigation, screen reader support, focus management | ARIA live regions, `prefers-reduced-motion`, logical focus order |
| Integration (5) | Stripe webhook retry (1s/5s/30s), LLM circuit breaker (5 failures → 60s open), 30s API timeouts | Exponential backoff, dead letter queues, timeout budgets |
| Onboarding (3) | Signup → first agent task <5min, abandonment detection, tiered support SLA | Guided wizard, pre-configured defaults |
| Billing Accuracy (3) | Usage metering ≥99.9%, real-time usage visibility, 30-day dispute window | Stripe reconciliation job, idempotency keys |

**Scale & Complexity:**

- Primary domain: Full-stack web SaaS + Agentic AI (Next.js 15, Supabase, Vercel AI SDK, Turborepo)
- Complexity level: **Medium-High** — Multi-tenant isolation, 6-agent coordination with trust graduation, financial data handling, real-time features, dual-app architecture, GDPR compliance
- Estimated architectural components: ~8 packages + 2 apps + 6 agent modules + 2 provider abstractions + infrastructure layer

### Technical Constraints & Dependencies

**Locked technology decisions (from project-context.md):**
- Next.js 15 App Router only (no Pages Router)
- React 19 with Server Components by default
- Supabase (Postgres + Auth + Storage + RLS) — single database, RLS as security perimeter
- Turborepo monorepo with enforced package boundaries
- shadcn/ui + Tailwind CSS + Radix primitives
- BlockNote editor (Phase 1: local-only, Phase 2: Hocuspocus real-time)
- pg-boss for agent task orchestration (not BullMQ — one less infra dependency)
- Trigger.dev for scheduled jobs and external webhooks only
- Vercel AI SDK for multi-provider LLM routing
- Zod for runtime schema validation as inter-layer contracts

**Hard constraints:**
- `service_role` Supabase key only in agent execution context and system webhooks — never in user-facing code
- All monetary values as integers in cents — never float
- Agent modules have zero cross-imports — communication via shared signal records only
- `workspace_id` derived from session/JWT — never from URL params or client submissions
- 200 lines per file soft limit, 50 lines for pure logic functions
- No `any` types, no `@ts-ignore`, strict TypeScript throughout

### Cross-Cutting Concerns Identified

| Concern | Affected Components | Architectural Response |
|---------|-------------------|----------------------|
| **Multi-tenant isolation (RLS)** | Every data query, agent run, portal access | 3-layer defense: middleware gate → RLS policies → audit anomaly scan |
| **Trust state management** | Agent inbox, agent modules, UI components, onboarding | Sparse materialized matrix, event-sourced transitions, versioned snapshots at decision time |
| **Agent coordination signals** | All 6 agents, job queue, event bus | Immutable signal records, canonical event format with trace IDs, graceful degradation to independent scheduling |
| **PII tokenization** | Agent context assembly, email processing, LLM prompts, portal | Regex-based entity detection + token vault, pre-generation PII scanner, never raw PII in prompts |
| **Idempotent financial operations** | Invoice state machine, Stripe webhooks, payment processing | `stripe_event_id` dedup table, idempotency keys, "already in target state = success" pattern |
| **Audit logging** | All mutations, agent actions, auth events, billing changes | Append-only log, hash chain, tamper detection, 90d hot / 7yr cold retention |
| **GDPR tiered deletion** | User data, client data, financial records, audit trail | Tier 1 (immediate delete), Tier 2 (anonymize 7yr), Tier 3 (retain with consent) |
| **Deterministic pre-checks** | Agent output pipeline, trust system | Code-level validation layer between LLM output and user surface, 100% branch coverage |
| **Provider abstraction** | Inbox Agent, Calendar Agent, future integrations | `EmailProvider` / `CalendarProvider` interfaces, registry-based resolution |
| **Subscription state machine** | Billing, agent orchestration, workspace features, portal access | Single source of truth for workspace entitlement, 60s completion window for in-flight agents |
| **Dual-theme rendering** | Workspace app, portal app, shared UI components | 3-layer token system (semantic, emotional, brand), CSS variable swap at layout level |
| **Keyboard-first interaction** | Agent inbox, timer, command palette, navigation | Cmd+K palette, shortcut discoverability, ARIA live announcements, focus management |

### Roundtable Consensus (Winston, Murat, Amelia)

**Orchestration Strategy: Seam, Not Abstraction**

Thin interface from day one — four methods (`enqueue`, `dequeue`, `complete`, `fail`). pg-boss implements it. Agents never import orchestration directly. Swappable to LISTEN/NOTIFY or Temporal later by changing one file.

```
packages/orchestration/
  types.ts          # AgentOrchestrator interface (~40 lines)
  pg-boss.ts        # PgBossOrchestrator implementation
  index.ts          # Factory, re-exports
```

**Agent Import DAG: Explicit Boundaries**

```
ALLOWED:   agents/* → trust/*, shared/*, packages/*
FORBIDDEN: agents/* → orchestration/*
FORBIDDEN: agents/agent-a → agents/agent-b
```

Enforced via ESLint `no-restricted-imports` rule + CI DAG assertion against committed `agent-dependencies.json`.

**Blast Radius Taxonomy (P0-P3)**

Test depth scales with blast radius, not code complexity. A 10-line RLS policy change is P0. A 500-line UI refactor is P3.

| Tier | Label | Example | Test Rigor | Quarantine Policy |
|------|-------|---------|------------|-------------------|
| **P0** | Existential | Cross-tenant leak, financial calculation error | Full negative harness per PR + fuzz nightly | Never quarantined. CI-blocking permanently. |
| **P1** | Critical | Single-tenant corruption, stale trust state | Snapshot state assertion per trust transition | 4hr mandatory fix. Feature flag disable. |
| **P2** | Functional | Wrong workflow routing, agent timeout | Contract test on degraded output | 48hr quarantine. Auto-retry + circuit breaker. |
| **P3** | Cosmetic | UI rendering, non-financial display | Smoke test only | 7-day quarantine. Next deploy cycle. |

**RLS Defense-in-Depth: Three Layers**

1. **Middleware gate** — `requireTenantContext()` on every route/webhook entry point. Test: assert 403 when tenant missing.
2. **RLS policies** — Every table. `setupRLSFixture(tenantId, role)` test helper in `packages/test-utils/`. Seeds two tenants, asserts zero cross-visibility.
3. **Audit anomaly scan** — Nightly `visible_rows` count assertion per tenant. Discrepancy = P0 incident.

Supabase test instances: Docker-local for CI speed, Supabase branching for staging. Identical fixtures across both.

**200-Line File Limit: Decomposition Pattern**

The limit stays. Complex Server Actions decompose into orchestrator + sub-modules:

```
actions/
├── create-transaction.ts        # ≤200 lines — validates, delegates, returns
├── create-transaction/
│   ├── validate.ts              # Zod schema + custom validation
│   ├── trust-check.ts           # Trust gate logic
│   ├── persist.ts               # Database mutation
│   └── notify.ts                # Post-commit side effects
```

Test files exempt from the limit. `max-lines` ESLint rule with severity `error` on source files.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web SaaS with Agentic AI. The project context (`docs/project-context.md`) pre-locks the entire technology stack — no existing starter covers the 180 technical rules, pg-boss, Trigger.dev, Vercel AI SDK, BlockNote, and dual-theme trust-progression architecture.

### Starter Options Considered

| Option | Verdict | Rationale |
|--------|---------|-----------|
| Custom Turborepo Scaffold | **Selected** | Exact alignment with 180 rules. Zero override debt. Monorepo structure matches package boundaries. |
| create-t3-app | Rejected | Uses Prisma (project uses Supabase), tRPC (project uses Server Actions), NextAuth (project uses Supabase Auth). Too many overrides. |
| Supabase + Next.js Starter | Rejected | Lacks Turborepo monorepo, shadcn/ui, agent infrastructure, specific package structure. |
| Supabase + Next.js + shadcn starters | Rejected | Each covers a subset. No combination covers the full stack without significant restructuring. |

### Selected Approach: Custom Turborepo Scaffold

**Rationale:** The project context defines 180 strict technical rules, a specific monorepo package structure, and integration requirements (pg-boss, Trigger.dev, Vercel AI SDK, BlockNote) that no existing starter covers. A custom scaffold from `create-turbo` gives exact alignment with zero override debt.

**Single App with Route Groups (Roundtable Consensus)**

Initial proposal used two separate Next.js apps (`apps/web` + `apps/portal`). After roundtable evaluation (Winston, Amelia, Sally), consensus shifted to **single app with route groups** per the PRD:

- Trust progression is a cross-cutting concern — same component, two theme contexts. Two apps create component drift risk.
- Free-tier portal sharing must feel seamless — URL changes between deployments fracture trust.
- One deployment, one CI pipeline, one Vercel project. Simpler DX.
- PRD specifies: "Extract to separate app when portal traffic exceeds 30%."

**Extraction trigger (formalized):**
- 20% portal traffic → evaluate extraction
- 30% portal traffic → plan extraction
- 40% portal traffic → execute extraction
- Metrics dashboard tracks workspace vs. portal request ratios from day one
- `packages/ui` designed so extraction is a refactor, not a rewrite

**Initialization Commands:**

```bash
npx create-turbo@latest flow --package-manager pnpm
npx supabase init && npx supabase start
npx shadcn@latest init
pnpm add -w @supabase/supabase-js @supabase/ssr
pnpm add -w ai @ai-sdk/openai @ai-sdk/anthropic
pnpm add -w pg-boss zod
pnpm add -w @trigger.dev/sdk
pnpm add -w @blocknote/core @blocknote/react
```

### Monorepo Structure

```
apps/
  web/
    app/
      (workspace)/          ← Editor's Desk, dark theme
        layout.tsx          ← dark theme provider
        inbox/
        calendar/
        agents/
        clients/
        invoices/
        time/
        reports/
        settings/
      (portal)/[slug]/      ← Gentle Rhythm, branded
        layout.tsx          ← brand token provider
        overview/
        invoices/
        projects/
        messages/
      api/                  ← Route Handlers (webhooks only)
    middleware.ts           ← subdomain → route group mapping
packages/
  ui/                       → shadcn primitives + domain components + theme tokens
    components/             → shadcn + custom (AgentCard, TrustBadge, etc.)
    theme/                  → CSS vars, tailwind preset, BrandProvider
  trust/                    → scoring, cadence, viewport state machine
  editor/                   → BlockEditor + trust signal emission (isolated)
  types/                    → Zod schemas + inferred types + pure utils
  db/                       → Supabase client, RLS helpers, migration utilities
  agents/                   → Agent modules + orchestrator interface
    orchestrator/           → AgentOrchestrator interface + pg-boss impl
    inbox/                  → Inbox Agent (zero cross-agent imports)
    calendar/               → Calendar Agent
    ar-collection/          → AR Collection Agent
    weekly-report/          → Weekly Report Agent
    client-health/          → Client Health Agent
    time-integrity/         → Time Integrity Agent
    shared/                 → trust-client, pii-tokenizer, audit-writer
  test-utils/               → setupRLSFixture, rlsTestSuite, createTestApp
  config/                   → shared ESLint, TypeScript, Tailwind configs
```

### Architectural Decisions Provided by Scaffold

**Language & Runtime:**
- TypeScript strict mode, no `any`, no `@ts-ignore`
- React 19 with Server Components default
- Node.js 20+ (Supabase Edge Functions compatibility)

**Styling Solution:**
- Tailwind CSS with `darkMode: 'class'` (each theme sets own `:root`, not `dark:` toggle)
- shadcn/ui primitives (Radix-based) — no modification to foundation components
- Dual-theme: workspace dark + portal light via layout-level theme providers
- 3-layer token system: semantic, emotional, brand (8-12 CSS variables)

**Build Tooling:**
- Turborepo with pnpm workspaces
- Turbo pipeline: `config` → `theme` → `ui` → `web`
- `next/font/google` for Inter + JetBrains Mono — no CDN

**Testing Framework:**
- Vitest (unit + integration) — workspace-configured
- Playwright (E2E) — workspace-configured
- pgTAP (RLS assertions) — via Supabase CLI
- `packages/test-utils/` with `setupRLSFixture`, `rlsTestSuite`, `createTestApp`

**Code Organization:**
- Server Actions for mutations, Route Handlers for webhooks only
- ActionResult contract: `{ success: true; data: T } | { success: false; error: AppError }`
- Agent module contract: `execute()`, `preCheck()`, types, schemas
- 200-line file limit with decomposition pattern for complex actions
- ESLint `no-restricted-imports` enforcing agent boundary rules

**Import DAG (enforced):**
```
ALLOWED:   agents/* → trust, shared, db, agents/shared
FORBIDDEN: agents/* → orchestration internals (agents use orchestrator interface only)
FORBIDDEN: agents/agent-a → agents/agent-b
FORBIDDEN: ui/ → trust/ (components receive trust state as props)
```

**Development Experience:**
- `pnpm dev` — Turbo parallel dev server
- `pnpm test` — Vitest across all packages
- `pnpm test:e2e` — Playwright full suite
- `pnpm test:rls` — RLS isolation suite (P0, CI-blocking)
- Supabase CLI for local development with seed data
- `supabase/migrations/` — version-controlled RLS policies
- `CONTRIBUTING.md` with ASCII dependency graph

**Note:** Project initialization using this scaffold should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multi-tenant isolation | 3-layer RLS defense-in-depth | Existential for financial data. Middleware gate → RLS policies → audit scan. |
| Agent orchestration | pg-boss with AgentOrchestrator seam | 4-method interface, swappable. Agents never import queue directly. |
| Trust state management | Versioned snapshots at decision time | Prevents stale trust reads during agent execution. |
| Financial data handling | Integer cents everywhere | Never float. Non-negotiable. |
| Error handling | Discriminated unions (not class hierarchy) | Serializable, cross-package compatible, pattern-matchable in tests. |

**Important Decisions (Shape Architecture):**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Client state management | Jotai atoms | Fine-grained reactivity for sparse trust matrix (~72 cells). Testable in isolation. UX spec alignment. |
| Real-time updates | Polling with smart backoff | Boring, testable, API-level. Auth evaluated per-request (not per-subscription). Migration path to SSE documented. |
| Caching strategy | `cache()` + `revalidateTag()` | Targeted invalidation. Never `revalidatePath()`. |
| CI/CD pipeline | 3-tier GitHub Actions | T0 every push, T1 every PR with RLS, T2 merge with E2E. |
| Configuration | DB-driven tier limits + env vars for secrets | Tier limits as data (testable with fixtures). Feature flags in `app_config` table. |

**Deferred Decisions (Post-MVP):**

| Decision | Deferral Trigger |
|----------|-----------------|
| SSE / WebSocket for real-time | Polling latency becomes measurable pain point at scale |
| Redis caching layer | Next.js cache insufficient at 500+ workspaces |
| Feature flag service (LaunchDarkly etc.) | Team grows beyond solo founder |
| Staging environment | Paying Agency-tier customers request it |
| CDN-level caching | Real traffic data shows cache miss rates |

### Data Architecture

**Database:** Supabase Postgres — single instance, RLS on all workspace-scoped tables.

**Data modeling:**
- All monetary values as integers in cents (`bigint` columns, never `numeric` or `float`)
- `workspace_id` (uuid) on every tenant-scoped table, indexed, `::text` cast in all RLS policies
- Sparse trust matrix as `jsonb` column (~72 cells per VA, keyed by `agentId × actionType`)
- Agent signals as immutable insert-only records with correlation IDs
- Junction tables for RBAC: `workspace_members`, `member_client_access`
- Append-only `audit_log` with hash chain for tamper detection

**Migration approach:**
- `supabase/migrations/` — version-controlled, tested in CI
- RLS policies versioned as code — pgTAP regression suite snapshots policies per table
- Seed scripts for local development with all 4 roles + client scoping + tier configs

**Caching strategy:**

| Data Type | Strategy | Mechanism |
|-----------|----------|-----------|
| Portal branding (CSS vars) | RSC `cache()` + `revalidateTag` | Tag: `branding:{tenantId}`. Invalidate on VA branding mutation. |
| Workspace config | ISR 60s | `revalidate = 60` on workspace layout |
| Agent inbox | No server cache | Jotai atoms + polling. `atomWithRefresh` for manual revalidation. |
| Trust viewport | Client optimistic | Jotai optimistic updates, server reconciliation on poll response |
| Public pages | Static + ISR 300s | Standard Next.js ISR |
| Tier config | `cache()` + `revalidateTag` | Tag: `config:tiers`. Invalidate on admin mutation. |

**Never used:** `revalidatePath()` — untargeted, untestable at unit level, creates hidden coupling between routes.

### Authentication & Security

**Auth method:** Supabase Auth — magic link (15min expiry, 5 attempts/hour) + Google OAuth.

**Authorization patterns:**
- 4 roles: Owner, Admin, Member, ClientUser (portal-only)
- RLS on every workspace-scoped table — `USING (workspace_id::text = auth.jwt()->>'workspace_id')`
- Client scoping via `member_client_access` junction table with FK cascade
- `has_access(workspace_id, resource_type, resource_id)` RPC for client-side permission feedback
- `service_role` key only in agent execution context and system webhooks — never in client code

**RLS defense-in-depth (3 layers):**

1. **Middleware gate** — `requireTenantContext()` on every route/webhook entry point. Sets request-scoped `tenant_id`. No valid tenant = request dies.
2. **RLS policies** — Every table. `setupRLSFixture(tenantId, role)` test helper in `packages/test-utils/`. Seeds two tenants, asserts zero cross-visibility per PR.
3. **Audit anomaly scan** — Nightly `visible_rows` count assertion per tenant. Discrepancy = P0 incident.

**PII tokenization:** Regex-based entity detection + token vault before data enters LLM prompts. Agent prompts never contain raw client names, emails, or financial figures.

**Prompt injection defense (3 layers, MVP):** (1) input sanitization/encoding, (2) system prompt guardrails with role separation, (3) output validation via Zod schema.

### API & Communication Patterns

**API design:**
- Server Actions for all mutations — Zod validated, RLS enforced
- Route Handlers for webhooks only (Stripe, Gmail Pub/Sub, Google Calendar, Trigger.dev)
- No REST API, no GraphQL, no tRPC for MVP (API access deferred to Agency+ tier)

**Client-side state management:**

```
packages/shared/src/atoms/
  trust-viewport.ts      // family atoms keyed by [tenantId][agentId]
  agent-inbox.ts         // pending items, selected item, filters
  notifications.ts       // toast queue, unread count
  ui-state.ts            // sidebar, modals, timers
```

- Jotai atoms for all mutable client state
- Derived atoms for computed state (filtered inbox, dominant trust tier)
- React Context for portal branding only (`PortalThemeProvider`)
- Trust viewport: sparse matrix atoms, ~72 cells per VA, only subscribed cells re-render

**Real-time updates:**

```
packages/shared/src/realtime/
  polling-layer.ts       // configurable intervals: 5s trust, 15s roles, 30s cap
  reconciler.ts          // merge updates, dedupe by event ID
  backoff.ts             // exponential: 1s → 2s → 4s → 8s → 30s cap, reset on mutation
```

- Polling for all updates (boring, testable, auth evaluated per-request)
- Exponential backoff with mutation-triggered reset
- Migration path: abstract update strategy behind interface. SSE adapter if polling latency becomes measurable pain point.

**Error handling standard:**

```typescript
type FlowError =
  | { type: 'auth'; code: string; status: 401 | 403; reason: string }
  | { type: 'validation'; code: string; field: string; constraint: string }
  | { type: 'agent'; code: string; agentId: string; retryable: boolean; meta?: Record<string, unknown> }
  | { type: 'financial'; code: string; amount: number; currency: string; limit: number }
  | { type: 'system'; code: string; statusCode: number };

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: FlowError };
```

- Discriminated unions — serializable, cross-package compatible, `instanceof` not needed
- `AUTH`: 401/403. `VAL`: 422 with field-level detail. `AGENT`: 500/504 with agent ID for tracing. `FINANCIAL`: P0 test target. `SYS`: catch-all.
- Debugging context in `error.meta`, not in the type signature
- Per-agent error boundaries in inbox — if one agent crashes, others remain functional

### Frontend Architecture

**Component strategy:**
- shadcn/ui primitives — no modification to foundation components
- Custom domain components in `packages/ui/components/`: `AgentCard`, `TrustBadge`, `Timer`, `ProposalEditor`
- `ui/` never imports from `trust/` — components receive trust state as props
- Free tier: no sidebar, single agent, inbox IS the product. Sidebar activates on second agent.

**Theme architecture:**
- 3-layer token system: semantic (status colors), emotional (trust states), brand (portal vars)
- Workspace: dark theme via `(workspace)/layout.tsx` theme provider
- Portal: branded light theme via `(portal)/[slug]/layout.tsx` brand token provider
- Agent identity colors: 6 permanent HSL values, never change
- Brand tokens: 8-12 CSS variables per VA, runtime swap via `<style>` injection (not CSS files)

**Trust progression UI:**
- Same component rendered in both route groups, themed differently via context
- Gap/border/badge density set by dominant trust tier: Supervised (16px) → Confirm (20px) → Auto (28px)
- `transition-[gap] duration-300` on parent grid for smooth density shifts

**Performance optimization:**
- RSC by default — `"use client"` only when needed (event handlers, browser APIs, hooks)
- Optimistic UI updates on approval actions (300ms)
- Streaming for agent reasoning expansion
- `next/font/google` for Inter + JetBrains Mono — no layout shift

### Infrastructure & Deployment

**Hosting:** Vercel (Next.js native), Supabase (Postgres + Auth + Storage)

**CI/CD pipeline — 3-tier GitHub Actions:**

| Tier | Trigger | Duration Target | Contents |
|------|---------|-----------------|----------|
| **T0** | Every push | <3 min | Type check, lint, format, unit tests. No DB. |
| **T1** | PR open/update | <10 min | + RLS suite (pgTAP), API integration tests, Docker-local Supabase |
| **T2** | Merge to main | <20 min | + E2E smoke tests, financial error paths, cross-agent workflows |

- P0 gate: PRs touching `supabase/migrations/` or auth/RLS files → T1 blocking, even for drafts
- Docker-local Supabase in CI via `supabase start` (~15s), seeded with known tenant fixtures
- Vercel auto-deploys `main` when CI green. Rollback = `vercel --rollback`
- Branch previews via Vercel on every PR

**Environment configuration:**

```sql
create table app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
-- Rows: tier_limits, feature_flags, agent_config, billing_config
```

- Tier limits + feature flags: `app_config` table (data, not code). Cached with `cache()`, revalidated via `revalidateTag`.
- Secrets (Supabase URL, anon key, service role, Stripe keys): Vercel environment variables. Never in DB.
- Config access: `getConfig<T>(key, parser)` with parse validation. Fails at startup if misconfigured.
- Tier boundaries: parameterized tests at ±1 from every limit

### Decision Impact Analysis

**Implementation Sequence:**

1. Turborepo scaffold + Supabase init (first implementation story)
2. `packages/config/` + `packages/types/` + `packages/db/` (foundation)
3. `packages/ui/` + theme system (visual foundation)
4. `packages/trust/` + trust viewport atoms (core thesis)
5. `packages/agents/orchestrator/` + pg-boss setup (agent infrastructure)
6. `packages/test-utils/` + RLS test harness (quality gate)
7. Agent modules one by one (AR Collection first — free tier agent)
8. Client CRUD + time tracking (core workflows)
9. Invoicing + Stripe integration (revenue path)
10. Client portal route group (distribution engine)
11. Inbox Agent + Calendar Agent (frontline agents, daily habit)
12. Onboarding flow (activation)

**Cross-Component Dependencies:**

```
config → types → db → trust → agents → web
                    db → ui → web
              types → test-utils → (all packages)
```

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

23 areas where AI agents could make incompatible choices during implementation, resolved through explicit contracts below.

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case` plural — `workspace_members`, `agent_signals`, `audit_log`
- Columns: `snake_case` — `workspace_id`, `created_at`, `trust_matrix`
- Foreign keys: `{referenced_table_singular}_id` — `workspace_id`, `client_id`, `agent_run_id`
- Indexes: `idx_{table}_{columns}` — `idx_workspace_members_email`, `idx_agent_signals_correlation_id`
- RLS policies: `rls_{table}_{role}_{operation}` — `rls_invoices_member_select`
- Migrations: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Junction tables: `{entity_a}_{entity_b}` alphabetically — `member_client_access`

**API Naming Conventions:**
- Server Actions: `camelCase` verbs — `createInvoice`, `updateTrustTier`, `archiveClient`
- Webhook Route Handlers: `/api/webhooks/{source}/{event}` — `/api/webhooks/stripe/checkout.completed`
- Query params: `camelCase` — `?sortBy=createdAt&pageSize=20`
- Never expose REST endpoints for MVP — Server Actions only

**Code Naming Conventions:**
- Components: `PascalCase` files matching name — `AgentCard.tsx`, `TrustBadge.tsx`
- Hooks: `use{Noun}{Verb}` — `useTrustViewport`, `useAgentInbox`
- Atoms: `camelCase` descriptive — `trustViewportAtom`, `selectedAgentAtom`
- Utilities: `camelCase` verbs — `formatCents`, `deriveTrustTier`, `tokenizePII`
- Types: `PascalCase` — `FlowError`, `ActionResult`, `TrustTier`
- Zod schemas: `camelCase` + `Schema` suffix — `createInvoiceSchema`, `trustMatrixSchema`
- Constants: `UPPER_SNAKE_CASE` — `MAX_TRUST_LEVEL`, `CIRCUIT_BREAKER_THRESHOLD`
- Files: `kebab-case` — `trust-viewport.ts`, `agent-inbox.ts` (except React components)
- Directories: `kebab-case` — `agent-modules/`, `rls-helpers/`

### Structure Patterns

**Project Organization:**
- Tests co-located: `*.test.ts(x)` next to source — `trust-viewport.ts` → `trust-viewport.test.ts`
- RLS tests: `supabase/tests/rls_{table}.sql` — pgTAP, CI-blocking
- E2E tests: `apps/web/tests/{feature}.spec.ts` — Playwright
- Shared utilities: `packages/types/src/utils/` (pure functions, no side effects)
- Agent modules: `packages/agents/{agent-name}/` — each self-contained with own schemas, executor, pre-check

**File Organization Rules:**
- One export per file for React components — `AgentCard.tsx` exports only `AgentCard`
- Barrel files (`index.ts`) at package boundaries only — not within feature modules. Barrels never include test files.
- Zod schemas co-located with types — `packages/types/src/{domain}.ts` contains both schema and inferred type
- Server Actions: one action per file, colocated sub-modules in `{action-name}/` folder when decomposed
- Constants in `packages/config/` — never hardcoded in component or agent logic
- Environment variables: accessed only via `packages/config/src/env.ts` centralized parser

**Directory convention for components:**
```
components/foo/
  foo.tsx          # component
  foo.test.tsx     # co-located test (NOT in barrel)
  index.ts         # barrel — re-exports foo.tsx only
```

### Format Patterns

**ActionResult — exact contract (used by every Server Action):**

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: FlowError }
```

- `success` is the discriminant. Always `true` | `false`. Never `ok`, never `result`.
- All Server Actions return `Promise<ActionResult<T>>`. No exceptions. No bare throws for business logic.
- Webhook handlers return `{ received: true }` or appropriate HTTP status. Not ActionResult.

**FlowError — exact contract (all error paths):**

```typescript
type FlowError =
  | { type: 'auth'; code: 'SESSION_EXPIRED' | 'INSUFFICIENT_ROLE' | 'TENANT_MISMATCH'; status: 401 | 403; reason: string }
  | { type: 'validation'; code: 'INVALID_INPUT' | 'CONSTRAINT_VIOLATION' | 'FIELD_REQUIRED'; field: string; constraint: string }
  | { type: 'agent'; code: 'PRECHECK_FAILED' | 'EXECUTION_TIMEOUT' | 'LLM_ERROR' | 'TRUST_GATE_BLOCKED'; agentId: string; retryable: boolean; meta?: Record<string, unknown> }
  | { type: 'financial'; code: 'AMOUNT_EXCEEDS_LIMIT' | 'DUPLICATE_INVOICE' | 'PAYMENT_FAILED' | 'CURRENCY_MISMATCH'; amount: number; currency: string; limit: number }
  | { type: 'system'; code: 'DB_ERROR' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'INTERNAL'; statusCode: number }
```

- `type` is the discriminant. Every variant has `code` enumerated as string unions (not free-form).
- `meta` carries debugging context only — never used for error routing.
- Financial errors: `amount` and `limit` are integer cents. P0 test target.
- Agent errors: `agentId` enables per-agent error boundaries to isolate failures.

**Validation Layer Boundary (what validates, what trusts):**

| Layer | Validates? | Why |
|-------|-----------|-----|
| Server Actions (entry points) | **Always** | Crosses network boundary. Zod parse on `input: unknown`. |
| Route Handlers (webhooks) | **Always** | External input. Zod parse + signature verification. |
| Agent `execute()` | **Always** | Agent entry point. Zod parse on incoming payload. |
| Server Components | **Never** | Internal. Data comes from trusted server sources. |
| Package internals | **Never** | Internal. Trust the type system between packages. |
| Agent `preCheck()` output | **Always** | LLM output is untrusted. 100% branch coverage required. |

**Data Exchange Formats:**
- JSON field names: `camelCase` in TypeScript, `snake_case` in Postgres — Supabase client handles mapping
- Dates: ISO 8601 strings (`2026-04-19T10:30:00Z`) everywhere — never timestamps, never locale strings
- Monetary values: integer cents in transit and storage — `formatCents()` at display boundary only
- Booleans: `true/false` — never `1/0`, never `"yes"/"no"`
- Null handling: explicit `null` for "known empty", `undefined` for "not provided" — Zod `.nullable()` vs `.optional()`
- IDs: `uuid` strings — never auto-increment integers exposed externally
- Arrays: always arrays, never comma-separated strings in JSON

### Communication Patterns

**Agent Signal Schema — exact contract:**

```typescript
type AgentSignal = {
  id: string;                              // uuid, primary key
  correlationId: string;                   // links signals in same workflow
  causationId: string | null;              // null for initial signal, parent signal ID for triggered signals
  agentId: AgentId;                        // 'inbox' | 'calendar' | 'ar-collection' | 'weekly-report' | 'client-health' | 'time-integrity'
  signalType: string;                      // '{agent}.{verb}.{noun}' format
  version: 1;                              // schema version — additive only, never remove fields
  payload: Record<string, unknown>;        // Zod-validated per signalType
  tenantId: string;                        // workspace_id
  createdAt: string;                       // ISO 8601
};
```

- Signals are immutable insert-only. Never update or delete.
- `causationId` enables workflow tracing: if Agent B triggers from Agent A's signal, `causationId = agentASignal.id`.
- `version`: additive only. Never remove fields. New version = new schema alongside old.
- Signal naming: `{agent}.{verb}.{noun}` — `inbox.categorized.email`, `calendar.confirmed.event`, `trust.graduated.action`

**Data Fetching Decision Tree:**

```
Need data in a component?
├── Is it static/infrequently changing?
│   └── YES → Server Component with direct Supabase query
│       └── Cache with cache() + revalidateTag(tag)
├── Is it a mutation?
│   └── YES → Server Action → return ActionResult<T>
│       └── Invalidate: revalidateTag() on affected entity tags
├── Is it real-time/mutable client state?
│   └── YES → Jotai atom + polling (atomWithRefresh)
│       └── Never useEffect + fetch in components
└── Is it a streaming AI response?
    └── YES → Vercel AI SDK useChat/useCompletion hooks
        └── Server-side: streamText() in Route Handler
```

- Never use `useEffect` for data fetching. Server Components, Server Actions, or Jotai atoms.
- Never use `revalidatePath()` — always `revalidateTag()`.

**Cache Policy — testable extraction:**

```typescript
// packages/config/src/cache-policy.ts — pure function, exhaustively tested

type CacheTag = `branding:${string}` | `config:tiers` | `invoices:${string}` | `clients:${string}` | `reports:${string}`;

type MutationType = 'create' | 'update' | 'delete' | 'archive';

export function getRevalidationTags(
  entity: 'invoice' | 'client' | 'workspace' | 'report' | 'branding',
  mutation: MutationType,
  tenantId: string
): CacheTag[] {
  // Pure function mapping — test every combination
}

export async function invalidateAfterMutation(
  entity: Parameters<typeof getRevalidationTags>[0],
  mutation: MutationType,
  tenantId: string
): Promise<void> {
  const tags = getRevalidationTags(entity, mutation, tenantId);
  tags.forEach(revalidateTag);
}
```

- Tags are workspace-scoped: `invoices:{workspaceId}`, not bare `invoices`.
- Agents never call `revalidateTag` directly — they call `invalidateAfterMutation` from `packages/db/`.

**Jotai Atom Organization:**

```
packages/types/src/atoms/
  trust-viewport.ts       # family atoms keyed by [tenantId][agentId]
  agent-inbox.ts          # pending items, selected item, filters
  notifications.ts        # toast queue, unread count
  ui-state.ts             # sidebar, modals, timers
  polling.ts              # atomWithRefresh + configurable intervals
```

- One file per domain. Primitive atoms + derived atoms together.
- Derived atoms use `selectAtom` or computed `atom(get => ...)` — never duplicate state.
- Polling: `atomWithRefresh` for manual revalidation. Intervals injectable via `atomWithPolling(intervalMs)`.
- Server state sync: `atomWithQuery` pattern or polling reconciliation — no React Query.
- React Context: `PortalThemeProvider` only. Everything else is Jotai.
- Atoms are never mocked in tests — they ARE the state. Test them directly.

**Trust Graduation + RLS Interaction:**

Agents execute in the VA user's session context, not with their own credentials. RLS policies use the user's JWT claims (`workspace_id`, `role`). Trust graduation does NOT map to RLS — it maps to application-level permission checks in `packages/trust/`.

```
RLS: Can this user access this tenant's data? (yes/no — binary, role-based)
Trust: Can this agent perform this action type at this autonomy level? (graduated — trust matrix)
```

These are two independent gates. RLS is always enforced. Trust is enforced in agent `preCheck()` and Server Action validation. An agent at "Supervised" trust can still read data (RLS allows it) but cannot auto-send emails (trust blocks it).

**Polling Contract:**

```typescript
// packages/types/src/realtime/polling.ts
const INTERVALS = {
  trust: 5_000,       // trust viewport
  inbox: 10_000,      // agent inbox items
  config: 60_000,     // workspace config
  max: 30_000,        // exponential backoff cap
} as const;

// All intervals configurable via atom override — 0ms in tests
export const pollingIntervalAtom = atomWithConfigurableInterval(INTERVALS);

// Backoff: 1s → 2s → 4s → 8s → 30s cap, reset on mutation
// Visibility: pause when tab hidden (document.visibilityState), resume on visible
// Stale-while-revalidate: serve cached atom value immediately, reconcile when poll returns
```

**Agent Orchestration State Machine:**

Multi-step agent workflows use pg-boss job chains with explicit state tracking:

```typescript
type AgentWorkflowState = 
  | { step: 'pending'; jobId: string }
  | { step: 'running'; jobId: string; startedAt: string }
  | { step: 'waiting_approval'; jobId: string; trustGate: string }
  | { step: 'completed'; jobId: string; output: unknown }
  | { step: 'failed'; jobId: string; error: FlowError; retryable: boolean };

// Agent A triggers Agent B via:
await orchestrator.enqueue({
  agentId: 'calendar',
  payload: { causationId: signal.id, ... },
  // pg-boss handles retry, delay, dead-letter
});
```

- State transitions are recorded as agent signals (immutable).
- pg-boss handles retry semantics (configurable per agent: count, delay, backoff).
- Dead-letter queue monitored. Failed jobs > 3 retries = P1 incident.
- Agents never call each other directly — always through orchestrator.enqueue().

### Process Patterns

**Error Handling Patterns:**
- All errors flow through `FlowError` discriminated union — never raw `Error` across package boundaries
- Server Actions: return `{ success: false, error: ... }` — never `throw` for business errors
- React Error Boundaries: per-agent in inbox — one agent crash doesn't kill the page
- Agent errors: `retryable: boolean` flag + circuit breaker — 5 failures → 60s open
- Logging: structured JSON via `packages/agents/shared/audit-writer` — `{ agentId, action, tenantId, correlationId }`
- User-facing messages: map `FlowError.type` → friendly string at component boundary, never expose `error.code` directly

**Loading State Patterns:**
- Per-component loading states — no global loading spinner
- Skeleton UI for initial loads, inline spinners for mutations
- Optimistic UI for trust approval actions (300ms assumed success)
- Agent inbox: streaming loading indicator during agent reasoning expansion

**Optimistic Update Testing Trinity (mandatory for all optimistic paths):**

Every Server Action with optimistic update must have tests for:

1. **Happy path:** Server confirms prediction → state consistent
2. **Conflict path:** Server returns different data → rollback + reconciliation
3. **Race path:** Second mutation while first in flight → state converges

**200-Line File Limit — enforcement:**
- Counts source lines only (excludes blank lines, comments, import statements, type-only exports)
- Test files exempt — no limit
- Enforcement: ESLint `max-lines` rule with `error` severity on source files
- Decomposition pattern: complex actions split into `{action-name}/validate.ts`, `persist.ts`, `notify.ts`
- When NOT to decompose: cohesive components where splitting hurts readability. Use judgment.

### Testing Patterns

**Mock Boundary Table (explicit, enforced):**

| Layer | Unit Tests | Integration Tests | Why |
|-------|-----------|-------------------|-----|
| External AI APIs (Vercel AI SDK) | **Mock** | **Mock** | Non-deterministic, costs money, slow |
| Supabase Auth | **Mock** | **Real** | Auth is stable; test selectively |
| Supabase DB + RLS | **Mock** | **Real** | RLS must be tested against real DB |
| pg-boss | **Mock** | **Real** | Job semantics matter in integration |
| Next.js cache/revalidation | **Extract policy, mock mechanism** | **Real** | Test the policy, not the runtime |
| Jotai atoms | **Never mock** | **Never mock** | Atoms are state; test directly |
| Stripe API | **Mock** | **Mock** | Use Stripe test mode in staging |
| Gmail/Calendar APIs | **Mock** | **Mock** | Non-deterministic, rate-limited |

**Test Database Provisioning:**

```typescript
// packages/test-utils/src/tenant-factory.ts

type TenantConfig = {
  plan: 'free' | 'professional' | 'agency';
  roles: Array<'owner' | 'admin' | 'member'>;
  agents: AgentId[];
  clients?: Array<{ name: string; email: string }>;
  trustOverrides?: Partial<TrustMatrix>;
};

export async function createTestTenant(config: TenantConfig): Promise<{
  tenantId: string;
  users: Record<string, SupabaseClient>;  // keyed by role
  clients: Array<{ id: string; name: string }>;
  cleanup: () => Promise<void>;
}> {
  // Creates fully provisioned tenant with authenticated Supabase clients
  // Each test suite gets own tenant. No shared mutable state.
}
```

- Factory-based, not static fixtures. Composable: `createTestTenant({ plan: 'agency', clients: [...] })`.
- Each test gets own tenant scope. No shared mutable state between tests.
- RLS tested against real database, real authenticated roles.

**RLS Test Matrix (P0 gate, auto-generated per table):**

Every workspace-scoped table gets an RLS test matrix:

| Table | Actor | Tenant | Can Read? | Can Write? | Can Delete? |
|-------|-------|--------|-----------|------------|-------------|
| `clients` | VA (own tenant) | Same | ✅ | ✅ | ❌ |
| `clients` | VA (other tenant) | Different | ❌ | ❌ | ❌ |
| `clients` | ClientUser (self) | Own record | ✅ (limited) | ✅ (limited) | ❌ |
| `clients` | Service role | Any | ✅ | ✅ | ✅ |

- New table or policy change → matrix updates → failure blocks merge (P0).
- pgTAP in CI. Seeds two tenants, asserts zero cross-visibility per PR.

**Agent Contract Tests:**

Every agent pair needs a contract test asserting Agent A's output schema matches Agent B's expected input schema:

```typescript
// packages/agents/__tests__/agent-contracts.test.ts

const agentPairs: Array<[AgentId, AgentId]> = [
  ['inbox', 'calendar'],      // inbox categorized → calendar scheduling
  ['calendar', 'weekly-report'], // calendar events → weekly report
  ['time-integrity', 'ar-collection'], // time anomalies → AR collection
  // ... all pairs with data flow
];

test.each(agentPairs)('%s output satisfies %s input schema', (from, to) => {
  const outputSchema = getAgentOutputSchema(from);
  const inputSchema = getAgentInputSchema(to);
  // Assert: every valid output is accepted by input (or explicitly rejected with typed error)
});
```

**Job Handler Testability (3 levels per agent):**

1. **Unit:** Handler function receives typed payload, returns typed result. Pure logic, no pg-boss dependency.
2. **Integration:** Harness submits job, polls for completion, asserts final state. Uses test database.
3. **Contract:** Agent A's output matches Agent B's expected input (see above).

**Chaos Test Convention:**

For every multi-agent pipeline, one test injects failure at each agent boundary and asserts the system reaches a known recovery state — not a crash, not silent data loss, a known recoverable state.

**Test Performance Budgets:**

| Suite | Target | Escalation if exceeded |
|-------|--------|----------------------|
| Unit tests | < 30s | Refactor slow tests |
| RLS test matrix | < 2min | Parallelize per table |
| Integration tests | < 5min | Review mock boundaries |
| E2E smoke | < 10min | Reduce to critical paths |
| Full CI gate (T0) | < 3min | Cut from T0, move to T1 |
| Full CI gate (T1) | < 10min | Review suite composition |
| Full CI gate (T2) | < 20min | Acceptable |

### Enforcement Guidelines

**All AI Agents MUST:**
- Use `snake_case` for all database identifiers (tables, columns, indexes, constraints)
- Use `camelCase` for all TypeScript identifiers (variables, functions, types)
- Use `kebab-case` for all file and directory names (except React components)
- Use `PascalCase` for React component file names matching the component export
- Return `ActionResult<T>` from every Server Action — no exceptions
- Construct `FlowError` (never `Error`) for all error paths
- Import from package boundaries only — never reach into internal file structure of other packages
- Validate inputs at every network/agent boundary with Zod schemas (see validation table)
- Include `workspace_id` (from session/JWT) on every tenant-scoped query — never from URL params
- Represent all monetary values as integer cents — `formatCents()` at display boundary only
- Co-locate test files with source files — `*.test.ts(x)` naming
- Keep source files under 200 lines (tests exempt, imports/comments/blank lines excluded)
- Use `invalidateAfterMutation()` from `packages/db/` — never call `revalidateTag()` directly
- Scope cache tags to workspace: `entity:{workspaceId}`, never bare entity names
- Test all optimistic updates against the trinity (happy, conflict, race)

**Pattern Enforcement:**
- ESLint `no-restricted-imports` — agent boundary rules, package DAG
- ESLint `max-lines` rule — `error` severity on source files (tests exempt)
- TypeScript `strict: true` — no `any`, no `@ts-ignore`
- Zod validation at Server Action and agent entry points — type-safe after parse
- CI DAG assertion — `agent-dependencies.json` checked on every PR
- pgTAP regression suite — RLS policy snapshots per table, P0 blocking
- Agent contract tests — Zod schema compatibility between every agent pair
- Code review checklist: naming, ActionResult return, FlowError construction, cache tag scoping, validation boundary

### Pattern Examples

**Good Examples:**

```typescript
// Server Action — correct pattern
'use server'
import { createInvoiceSchema } from '@flow/types'
import { ActionResult, FlowError } from '@flow/types'
import { requireTenantContext } from '@flow/db'
import { invalidateAfterMutation } from '@flow/db'

export async function createInvoice(
  input: unknown
): Promise<ActionResult<Invoice>> {
  const ctx = requireTenantContext()
  const parsed = createInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: {
        type: 'validation',
        code: 'INVALID_INPUT',
        field: parsed.error.issues[0].path.join('.'),
        constraint: parsed.error.issues[0].message,
      },
    }
  }
  // ... persist, invalidate, return
  await invalidateAfterMutation('invoice', 'create', ctx.tenantId)
  return { success: true, data: invoice }
}

// Atom definition — correct pattern
export const trustViewportAtom = atom<Map<AgentId, TrustState>>(new Map())

// Monetary display — correct boundary
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// Cache policy — testable pure function
export function getRevalidationTags(
  entity: 'invoice',
  mutation: 'create',
  tenantId: string
): CacheTag[] {
  return [`invoices:${tenantId}`]
}
```

**Anti-Patterns:**

```typescript
// ❌ Throwing instead of ActionResult
throw new Error('Invoice creation failed')

// ❌ Float for money
const total = 99.99

// ❌ Cross-agent import
import { categorizeEmail } from '../inbox/executor'

// ❌ workspace_id from URL
const workspaceId = params.workspaceId

// ❌ Untyped any
function process(data: any) { ... }

// ❌ revalidateTag directly instead of cache policy
revalidateTag('invoices')  // missing tenant scope!

// ❌ Class-based errors (breaks across Turborepo packages)
class InvoiceError extends Error { ... }

// ❌ useEffect for data fetching
useEffect(() => { fetch('/api/invoices').then(...) }, [])

// ❌ revalidatePath instead of revalidateTag
revalidatePath('/invoices')

// ❌ Bare cache tag without tenant scope
revalidateTag('invoices')  // should be 'invoices:{workspaceId}'
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
flow/
├── .github/
│   └── workflows/
│       ├── t0-push.yml                  # <3min: typecheck, lint, format, unit tests
│       ├── t1-pr.yml                    # <10min: + RLS pgTAP, API integration, Docker Supabase
│       └── t2-merge.yml                 # <20min: + E2E smoke, financial paths, cross-agent
├── tools/                               # repo-level operational scripts
│   ├── hooks/
│   │   └── pre-push.sh                  # turbo --filter=[HEAD^] typecheck+lint
│   ├── migrations/
│   │   └── generate-migration.sh        # migration scaffolding from domain template
│   ├── seed/
│   │   └── generate-seed.ts             # seed data generator from tenant config
│   └── ci/
│       └── budget-enforcer.ts           # track suite duration, fail at budget+20%
├── tests/
│   └── chaos/                           # nightly resilience tests (not CI-gating)
│       ├── agent-failure-recovery.ts
│       ├── db-connection-exhaustion.ts
│       └── llm-provider-fallback.ts
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/                  # FR69-73: Onboarding
│       │   │   ├── login/
│       │   │   │   └── page.tsx         # magic link + Google OAuth
│       │   │   ├── callback/
│       │   │   │   └── route.ts         # Supabase auth callback
│       │   │   └── setup/               # FR70: Setup wizard
│       │   │       ├── page.tsx
│       │   │       └── actions.ts       # completeOnboardingSetup
│       │   ├── (workspace)/             # Editor's Desk — dark theme
│       │   │   ├── layout.tsx           # dark ThemeProvider, requireAuth, sidebar
│       │   │   ├── page.tsx             # FR74: Home dashboard
│       │   │   ├── inbox/               # FR28a-28h: Agent Inbox
│       │   │   │   ├── page.tsx         # agent inbox grid (6 agent lanes)
│       │   │   │   ├── [agentId]/
│       │   │   │   │   └── page.tsx     # single agent detail
│       │   │   │   └── actions.ts       # re-exports from lib/actions/inbox
│       │   │   ├── calendar/            # FR28i-28o: Calendar
│       │   │   │   ├── page.tsx
│       │   │   │   └── actions.ts
│       │   │   ├── agents/              # FR17-28: Agent configuration
│       │   │   │   ├── page.tsx         # agent roster + trust dashboard
│       │   │   │   ├── [agentId]/
│       │   │   │   │   ├── page.tsx     # agent detail + trust history
│       │   │   │   │   └── actions.ts
│       │   │   │   └── actions.ts
│       │   │   ├── clients/             # FR11-16: Client CRUD
│       │   │   │   ├── page.tsx
│       │   │   │   ├── [clientId]/
│       │   │   │   │   ├── page.tsx     # client detail + engagement timeline
│       │   │   │   │   └── actions.ts
│       │   │   │   └── actions.ts
│       │   │   ├── invoices/            # FR35-45: Invoicing
│       │   │   │   ├── page.tsx
│       │   │   │   ├── new/
│       │   │   │   │   ├── page.tsx     # invoice editor (BlockNote)
│       │   │   │   │   └── actions.ts   # re-exports from lib/actions/invoices
│       │   │   │   ├── [invoiceId]/
│       │   │   │   │   ├── page.tsx     # invoice detail + Stripe status
│       │   │   │   │   └── actions.ts
│       │   │   │   └── actions.ts
│       │   │   ├── time/                # FR46-50: Time Tracking
│       │   │   │   ├── page.tsx         # timer + entries list
│       │   │   │   └── actions.ts
│       │   │   ├── reports/             # FR63-68: Reporting
│       │   │   │   ├── page.tsx
│       │   │   │   ├── [reportId]/
│       │   │   │   │   └── page.tsx
│       │   │   │   └── actions.ts
│       │   │   ├── settings/            # FR1-10: Workspace settings
│       │   │   │   ├── page.tsx         # workspace settings (tabs)
│       │   │   │   ├── team/            # FR7-10: Team management
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── billing/         # FR55-62: Subscription
│       │   │   │   │   ├── page.tsx     # tier + usage + Stripe portal
│       │   │   │   │   └── actions.ts
│       │   │   │   └── actions.ts
│       │   │   └── notifications/       # FR79-82: Notifications
│       │   │       └── page.tsx
│       │   ├── (portal)/[slug]/         # Gentle Rhythm — branded light theme
│       │   │   ├── layout.tsx           # PortalThemeProvider, portalAuth, brand tokens
│       │   │   ├── overview/            # FR51: Portal overview
│       │   │   │   └── page.tsx
│       │   │   ├── invoices/            # FR52: Portal invoices
│       │   │   │   ├── page.tsx
│       │   │   │   └── [invoiceId]/
│       │   │   │       └── page.tsx
│       │   │   ├── projects/            # FR53: Portal projects
│       │   │   │   └── page.tsx
│       │   │   └── messages/            # FR54: Portal messages
│       │   │       ├── page.tsx
│       │   │       └── actions.ts       # re-exports from lib/actions/portal
│       │   ├── api/                     # Route Handlers (webhooks only)
│       │   │   ├── webhooks/
│       │   │   │   ├── stripe/
│       │   │   │   │   └── route.ts
│       │   │   │   ├── gmail/
│       │   │   │   │   └── route.ts
│       │   │   │   ├── google-calendar/
│       │   │   │   │   └── route.ts
│       │   │   │   └── trigger-dev/
│       │   │   │       └── route.ts
│       │   │   └── auth/
│       │   │       └── callback/
│       │   │           └── route.ts
│       │   ├── layout.tsx               # root layout (fonts, globals)
│       │   └── globals.css              # Tailwind base + token definitions
│       ├── lib/                          # shared server-side logic
│       │   ├── actions/                  # Server Action implementations (shared by route groups)
│       │   │   ├── invoices/
│       │   │   │   ├── create-invoice.ts
│       │   │   │   ├── create-invoice/   # decomposed sub-modules
│       │   │   │   │   ├── validate.ts
│       │   │   │   │   ├── trust-check.ts
│       │   │   │   │   ├── persist.ts
│       │   │   │   │   └── notify.ts
│       │   │   │   ├── send-invoice.ts
│       │   │   │   └── index.ts
│       │   │   ├── inbox.ts
│       │   │   ├── clients.ts
│       │   │   ├── portal.ts
│       │   │   └── index.ts
│       │   └── protected-handler.ts     # factory: wraps Route Handlers with RLS+auth
│       ├── middleware.ts                 # subdomain→route group + requireTenantContext
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── playwright.config.ts          # retry: 1, trace: 'on-first-retry'
│       ├── tests/                        # E2E tests
│       │   ├── auth.spec.ts
│       │   ├── inbox.spec.ts
│       │   ├── invoicing.spec.ts
│       │   ├── portal.spec.ts
│       │   ├── rls-isolation.spec.ts     # P0: cross-tenant contamination at app layer
│       │   ├── trust-graduation.spec.ts
│       │   └── cross-tenant-contamination.spec.ts  # P0: tenant A cannot see tenant B
│       └── package.json
├── packages/
│   ├── ui/                              # shadcn + domain components + theme + layouts
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn primitives (auto-generated, never hand-edit)
│   │   │   ├── agent-card.tsx
│   │   │   ├── agent-card.test.tsx
│   │   │   ├── trust-badge.tsx
│   │   │   ├── trust-badge.test.tsx
│   │   │   ├── timer-display.tsx
│   │   │   ├── timer-display.test.tsx
│   │   │   ├── invoice-status.tsx
│   │   │   ├── invoice-status.test.tsx
│   │   │   ├── client-health.tsx
│   │   │   ├── client-health.test.tsx
│   │   │   ├── command-palette.tsx
│   │   │   ├── command-palette.test.tsx
│   │   │   └── notification-bell.tsx
│   │   ├── layouts/                     # shared shell components for both route groups
│   │   │   ├── workspace-shell.tsx      # sidebar + topbar + agent status strip
│   │   │   ├── workspace-shell.test.tsx
│   │   │   ├── portal-shell.tsx         # branded header + client nav
│   │   │   ├── portal-shell.test.tsx
│   │   │   ├── sidebar.tsx              # agent-aware sidebar (hides on free tier)
│   │   │   ├── sidebar.test.tsx
│   │   │   └── index.ts
│   │   ├── theme/
│   │   │   ├── tokens.ts               # semantic + emotional + brand tokens
│   │   │   ├── tokens.test.ts
│   │   │   ├── workspace-provider.tsx
│   │   │   ├── portal-provider.tsx
│   │   │   ├── agent-colors.ts          # 6 permanent HSL agent identity colors
│   │   │   └── index.ts
│   │   ├── index.ts
│   │   └── package.json
│   ├── trust/                           # FR29-34: Trust system
│   │   ├── src/
│   │   │   ├── scoring.ts
│   │   │   ├── scoring.test.ts
│   │   │   ├── graduation.ts
│   │   │   ├── graduation.test.ts
│   │   │   ├── viewport.ts
│   │   │   ├── viewport.test.ts
│   │   │   ├── cadence.ts
│   │   │   ├── cadence.test.ts
│   │   │   ├── rollback.ts
│   │   │   ├── rollback.test.ts
│   │   │   ├── pre-check.ts
│   │   │   ├── pre-check.test.ts
│   │   │   ├── middleware.ts            # trust gate factory for route handlers
│   │   │   ├── middleware.test.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── editor/                          # FR35,63: BlockNote editor
│   │   ├── src/
│   │   │   ├── block-editor.tsx
│   │   │   ├── block-editor.test.tsx
│   │   │   ├── extensions/
│   │   │   │   ├── trust-highlight.ts
│   │   │   │   └── version-marker.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── types/                           # Zod schemas + inferred types ONLY (zero runtime deps)
│   │   ├── src/
│   │   │   ├── action-result.ts         # ActionResult<T> discriminated union
│   │   │   ├── flow-error.ts           # FlowError discriminated union
│   │   │   ├── agents.ts               # AgentId, AgentSignal, AgentWorkflowState
│   │   │   ├── trust.ts                # TrustTier, TrustMatrix, TrustAction
│   │   │   ├── invoice.ts              # Invoice, InvoiceStatus, createInvoiceSchema
│   │   │   ├── client.ts               # Client, ClientHealth
│   │   │   ├── workspace.ts            # Workspace, WorkspaceMember, Role
│   │   │   ├── subscription.ts         # Plan, TierLimits, SubscriptionState
│   │   │   ├── time-tracking.ts        # TimeEntry, TimerState
│   │   │   ├── audit.ts                # AuditLog, AuditEvent
│   │   │   └── index.ts
│   │   └── package.json
│   ├── state/                           # Jotai atoms + realtime infrastructure
│   │   ├── src/
│   │   │   ├── atoms/
│   │   │   │   ├── trust-viewport.ts   # trustViewportAtom family
│   │   │   │   ├── agent-inbox.ts      # agentInboxAtom, selectedAgentAtom
│   │   │   │   ├── notifications.ts    # toastQueueAtom, unreadCountAtom
│   │   │   │   ├── ui-state.ts         # sidebarOpenAtom, activeModalAtom
│   │   │   │   ├── polling.ts          # atomWithConfigurableInterval
│   │   │   │   └── index.ts
│   │   │   ├── realtime/
│   │   │   │   ├── polling-layer.ts    # configurable intervals: 5s/10s/30s
│   │   │   │   ├── reconciler.ts       # merge updates, dedupe by event ID
│   │   │   │   ├── backoff.ts          # exponential 1s→30s, reset on mutation
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── db/                              # Supabase client + RLS + cache policy + queries
│   │   ├── src/
│   │   │   ├── client.ts               # createClient (browser + server)
│   │   │   ├── client.test.ts
│   │   │   ├── rls-helpers.ts          # requireTenantContext(), setTenantContext()
│   │   │   ├── rls-helpers.test.ts
│   │   │   ├── cache-policy.ts         # getRevalidationTags(), invalidateAfterMutation()
│   │   │   ├── cache-policy.test.ts
│   │   │   ├── queries/                # domain-structured query builders
│   │   │   │   ├── invoices/
│   │   │   │   │   ├── drafts.ts
│   │   │   │   │   ├── drafts.test.ts
│   │   │   │   │   ├── submissions.ts
│   │   │   │   │   ├── submissions.test.ts
│   │   │   │   │   ├── aging.ts
│   │   │   │   │   ├── aging.test.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── clients/
│   │   │   │   │   ├── crud.ts
│       │   │   │   │   ├── crud.test.ts
│   │   │   │   │   ├── health.ts
│   │   │   │   │   ├── health.test.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── workspaces/
│   │   │   │   │   ├── members.ts
│   │   │   │   │   ├── members.test.ts
│   │   │   │   │   ├── settings.ts
│   │   │   │   │   ├── settings.test.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── agents/
│   │   │   │   │   ├── runs.ts
│   │   │   │   │   ├── runs.test.ts
│   │   │   │   │   ├── signals.ts
│   │   │   │   │   ├── signals.test.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── time-entries/
│   │   │   │   │   ├── entries.ts
│   │   │   │   │   ├── entries.test.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── index.ts            # re-exports all domain barrels
│   │   │   └── index.ts
│   │   └── package.json
│   ├── agents/                          # 6 agent modules + orchestrator (single package)
│   │   ├── orchestrator/
│   │   │   ├── types.ts                # AgentOrchestrator interface (~40 lines)
│   │   │   ├── pg-boss.ts              # PgBossOrchestrator implementation
│   │   │   ├── pg-boss.test.ts
│   │   │   ├── factory.ts              # createOrchestrator()
│   │   │   └── index.ts
│   │   ├── shared/                      # ONLY types, schemas, agent protocol, shared utilities
│   │   │   ├── trust-client.ts         # trust matrix reader for agents
│   │   │   ├── trust-client.test.ts
│   │   │   ├── pii-tokenizer.ts
│   │   │   ├── pii-tokenizer.test.ts
│   │   │   ├── audit-writer.ts
│   │   │   ├── audit-writer.test.ts
│   │   │   ├── llm-router.ts           # Vercel AI SDK multi-provider routing
│   │   │   ├── llm-router.test.ts
│   │   │   ├── circuit-breaker.ts
│   │   │   ├── circuit-breaker.test.ts
│   │   │   └── index.ts                # explicit re-exports ONLY — nothing else
│   │   ├── inbox/                       # FR28a-28h: Inbox Agent
│   │   │   ├── executor.ts
│   │   │   ├── executor.test.ts
│   │   │   ├── pre-check.ts
│   │   │   ├── pre-check.test.ts
│   │   │   ├── schemas.ts
│   │   │   ├── schemas.test.ts
│   │   │   ├── voice-profiles.ts
│   │   │   ├── voice-profiles.test.ts
│   │   │   ├── gmail-provider.ts
│   │   │   ├── gmail-provider.test.ts
│   │   │   ├── __tests__/
│   │   │   │   └── integration.test.ts  # agent + db + orchestrator
│   │   │   └── index.ts
│   │   ├── calendar/                    # FR28i-28o: Calendar Agent
│   │   │   ├── executor.ts
│   │   │   ├── executor.test.ts
│   │   │   ├── pre-check.ts
│   │   │   ├── pre-check.test.ts
│   │   │   ├── schemas.ts
│   │   │   ├── schemas.test.ts
│   │   │   ├── conflict-detection.ts
│   │   │   ├── conflict-detection.test.ts
│   │   │   ├── gcal-provider.ts
│   │   │   ├── gcal-provider.test.ts
│   │   │   ├── __tests__/
│   │   │   │   └── integration.test.ts
│   │   │   └── index.ts
│   │   ├── ar-collection/              # AR Collection Agent (free tier first agent)
│   │   │   ├── executor.ts
│   │   │   ├── executor.test.ts
│   │   │   ├── pre-check.ts
│   │   │   ├── pre-check.test.ts
│   │   │   ├── schemas.ts
│   │   │   ├── schemas.test.ts
│   │   │   ├── __tests__/
│   │   │   │   └── integration.test.ts
│   │   │   └── index.ts
│   │   ├── weekly-report/
│   │   │   ├── executor.ts
│   │   │   ├── executor.test.ts
│   │   │   ├── pre-check.ts
│   │   │   ├── pre-check.test.ts
│   │   │   ├── schemas.ts
│   │   │   ├── schemas.test.ts
│   │   │   ├── __tests__/
│   │   │   │   └── integration.test.ts
│   │   │   └── index.ts
│   │   ├── client-health/
│   │   │   ├── executor.ts
│   │   │   ├── executor.test.ts
│   │   │   ├── pre-check.ts
│   │   │   ├── pre-check.test.ts
│   │   │   ├── schemas.ts
│   │   │   ├── schemas.test.ts
│   │   │   ├── __tests__/
│   │   │   │   └── integration.test.ts
│   │   │   └── index.ts
│   │   ├── time-integrity/
│   │   │   ├── executor.ts
│   │   │   ├── executor.test.ts
│   │   │   ├── pre-check.ts
│   │   │   ├── pre-check.test.ts
│   │   │   ├── schemas.ts
│   │   │   ├── schemas.test.ts
│   │   │   ├── anomaly-detection.ts
│   │   │   ├── anomaly-detection.test.ts
│   │   │   ├── __tests__/
│   │   │   │   └── integration.test.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   │   ├── agent-contracts.test.ts  # inter-agent schema compatibility
│   │   │   └── cross-agent/             # multi-agent chain integration tests
│   │   │       ├── inbox-to-calendar.test.ts
│   │   │       ├── time-to-ar-collection.test.ts
│   │   │       └── calendar-to-weekly-report.test.ts
│   │   └── package.json
│   ├── test-utils/                      # shared test infrastructure (sub-adapters)
│   │   ├── src/
│   │   │   ├── core/                    # shared matchers, factory helpers (no pkg deps)
│   │   │   │   ├── wait-for.ts          # waitForCondition() async utility
│   │   │   │   ├── wait-for.test.ts
│   │   │   │   ├── matchers.ts          # custom Vitest matchers
│   │   │   │   └── index.ts
│   │   │   ├── db/                      # database test harness (imports @flow/db, @flow/types)
│   │   │   │   ├── tenant-factory.ts   # createTestTenant() + cleanup guarantee
│   │   │   │   ├── tenant-factory.test.ts
│   │   │   │   ├── rls-fixture.ts      # setupRLSFixture(tenantId, role)
│   │   │   │   ├── rls-test-suite.ts   # auto-generated RLS matrix per table
│   │   │   │   └── index.ts
│   │   │   ├── agents/                  # agent test harness (imports @flow/agents, @flow/types)
│   │   │   │   ├── agent-harness.ts    # JobTestHarness for agent integration tests
│   │   │   │   ├── agent-contracts.ts  # inter-agent schema contract assertions
│   │   │   │   ├── llm-mock.ts         # deterministic LLM response mock
│   │   │   │   └── index.ts
│   │   │   ├── ui/                      # UI test helpers (imports @flow/state, @flow/ui)
│   │   │   │   ├── test-app.ts         # createTestApp() — Playwright + Jotai provider
│   │   │   │   ├── render-with-atoms.tsx  # render helper with Jotai Provider
│   │   │   │   └── index.ts
│   │   │   └── index.ts                # barrel re-exports core/ only
│   │   └── package.json
│   └── config/                          # shared build/config
│       ├── eslint/
│       │   ├── base.js
│       │   └── no-restricted-imports.js # agent DAG + boundary enforcement
│       ├── typescript/
│       │   ├── base.json                # strict, no any, no ts-ignore
│       │   ├── next.json
│       │   └── react-library.json
│       ├── tailwind/
│       │   └── preset.ts
│       ├── vitest/
│       │   └── shared.ts
│       ├── src/
│       │   ├── env.ts                   # centralized env parser (Zod)
│       │   ├── env.test.ts
│       │   └── index.ts
│       └── package.json
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 00000001_workspaces.sql
│   │   ├── 00000002_clients.sql
│   │   ├── 00000003_invoices.sql
│   │   ├── 00000004_time-tracking.sql
│   │   ├── 00000005_subscriptions.sql
│   │   ├── 00000006_trust.sql
│   │   ├── 00000007_agents.sql
│   │   ├── 00000008_portal.sql
│   │   ├── 00000009_audit.sql
│   │   ├── 00000010_app-config.sql
│   │   └── 00000011_rls-policies.sql
│   ├── tests/
│   │   ├── rls_workspaces.sql
│   │   ├── rls_clients.sql
│   │   ├── rls_invoices.sql
│   │   ├── rls_time-entries.sql
│   │   ├── rls_agent-runs.sql
│   │   ├── rls_portal.sql
│   │   ├── rls_audit.sql
│   │   └── migrations/
│   │       └── rollback.test.ts         # apply all migrations, reverse one by one
│   └── seed.sql
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
└── README.md
```

### Structural Refinements (Roundtable Consensus)

**`packages/types/` stays pure** — zero runtime dependencies. Only TypeScript interfaces, Zod schemas, and discriminated unions. Atoms and realtime infrastructure moved to `packages/state/` to prevent dependency graph contamination.

**`packages/state/` absorbs atoms + realtime** — Jotai atoms and polling/reconciliation infrastructure are runtime concerns with their own dependency chain (jotai, react). Separating from types keeps the dependency graph clean: `config → types → db → state → web`.

**`apps/web/lib/` for shared Server Actions** — Route-level `actions.ts` files are thin re-exports. Implementation lives in `lib/actions/` to prevent duplication between (workspace) and (portal) route groups.

**`packages/ui/layouts/` for shared shells** — workspace-shell, portal-shell, sidebar extracted as UI primitives. Both route groups import from one location.

**`packages/db/queries/` domain-structured** — each domain gets its own directory with barrel. Prevents flat-directory navigation breakdown as query complexity grows.

**`packages/test-utils/` sub-adapters** — `core/` (no package deps), `db/` (imports @flow/db), `agents/` (imports @flow/agents), `ui/` (imports @flow/state). Barrel re-exports `core/` only. Consumers import specific adapters to avoid circular deps.

**`tools/` at repo root** — migration generators, seed scripts, CI budget enforcer, pre-push hooks. Operational scripts, not package concerns.

**`tests/chaos/` at repo root** — nightly resilience tests. Not CI-gating. Agent failure recovery, DB connection exhaustion, LLM provider fallback.

**`packages/agents/__tests__/cross-agent/`** — multi-agent chain integration tests. Inbox→Calendar, Time→AR-Collection, Calendar→Weekly-Report.

**`supabase/tests/migrations/rollback.test.ts`** — applies all migrations, reverses one by one. Production safety net.

**`apps/web/tests/cross-tenant-contamination.spec.ts`** — P0 E2E test: tenant A cannot see tenant B's data via any API surface. Tests enforcement, not just policy.

**`apps/web/lib/protected-handler.ts`** — factory function wrapping Route Handlers with RLS+auth. Makes it impossible to create a webhook handler without tenant validation.

**`packages/trust/middleware.ts`** — trust gate factory for route handlers. Imported by every route that needs trust-level enforcement.

### Architectural Boundaries

**API Boundaries:**

| Boundary | Technology | Pattern |
|----------|-----------|---------|
| User mutations | Server Actions (`lib/actions/`) | Zod-validated, `ActionResult<T>` return |
| External webhooks | Route Handlers (`/api/webhooks/*`) | `protectedHandler()` wrapper + signature verification |
| Agent execution | pg-boss job queue | `orchestrator.enqueue()` → agent `execute()` |
| LLM calls | Vercel AI SDK | `streamText()` in Route Handlers, `generateText()` in agents |
| Scheduled jobs | Trigger.dev | Morning Brief, nightly audit scan, subscription renewal |

**Component Boundaries:**

```
┌─────────────────────────────────────────────────────────┐
│ apps/web (Next.js)                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ (workspace)/ │  │  (portal)/   │  │   api/       │  │
│  │  dark theme  │  │  branded     │  │  webhooks    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│  ┌──────┴─────────────────┴──────────────────┘         │
│  │ lib/actions/ ← shared implementations               │
│  │ lib/protected-handler ← RLS+auth factory             │
│  └─────────────────────────────────────────────────────┘
│         │            │            │            │
│  ┌──────┴────────────┴────────────┴─────────────────┐  │
│  │ packages/ui ← components + layouts (trust as props)│  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │            │            │            │
    ┌────┴──┐   ┌────┴──┐   ┌────┴──┐   ┌────┴──────┐
    │ trust │   │  db   │   │ state │   │  agents   │
    └───────┘   └───────┘   └───────┘   └───────────┘
         │           │            │
    ┌────┴───────────┴────────────┘
    │ types (zero runtime deps)
    └──────────────────────────────
```

**Import DAG (enforced by ESLint `no-restricted-imports`):**

```
config → types → db → trust → agents → web
              types → state → web
              types → db → web
              types → test-utils/core
        db → test-utils/db
        agents → test-utils/agents
        state → test-utils/ui

FORBIDDEN:
  agents/inbox → agents/calendar    (agent-to-agent)
  agents/* → orchestrator/*         (agents use interface only)
  ui/ → trust/                      (components get trust via props)
  web/ → agents/*                   (web talks to orchestrator via lib/)
  types/ → ANY runtime package      (types is zero-dep)
  agents/shared/ → agents/{module}/ (shared is upstream only)
```

**Data Boundaries:**

| Boundary | Access Pattern | Isolation |
|----------|---------------|-----------|
| Tenant data | `workspace_id` on every query, derived from JWT | RLS policy per table |
| Agent signals | Immutable insert-only via `packages/db` | Correlation ID scoped to tenant |
| Financial state | Integer cents, idempotency keys | Stripe reconciliation job |
| Audit log | Append-only, hash chain | P0 integrity, 7yr retention |
| Trust matrix | Sparse jsonb, versioned snapshots | Read at agent start, write on graduation |

### Requirements to Structure Mapping

**FR Domain → Directory Mapping:**

| FR Domain | Server Pages | Shared Actions | Queries | Agent Module |
|-----------|-------------|----------------|---------|-------------|
| FR1-10: Workspace & Users | `(workspace)/settings/` | `lib/actions/` | `db/queries/workspaces/` | — |
| FR11-16: Clients | `(workspace)/clients/` | `lib/actions/clients.ts` | `db/queries/clients/` | `agents/client-health/` |
| FR17-28: Agent System | `(workspace)/agents/`, `inbox/` | `lib/actions/inbox.ts` | `db/queries/agents/` | All 6 agent modules |
| FR29-34: Trust | `(workspace)/agents/[agentId]/` | `lib/actions/` | — | `trust/`, `agents/shared/trust-client.ts` |
| FR35-45: Invoicing | `(workspace)/invoices/` | `lib/actions/invoices/` | `db/queries/invoices/` | `agents/ar-collection/` |
| FR46-50: Time Tracking | `(workspace)/time/` | `lib/actions/` | `db/queries/time-entries/` | `agents/time-integrity/` |
| FR51-54: Client Portal | `(portal)/[slug]/` | `lib/actions/portal.ts` | — | — |
| FR55-62: Subscription | `(workspace)/settings/billing/` | `lib/actions/` | `db/queries/` | — |
| FR63-68: Reporting | `(workspace)/reports/` | `lib/actions/` | — | `agents/weekly-report/` |
| FR69-73: Onboarding | `(auth)/setup/` | `lib/actions/` | — | — |
| FR74-78: Dashboard | `(workspace)/page.tsx` | — | — | `ui/command-palette.tsx` |
| FR79-82: Notifications | `(workspace)/notifications/` | — | — | `state/atoms/notifications.ts` |
| FR83-96: Error/Concurrency | middleware, error boundaries | `lib/protected-handler.ts` | — | `agents/shared/circuit-breaker.ts` |
| FR97-99: Accessibility | All pages | — | — | `ui/` (ARIA, focus) |
| FR100-102: Analytics | `(workspace)/` dashboard | — | — | — |

**Cross-Cutting Concerns → Location:**

| Concern | Primary Location | Secondary |
|---------|-----------------|-----------|
| Multi-tenant RLS | `supabase/migrations/`, `supabase/tests/` | `db/rls-helpers.ts`, `web/lib/protected-handler.ts` |
| Trust state | `packages/trust/` | `state/atoms/trust-viewport.ts`, `agents/shared/trust-client.ts` |
| PII tokenization | `agents/shared/pii-tokenizer.ts` | Agent executor `preCheck()` layers |
| Audit logging | `agents/shared/audit-writer.ts` | `supabase/migrations/00000009_audit.sql` |
| Error handling | `types/flow-error.ts` | Per-route error boundaries, `middleware.ts` |
| Cache policy | `db/cache-policy.ts` | `web/lib/actions/` (calls invalidateAfterMutation) |
| Polling/realtime | `state/realtime/` | `state/atoms/polling.ts` |
| Theme tokens | `ui/theme/tokens.ts` | `ui/theme/workspace-provider.tsx`, `portal-provider.tsx` |

### Integration Points

**Internal Communication:**

```
Server Action (lib/actions/) → packages/db (query) → Supabase (RLS)
Server Action → packages/agents/orchestrator (enqueue) → pg-boss → agent execute()
Agent execute() → packages/trust (preCheck) → allow/deny
Agent execute() → packages/db (persist signal) → Supabase
Agent execute() → packages/agents/shared/llm-router → Vercel AI SDK → LLM provider
Client poll → Server Action → packages/db → state/atoms reconciliation
```

**External Integrations:**

| Integration | Entry Point | Direction | Package |
|-------------|------------|-----------|---------|
| Stripe | `/api/webhooks/stripe` | Inbound webhook | `db/`, `lib/actions/` |
| Gmail Pub/Sub | `/api/webhooks/gmail` | Inbound push | `agents/inbox/gmail-provider.ts` |
| Google Calendar | `/api/webhooks/google-calendar` | Inbound webhook | `agents/calendar/gcal-provider.ts` |
| Trigger.dev | `/api/webhooks/trigger-dev` | Inbound callback | Scheduled jobs |
| OpenAI/Anthropic | Outbound via Vercel AI SDK | Outbound API | `agents/shared/llm-router.ts` |
| Supabase Auth | OAuth callback | Inbound redirect | `middleware.ts`, `(auth)/callback/` |

**Data Flow (typical agent action):**

```
1. External event (email/calendar) → webhook Route Handler
2. Route Handler → protectedHandler() wrapper (RLS + auth)
3. → orchestrator.enqueue({ agentId, payload })
4. pg-boss picks up job → agent executor()
5. executor() → trust preCheck() → allow/deny (application-level)
6. executor() → pii-tokenizer (strip PII)
7. executor() → llm-router → LLM provider
8. executor() → preCheck() on LLM output (deterministic validation)
9. executor() → db.persist(signal record)
10. executor() → db.invalidateAfterMutation()
11. Client poll → Server Action → fresh data → Jotai reconciliation
```

### Package Dependency Graph (updated)

```
config → types → db → trust → agents → web (via lib/actions)
              types → state → web
              types → db → web
              types → test-utils/core
        db → test-utils/db
        agents → test-utils/agents
        state → test-utils/ui
                    ui → web
              editor → web
```

9 packages total: `ui`, `trust`, `editor`, `types`, `state`, `db`, `agents`, `test-utils`, `config`

### Development Workflow Integration

**Development Server:**
- `pnpm dev` → Turborepo parallel (web + Supabase local)
- `npx supabase start` → Docker-local Postgres + Auth + Storage (~15s)
- `supabase/seed.sql` → deterministic fixtures (2 tenants, 4 roles, clients, tiers)
- Hot reload across packages via Turborepo

**Pre-push hook (tools/hooks/pre-push.sh):**
- Runs `turbo run typecheck lint --filter=[HEAD^]` on changed packages
- Catches type/lint errors before CI — first feedback loop is local

**Build Process:**
- Turbo pipeline: `build` depends on `config#build` → `ui#build` → `web#build`
- `next build` handles RSC compilation, static generation, ISR
- Supabase migrations: `supabase db push` for local, `supabase db push --linked` for staging

**CI/CD Pipeline:**

| Tier | Trigger | Target | Contents |
|------|---------|--------|----------|
| T0 | Every push | <3min | Type check, lint, format, unit tests (changed packages) |
| T1 | PR open/update | <10min | + RLS pgTAP, API integration, Docker Supabase, agent contracts |
| T2 | Merge to main | <20min | + E2E smoke, financial error paths, cross-agent workflows |

- P0 gate: PRs touching `supabase/migrations/` or `db/rls-helpers.ts` → T1 blocking
- CI budget enforcer (`tools/ci/budget-enforcer.ts`): track suite duration, warn at budget, fail at budget+20%
- E2E config: retry: 1, trace: 'on-first-retry'

**Deployment:**
- Vercel auto-deploys `main` when CI green
- Branch previews on every PR
- Supabase staging: branching for pre-merge testing
- Rollback: `vercel --rollback` (< 60s)
- Migration promotion: `supabase db push --linked` after T2 green

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

All technology choices are compatible and version-aligned:
- Next.js 15 + React 19 + Supabase + Vercel AI SDK — production-proven stack
- pg-boss on Postgres — single database, no Redis dependency for MVP
- Jotai + React 19 — concurrent-compatible, fine-grained subscriptions work with RSC streaming
- Turborepo + pnpm — monorepo boundaries enforced at build time
- BlockNote + Next.js — local-only Phase 1, Hocuspocus deferred

No contradictory decisions found. All prior debates (single app vs dual, SSE vs polling, class errors vs discriminated unions) resolved with documented rationale.

**Pattern Consistency:**

- Naming conventions align across all layers: DB `snake_case`, TS `camelCase`, files `kebab-case`, components `PascalCase`
- Error handling uses discriminated unions consistently — ActionResult wraps FlowError everywhere
- Cache policy centralized in `db/cache-policy.ts` with tenant-scoped tags
- Import DAG enforced by ESLint — no circular dependency paths possible
- Test patterns consistent: co-located units, pgTAP for RLS, Playwright for E2E, sub-adapters in test-utils

**Structure Alignment:**

- 9 packages map cleanly to dependency graph with no cycles
- `types/` is zero-dep — all runtime concerns correctly separated into `state/`, `db/`, `agents/`
- `lib/actions/` in web app prevents Server Action duplication across route groups
- Agent modules self-contained with consistent internal structure (executor, pre-check, schemas, __tests__)
- Migrations map 1:1 to FR domains (11 migrations for 11 primary schemas)

### Requirements Coverage Validation ✅

**FR Coverage (102 FRs across 19 domains):**

| Domain | FRs | Covered | Location |
|--------|-----|---------|----------|
| Workspace & Users (FR1-10) | 10 | ✅ | `settings/`, `db/queries/workspaces/`, `supabase/migrations/00000001` |
| Client Management (FR11-16) | 6 | ✅ | `clients/`, `db/queries/clients/`, `agents/client-health/` |
| Agent System (FR17-28) | 12 | ✅ | `agents/`, `inbox/`, `agents/orchestrator/` |
| Inbox Agent (FR28a-28h) | 8 | ✅ | `agents/inbox/` with gmail-provider, voice-profiles |
| Calendar Agent (FR28i-28o) | 7 | ✅ | `agents/calendar/` with gcal-provider, conflict-detection |
| Trust System (FR29-34) | 6 | ✅ | `packages/trust/` with scoring, graduation, rollback, pre-check |
| Invoicing (FR35-45) | 11 | ✅ | `invoices/`, `lib/actions/invoices/`, `db/queries/invoices/`, `agents/ar-collection/` |
| Time Tracking (FR46-50) | 5 | ✅ | `time/`, `db/queries/time-entries/`, `agents/time-integrity/` |
| Client Portal (FR51-54) | 4 | ✅ | `(portal)/[slug]/`, `lib/actions/portal.ts`, `ui/theme/portal-provider.tsx` |
| Subscription (FR55-62) | 8 | ✅ | `settings/billing/`, Stripe webhooks, `supabase/migrations/00000005` |
| Reporting (FR63-68) | 6 | ✅ | `reports/`, `agents/weekly-report/`, `packages/editor/` |
| Onboarding (FR69-73) | 5 | ✅ | `(auth)/setup/`, `lib/actions/` |
| Client Engagement (FR73a-73e) | 5 | ✅ | `clients/[clientId]/` detail + engagement timeline |
| Dashboard (FR74-78) | 5 | ✅ | `(workspace)/page.tsx`, `ui/command-palette.tsx` |
| Notifications (FR79-82) | 4 | ✅ | `notifications/`, `state/atoms/notifications.ts` |
| Error Handling (FR83-87) | 5 | ✅ | `types/flow-error.ts`, `lib/protected-handler.ts`, error boundaries |
| Data & Compliance (FR88-92) | 5 | ✅ | `supabase/migrations/00000009_audit.sql`, GDPR deletion tiers |
| Concurrency (FR93-96) | 4 | ✅ | Optimistic locking, `agents/shared/circuit-breaker.ts`, idempotency |
| Accessibility (FR97-99) | 3 | ✅ | `ui/` ARIA, focus management, keyboard-first |
| Analytics (FR100-102) | 3 | ✅ | Dashboard integration |

**NFR Coverage (56 NFRs across 11 categories):**

| Category | Status | Architectural Response |
|----------|--------|----------------------|
| Performance (7) | ✅ | RSC default, optimistic UI, streaming, cache()+revalidateTag, polling intervals |
| Security (14) | ✅ | 3-layer RLS, PII tokenization, prompt injection defense (3 layers), OAuth, zero cross-tenant |
| Reliability (6) | ✅ | Circuit breaker, pg-boss retry, compensating transactions, saga pattern |
| Scalability (3) | ✅ | Supabase Team plan readiness, 100 workspace target, read replica roadmap |
| Observability (5) | ✅ | Structured JSON per agent action, correlation IDs, cost gates |
| Data Lifecycle (7) | ✅ | GDPR tiered deletion, hash-chain audit, quarterly isolation verification |
| Cost Governance (3) | ✅ | Per-workspace LLM budget, model-tier routing, daily alerts |
| Accessibility (5) | ✅ | WCAG 2.1 AA, ARIA live regions, prefers-reduced-motion |
| Integration (5) | ✅ | Stripe retry (1s/5s/30s), LLM circuit breaker, 30s timeouts |
| Onboarding (3) | ✅ | Setup wizard, pre-configured defaults, abandonment detection |
| Billing Accuracy (3) | ✅ | Usage metering ≥99.9%, Stripe reconciliation, idempotency keys |

### Implementation Readiness Validation ✅

**Decision Completeness:**
- All critical decisions documented: RLS strategy, orchestration, trust state, financial handling, error handling
- All important decisions documented: state management, real-time, caching, CI/CD, configuration
- Deferred decisions explicitly listed with trigger conditions
- Exact type signatures provided for ActionResult, FlowError, AgentSignal

**Structure Completeness:**
- Complete directory tree (~300 lines) with every file and directory named
- 11 migrations mapped to FR domains
- 6 agent modules with consistent internal structure
- 9 packages with clean dependency graph
- Import DAG with explicit FORBIDDEN list

**Pattern Completeness:**
- 23 conflict points identified and resolved
- Naming conventions across 4 layers (DB, API, code, files)
- Exact contracts for ActionResult, FlowError, AgentSignal
- Validation boundary table (what validates, what trusts)
- Mock boundary table (what to mock where)
- Good examples and anti-patterns provided
- Enforcement mechanisms specified (ESLint, CI, TypeScript strict)

### Gap Analysis Results

**Critical Gaps: None found.**

All 102 FRs and 56 NFRs have architectural support. No blocking issues remain.

**Important Gaps (not blocking, but recommended):**

1. **Environment variable catalog** — `.env.example` is mentioned but the full list of required env vars (Supabase URL, anon key, service role, Stripe keys, LLM API keys, Trigger.dev key, Gmail/Calendar OAuth credentials) isn't enumerated. Recommend adding as appendix or in `packages/config/src/env.ts` as Zod-validated schema.

2. **Feature flag consumption pattern** — `app_config` table supports feature flags but the consumption pattern (React hook? Server Component check? Middleware gate?) isn't specified. Minor — can be defined in first feature flag story.

3. **Internationalization readiness** — PRD mentions localization but architecture doesn't address i18n infrastructure. Acceptable for MVP (English-only), but the `packages/types/` location for display strings should avoid hardcoding. Low risk.

**Nice-to-Have Gaps:**

1. **Storybook** — No Storybook setup for `packages/ui/`. Would accelerate component development but not required for MVP.
2. **API documentation** — Server Actions are self-documenting via TypeScript, but webhook contract documentation (request/response schemas) isn't specified. JSDoc per webhook handler recommended.
3. **Performance monitoring** — No explicit APM tool. Recommend Vercel Analytics as zero-config integration.
4. **Email template system** — Notifications (FR79-82) mention email but no template infrastructure. Likely uses Supabase Auth emails + transactional email service (Resend/Postmark). Definable in notification story.

### Pre-Implementation Requirements (Roundtable Consensus)

Resolved during final validation roundtable (Winston, Amelia, Murat):

**Sprint 0 — Before Feature Work:**

1. **Environment variable catalog** — enumerate all required env vars in `packages/config/src/env.ts` with Zod validation schema. Blocks story #1.
2. **Feature flag consumption pattern** — define `useFeatureFlag()` hook pattern for client, `getFeatureFlag()` for server. Blocks first gated feature.
3. **Trust graduation mini-spec** — expand `packages/trust/` section with state machine diagram, transition triggers, rollback conditions, and persistence strategy. Highest-risk subsystem needs dedicated specification.
4. **Polling scaling threshold** — document concurrent-user ceiling (target: 100 workspaces × 5 concurrent = 500 polling connections) and SSE migration trigger.

**Production Gate — Before First Deployment:**

5. **`service_role` key whitelist** — CI-hard-failure lint rule flagging any `createClient()` with `service_role` outside explicit whitelist (migrations, admin backfill, agent execution context). ~4 hours effort. Eliminates ~25% of P0 risk surface.
6. **Financial property-based test** — fast-check or equivalent for financial calculation functions + one integration test firing two concurrent mutations at same financial entity. ~half day effort.
7. **Non-empty agent output assertion** — every agent contract test must assert non-null output for representative valid inputs. ~2-3 hours effort.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (102 FRs, 56 NFRs)
- [x] Scale and complexity assessed (Medium-High, 9 packages + 6 agents)
- [x] Technical constraints identified (180 rules from project-context.md)
- [x] Cross-cutting concerns mapped (11 concerns with architectural response)

**✅ Architectural Decisions**
- [x] Critical decisions documented (5 blocking decisions with rationale)
- [x] Important decisions documented (5 shaping decisions with rationale)
- [x] Deferred decisions listed (5 decisions with explicit trigger conditions)
- [x] Technology stack fully specified (versions locked in project-context.md)

**✅ Implementation Patterns**
- [x] Naming conventions established (4 layers: DB, API, code, files)
- [x] Structure patterns defined (co-located tests, barrel boundaries, file limits)
- [x] Communication patterns specified (agent signals, atoms, cache policy)
- [x] Process patterns documented (error handling, loading states, validation)
- [x] Testing patterns documented (mock boundaries, RLS matrix, chaos tests, budgets)

**✅ Project Structure**
- [x] Complete directory structure defined (~300 lines, every file named)
- [x] Component boundaries established (import DAG with ESLint enforcement)
- [x] Integration points mapped (6 external integrations, internal data flow)
- [x] Requirements to structure mapping complete (19 FR domains → directories)
- [x] 9 packages with clean dependency graph

**✅ Roundtable Validation**
- [x] Step 2: Winston/Murat/Amelia consensus on 6 key positions
- [x] Step 3: Winston/Amelia/Sally resolved single-app vs dual-app
- [x] Step 4: Winston/Amelia/Murat resolved 6 remaining decisions
- [x] Step 5: Winston/Amelia/Murat refined patterns (12 additions)
- [x] Step 6: Winston/Amelia/Murat refined structure (15 additions)
- [x] Step 7: Winston/Amelia/Murat final validation (7 pre-implementation requirements)

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: HIGH** — All decisions validated through 6 roundtable sessions, 102 FRs mapped to structure, patterns provide implementation contracts, test strategy covers P0 risks. 7 pre-implementation requirements identified and scoped (~3 days total).

**Key Strengths:**
- Trust graduation system architecturally isolated in `packages/trust/` — testable, swappable
- 3-layer RLS defense-in-depth with P0 testing at every layer (pgTAP + E2E + audit scan)
- Agent isolation enforced by import DAG — ESLint blocks cross-agent imports at CI
- Financial data integrity guaranteed by integer cents + idempotency keys + Stripe reconciliation
- Single app with route groups avoids component drift while maintaining portal isolation
- Implementation patterns are contracts (exact types), not style guides

**Areas for Future Enhancement:**
- SSE migration when polling latency becomes measurable pain point
- Redis caching layer when Next.js cache insufficient at 500+ workspaces
- Feature flag service when team grows beyond solo founder
- Separate portal app when traffic exceeds 40% threshold
- APM integration (Sentry/Datadog) for production monitoring
- Storybook for component development workflow
- i18n infrastructure for multi-language support

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented in this file
- Use implementation patterns as contracts — exact type signatures, not interpretations
- Respect the import DAG — ESLint will block violations but design around it proactively
- Reference this document for all architectural questions before making assumptions
- When in doubt about a pattern, check the "Good Examples" and "Anti-Patterns" sections

**Story #1 Prerequisites (confirm before opening story file):**
- Package manager: pnpm
- Supabase: local-only via CLI for development
- Runtime: Next.js 15 App Router in `apps/web`
- Story #1 scope: scaffold all 9 packages as stubs + Supabase init + seed
- CI/CD: GitHub Actions YAML in story #1 scope
- ESLint: ship custom config with `no-restricted-imports` from day one
- Node version: 20+ (Supabase Edge Functions compatibility)

**Implementation Sequence:**

1. Turborepo scaffold + Supabase init (Story #1)
2. `packages/config/` + `packages/types/` + `packages/db/`
3. `packages/ui/` + theme system
4. `packages/trust/` + trust viewport atoms
5. `packages/agents/orchestrator/` + pg-boss setup
6. `packages/test-utils/` + RLS test harness
7. Agent modules one by one (AR Collection first — free tier agent)
8. Client CRUD + time tracking
9. Invoicing + Stripe integration
10. Client portal route group
11. Inbox Agent + Calendar Agent
12. Onboarding flow
