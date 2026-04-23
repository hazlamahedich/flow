---
project_name: 'flow'
user_name: 'team mantis'
date: '2026-04-19'
sections_completed:
  - 'technology_stack'
  - 'language_rules'
  - 'framework_rules'
  - 'testing_rules'
  - 'code_quality_rules'
  - 'workflow_rules'
  - 'critical_rules'
existing_patterns_found: 10
status: 'complete'
optimized_for_llm: true
rule_count: 180
sections: 7
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Runtime & Language:**
- TypeScript 5.5+ (strict mode enabled) — no `any` types, no `@ts-ignore`, no `@ts-expect-error` as escape hatches
- Node.js 20 LTS (pin minor in `.nvmrc` and Docker images)
- Turborepo monorepo — shared packages under `packages/`, apps under `apps/`

**Framework & UI:**
- Next.js 15 (App Router only — **no Pages Router patterns**)
- React 19 — **Server Components by default.** `"use client"` only when needed (event handlers, browser APIs, React hooks). If a component doesn't need interactivity, keep it as a Server Component.
- Tailwind CSS + `shadcn/ui` + `radix` primitives — compose components, don't write raw utility classes for complex UI. Use `cva` for component variants.
- BlockNote editor — Phase 1: local-only, persisted to Supabase. Hocuspocus real-time collab deferred to Phase 2. Editor tests must abstract over collaboration provider.

**Data Layer:**
- Supabase (Postgres + Auth + Storage + RLS) — use `supabase-js` client. No raw SQL strings in application code; use Supabase client methods or RPC functions for complex queries.
- Drizzle ORM for schema definition and type-safe queries where Supabase client is insufficient
- pg-boss for **agent task orchestration only** (job queue). Job naming convention: `agent:{agent_name}:{action}`. pg-boss runs in Postgres — throughput bounded by connection pool. Do NOT "optimize" this prematurely.
- Trigger.dev for **scheduled jobs and external webhooks only** (e.g., Stripe webhooks, Gmail Pub/Sub). NOT for agent orchestration.
- Postgres LISTEN/NOTIFY — Phase 2 target for stigmergic agent signals. MVP uses pg-boss + database records.

**Data Fetching & State Management:**
- Server Components for data fetching (default). No client-side data fetching unless the component must be interactive.
- Server Actions for **mutations** (form submissions, state changes). Use Zod for input validation in every Server Action.
- Route Handlers (`app/api/`) for **webhooks and external integrations only** — NOT for internal CRUD. Stripe webhooks, Gmail Pub/Sub, Google Calendar webhooks go here.
- No global client-side store. URL state via `nuqs` or search params. Local component state via `useState`/`useReducer` only.
- React Query / TanStack Query only if client-side caching is proven necessary — do not add by default.

**Integrations:**
- Stripe (Checkout + Billing + Connect) — webhook handlers must verify signature and use idempotency keys on all state transitions
- Google OAuth / Gmail API (Pub/Sub) / Google Calendar API — abstracted behind `EmailProvider` and `CalendarProvider` interfaces. NEVER call Gmail/Calendar APIs directly; go through the provider interface.
- Resend (transactional email — agent email delivery, magic links, invoice delivery)

**Validation & Contracts:**
- Zod for runtime schema validation — **treat Zod schemas as contracts between layers.** Shared schemas in `packages/validators/`. Used for: API input validation, Server Action inputs, agent output validation (pre-checks), and webhook payload verification.

**LLM & Agent Architecture:**
- Vercel AI SDK as abstraction layer for multi-provider routing
- Groq for fast/cheap tasks (email categorization, action extraction)
- Anthropic for quality tasks (draft replies, report generation)
- Agent context **strictly workspace-scoped** — zero cross-workspace LLM context. Each agent run scoped to exactly one client inbox within a workspace.
- Deterministic pre-checks (code-level validation) between LLM output and user-visible surface — validated by their own test suite

**Testing & Quality Infrastructure:**
- Vitest (unit + integration), Playwright (E2E)
- `@testing-library/react` for client component tests; Server Actions tested via API-level integration tests, NOT component tests
- Supabase local instance for RLS integration tests — `pgTap` or custom helpers asserting query results per role + scope. RLS test suite runs on **every deploy. Zero tolerance.**
- MSW for external service mocking (Stripe, Google, LLM providers)
- Shared test utilities in monorepo package (`@flow/test-utils`) — fixture factories, mock setup, test JWT generators
- Zod schemas tested as contracts between layers
- pg-boss job handlers tested for **idempotency and retry semantics**
- Stripe webhook handlers tested for signature verification, idempotency, race conditions

**Error Handling & Observability:**
- Structured error logging — no `console.log` in production code. Use Axiom (or equivalent) for structured log aggregation.
- Next.js `error.tsx` boundaries — per-route for workspace routes, global fallback for catch-all. Consistent pattern across all route groups.
- Agent run failures: structured JSON log with `workspace_id`, `agent_type`, `correlation_id`, `action_type`, `duration_ms`, `outcome`

**Environment & Secrets:**
- `NEXT_PUBLIC_*` prefix for client-exposed env vars only (Supabase URL, Supabase anon key). Everything else is server-only.
- Env vars validated with Zod at app startup (`src/env.ts` or equivalent) — never scattered through handlers.
- Stripe, LLM, and Google OAuth secrets in Supabase Vault or cloud secret manager. Never in code, never in client bundles, never logged.

---

## Critical Implementation Rules

### Language-Specific Rules

**TypeScript:**
- Strict mode is non-negotiable. `noUncheckedIndexedArrayAccess`, `exactOptionalPropertyTypes` enabled.
- No `any` — use `unknown` and narrow with type guards. If a type is genuinely unknown at design time, define an explicit `unknown` with a comment explaining why.
- No `@ts-ignore` or `@ts-expect-error`. Fix the type error or use a proper type assertion with a comment.
- Prefer `interface` for object shapes, `type` for unions/intersections/utility types.
- Use `satisfies` operator for type validation without widening.
- Async functions must handle errors explicitly — no unhandled promise rejections. Wrap in try/catch or use Result type pattern.
- **Never silently swallow errors.** Every `catch` block must do at least one of: log the error, re-throw it, return a typed error result, or explicitly comment why the error is intentionally ignored. Empty catch blocks are bugs. `catch {}` or `catch (_) {}` is a code review rejection.
- Prefer `async/await` over `.then()` chains. No nested `.then()`.

**Import/Export Patterns:**
- Named exports only. Default exports only for page components (Next.js convention).
- Barrel exports (`index.ts`) only at package boundaries in the monorepo. No barrel files inside feature folders — they hide circular dependencies.
- Absolute imports via `@/` alias for workspace app code. Package imports via package name (`@flow/validators`).
- Group imports: React/Next → external packages → internal packages → local modules → types.

**Error Handling:**
- Agent run errors use structured error types: `AgentRunError`, `PreCheckFailure`, `LLMProviderError` — each with machine-readable `code` field.
- Financial operations (invoicing, payments) use Result type pattern: `Success<T> | Failure<E>`. No throwing for business logic errors.
- Never expose internal error messages to client. Map to user-friendly messages at the API boundary.
- RLS policy failures return empty result sets, not error codes. Use `has_access()` RPC for permission checks before rendering.

**Supabase-Specific TypeScript:**
- Always use `::text` cast when comparing `workspace_id` against JWT claims in RLS policies. JWT claims return text; `workspace_id` columns are uuid. Without the cast, RLS silently denies all queries.
- Generated types from `supabase gen types` — use them. No manual type definitions for database tables.
- `service_role` key ONLY in server-side edge functions for system-level operations (billing webhooks, agent orchestration, audit logs). NEVER in client code.

### Framework-Specific Rules

**Next.js 15 App Router:**
- Route structure: `/app/(auth)/...` public routes, `/app/(workspace)/...` authenticated routes, `/app/portal/[slug]/...` client portal. Single deployment, route-group isolation.
- Layout hierarchy: root → auth/workspace → route. Workspace layout fetches workspace context once; child routes never re-fetch.
- `loading.tsx` with **skeleton patterns matching content shape** for every data-fetching route. No generic spinners.
- `not-found.tsx` for dynamic routes (`[id]`, `[slug]`). Never generic 404 for valid workspace resources.
- Middleware: auth redirect, workspace context via JWT claim (NOT DB lookup), portal subdomain routing. No business logic in middleware. Workspace context is a JWT claim verified in middleware.
- Parallel routes and intercepting routes for modals (invoice preview, portal preview). Agent approval surfaces **inline in context** — not in modals.
- Caching: `cache: 'no-store'` for workspace-scoped data (user-specific, not edge-cacheable). `revalidateTag` for shared reference data. Never `generateStaticParams` for workspace routes.

**Server Actions & Mutations:**
- Server Actions live in `actions/` directories colocated with their route group. Not in a shared root `actions/` folder.
- Every Server Action validates `workspace_id` from session — **never trust a client-submitted workspace ID.**
- Server Actions are POST-only, never used for data fetching. Data fetching belongs in Server Components or server utilities.
- `useActionState` for form submissions. No manual `useState` for loading/error/success on forms.
- Optimistic updates via `useOptimistic` for: timer start/stop, approval actions, quick edits. **Rollback animates visibly with inline explanation — never silently revert.**

**React 19 Component Boundaries:**
- Server Components for data display (dashboards, lists, tables, detail views). Client Components for: forms, timers, interactive lists, anything with event handlers or hooks.
- **Never pass functions as props across server/client boundary.** Colocate the split at component level, not route level.
- Data-fetching component = server. Interactive component = client. A route page can be Server Component rendering Client Component children.
- Streaming priority: **shell → content → agent outputs.** Shell streams before content, content before agent results.

**Supabase Client Instantiation:**
- Server components / Server Actions: single `createClient()` per request via `cookies()` from `@supabase/ssr`. Never share across requests.
- Client components: singleton browser client from `@supabase/ssr`. NOT `@supabase/supabase-js` directly.
- Service role: **only** in agent execution context (background jobs) and system-level route handlers (Stripe webhooks). Never in user-facing Server Actions or page components.
- Explicit allowlist of service-role-bypassed operations. ALL client-facing queries MUST go through RLS.

**Agent System Architecture:**
- 6 agents: Inbox (push-triggered), Calendar (event-triggered), AR Collection, Weekly Report, Client Health, Time Integrity (all scheduled).
- Each agent: independent module under `packages/agents/{agent-name}/`. **No cross-agent imports.** Communication via shared signal records in database only.
- Signal records are **immutable.** Agent reads a signal, creates a run record linked to it. Never update a signal in-place. Agents consume signals via Supabase Realtime subscriptions or pg_cron triggers — **never polling loops.**

**Agent Execution Lifecycle:**
- State machine: `queued → running → paused → completed → failed → timed_out`. Every run reaches a terminal state.
- Execution flow: trigger → context assembly → LLM call → deterministic pre-check → trust gate → user surface.
- Idempotency key on every agent run. Scheduled agents WILL get double-invoked eventually — handle it.
- Concurrency: agents run independently. If Agent 3 fails, Agents 4-6 proceed unaffected. No cascade failures.
- Agent execution failures recorded, never swallowed. LLM parsing failures → explicit fallback, not blind retry. Rate limit exhaustion → backoff with user notification.
- **Agent failures surface as non-blocking toasts with "Retry" action.** Never block workspace for agent failure. Partial results persist (3/5 completed → keep the 3).

**Agent Pre-Checks & Trust:**
- Deterministic pre-checks are **code, not LLM.** Validate financial amounts, dates, contact details. Pre-checks never call LLM.
- Trust levels: Supervised (approve every action) → Confirm (review summary, bulk-confirm) → Auto (agent executes, morning digest).
- "Clean approval" = user approves without editing. Minor edit-and-approve counts as a correction, NOT a rejection. One genuine rejection = reset to previous level.
- Agent output **never auto-sends to client** at Supervised level. At Auto level, client-facing output (emails, invoices) still queues for digest review.
- Agent proposals **include human-readable rationale** — context assembled, confidence level, what would change. This is trust-building, not just approval.
- Agent-human conflict: if user is editing an entity that an agent modifies, agent changes queued as proposal. Agents **never directly mutate** data a user has open.

**Provider Abstraction:**
- `EmailProvider` and `CalendarProvider` interfaces. Agent code **NEVER imports provider-specific SDKs directly.**
- Provider resolution via registry keyed by workspace settings: `getProvider('email', workspaceId)`. Never `new GmailProvider()`.
- Adding a provider = implementing the interface. Zero changes to agent code.

**Real-Time (Supabase Realtime):**
- `postgres_changes` for agent state updates (new proposals, trust changes, status transitions).
- Subscription lifecycle: subscribe in layout-level client component, unsubscribe on unmount. Not per-page.
- Reconnection with exponential backoff. Maximum subscription count per workspace enforced.
- Note: Supabase Realtime subscriptions evaluate RLS against JWT at subscribe time. Token refresh does NOT re-evaluate. Use SSE or polling for permission-sensitive real-time updates.

**Monorepo Package Boundaries:**
- Packages: `@flow/ui` (components), `@flow/agents` (agent modules), `@flow/db` (database client + types), `@flow/validators` (Zod schemas), `@flow/test-utils` (shared test infrastructure).
- `@flow/agents` imports from `@flow/db` and `@flow/validators` only. Cannot reach into `@flow/ui`.
- `@flow/ui` imports from `@flow/validators` only. Cannot reach into `@flow/agents` or `@flow/db`.
- Enforce with `eslint-plugin-import` no-restricted-paths config.
- Turborepo pipeline: `build → test → lint`. Packages build before apps.

**Multi-Tenant Isolation (Framework Level):**
- Every workspace-scoped query includes `workspace_id` filter. No exceptions. No "I'll filter later."
- Client portal subdomain-isolated: `{slug}.portal.flow.app`. Magic-link auth scoped to single client within single workspace.
- Supabase RLS is the security perimeter. No application-level filtering as primary defense. If RLS fails, data is inaccessible, not exposed.
- `workspace_id` on all workspace-scoped table indexes. Junction tables get composite indexes on frequently queried column pairs.
- RLS policies version-controlled in `supabase/migrations/`. **Never modify RLS via dashboard.**

**UX-Driven Framework Rules:**
- Skeleton loading matching content shape, not generic spinners.
- Shell → content → agent outputs stream in priority order.
- Agent proposals include rationale and surface inline in context, not in modals.
- Trust visibility: VA can always see current trust level per agent-action with graduation progress.
- Agent failures = non-blocking toasts with retry action. Partial results persist.
- All agent surfaces (approvals, proposals, status) keyboard-navigable with ARIA live announcements. Focus moves to next action after approval/rejection.
- Rollback on optimistic update failure animates visibly with inline explanation.
- `prefers-reduced-motion` respected for all agent status and trust animations.
- Portal preview has persistent visual mode indicator (banner or border) so VA never confuses workspace view with client view.

### Never Do This (Instant PR Rejection)

- **Never bypass RLS with service_role key in user-facing code.** Service role is for agent execution context and system webhooks only.
- **Never create polling loops for agent signals.** Use Realtime subscriptions or database triggers.
- **Never put `workspace_id` in URL params for API routes.** Derive from session/JWT.
- **Never call Gmail/Calendar APIs directly in agent code.** Go through `EmailProvider`/`CalendarProvider` interfaces.
- **Never auto-send client-facing output at Supervised trust level.** Always queue for human review.
- **Never directly mutate data a user has open for editing.** Queue agent changes as proposals.
- **Never use `supabase-js` client directly in browser components.** Use `@supabase/ssr` package.
- **Never modify RLS policies via Supabase dashboard.** All RLS changes via versioned migration files.
- **Never share a Supabase client instance across requests.** One client per request on server.

### Testing Rules

**Test Framework & Organization:**
- Vitest for unit + integration tests. Playwright for E2E tests.
- Test files colocated: `component.test.tsx` next to `component.tsx`. Integration tests in `__tests__/` at route-group level. E2E tests in `apps/web/e2e/`.
- Shared fixtures and factories in `@flow/test-utils`: workspace fixtures, user fixtures (Owner/Admin/Member/ClientUser), client fixtures, agent run fixtures, Stripe event fixtures.

**Test Categories & Boundaries:**
- **Unit tests**: Pure functions, Zod schemas, utility helpers, agent pre-check logic, trust graduation calculations. No external dependencies. No database.
- **Integration tests**: Server Actions with Supabase local, RLS policy assertions, webhook handler flows, agent execution lifecycle (queued → completed). Uses real database, mocked external APIs.
- **E2E tests**: Critical user journeys only (signup → first client → first invoice → agent proposal → approval). Not for every UI state.

**RLS Testing (Critical — Non-Negotiable):**
- Every RLS policy has a corresponding test authenticating as different roles (Owner, Admin, Member, ClientUser) asserting exact query results per role + scope.
- Test helpers generate JWTs with specific workspace_id and role claims for local development.
- `pgTap` or custom Supabase helpers for database-level RLS assertions.
- RLS isolation suite runs on **every deploy. Zero tolerance for failures.**
- Automated cross-tenant query test: authenticate as Workspace A user, assert zero results from Workspace B.

**Agent Testing:**
- Agent pre-checks: deterministic unit tests with known-good and known-bad inputs. No LLM calls in pre-check tests.
- Agent execution: integration tests with mocked LLM responses (fixture-based). Test full lifecycle: queued → running → completed/failed.
- Idempotency: every job handler tested for correct behavior on duplicate invocation.
- Trust graduation: unit tests for graduation criteria, reset logic, and 7-day cooldown.
- Agent isolation: test that agent runs are strictly scoped to their workspace_id. Cross-workspace data access = test failure.

**Stripe & Payment Testing:**
- Webhook handler tests verify Stripe signature before processing.
- Idempotency: duplicate webhook events produce identical side effects (no double-charges, no duplicate records).
- Subscription state machine tested: Active → Past Due → Suspended → Deleted, with reactivation at each stage.
- Use Stripe test mode with webhook forwarding for local development.

**Test Naming & Assertions:**
- Test names describe the scenario: `it('rejects invoice with mismatched line item totals')` not `it('works')`.
- Assert on specific values, not truthiness. `toEqual` over `toBeTruthy`.
- Financial assertions use exact cent values. Never float comparison for money.

**Coverage Expectations:**
- Agent pre-checks: 100% branch coverage.
- RLS policies: 100% policy coverage (every policy has at least one test per role).
- Financial operations: 100% path coverage (happy path + every error path).
- Server Actions: happy path + validation failure + unauthorized access.
- No coverage percentage gate for UI components — focus on interaction tests for critical flows.

### Code Quality & Style Rules

**File & Folder Structure:**
- Feature-based organization within route groups. A **feature** is a domain boundary that could be removed without breaking unrelated functionality. `/app/(workspace)/clients/`, `/app/(workspace)/invoices/`, `/app/(workspace)/agents/` are features. `auth-login/` and `auth-signup/` are NOT separate features — they're one `auth/` feature.
- Each feature folder: `page.tsx`, `loading.tsx`, `error.tsx`, `actions/`, `components/`, `__tests__/`.
- Shared components in `packages/ui/`. Feature-specific components colocated with their feature.
- Agent modules in `packages/agents/{agent-name}/`: `index.ts` (public API), `executor.ts`, `pre-checks.ts`, `schemas.ts`, `types.ts`, `__tests__/`.
- Database migrations in `supabase/migrations/` with timestamp prefix. One migration per logical change.

**Naming Conventions:**

| Category | Convention | Example |
|---|---|---|
| Utility files | `kebab-case.ts` | `format-currency.ts` |
| Component files | `PascalCase.tsx` | `InvoiceList.tsx` |
| Server Action files | `actions/{verb}-{entity}.ts` | `actions/create-client.ts`, `actions/send-invoice.ts` |
| React hooks | `use{Feature}{Action}` | `useClientList`, `useInvoiceSubmit` |
| Boolean variables | `is/has/should/can` prefix | `isActive`, `hasPermission`, `canApprove` |
| Event handlers | `handle{Event}` definitions, `on{Event}` props | `handleSubmit` / `onSubmit` |
| Constants (true) | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_TRUST_LEVEL` |
| Constants (const) | `camelCase` | `defaultPageSize` |
| Utility functions | `camelCase`, verb-first | `formatCurrency`, `validateEmail` |
| DB tables/columns | `snake_case` | `workspace_members`, `created_at` |
| TypeScript types | `PascalCase` | `InvoiceData`, `AgentRunResult` |
| Agent types | `{AgentName}Proposal`, `{AgentName}PreCheckResult` | `ArCollectionProposal`, `InboxPreCheckResult` |
| Zod schemas | `{entity}Schema` | `invoiceSchema`, `agentRunSchema` |
| Enum values | `PascalCase.EnumValue` | `TaskStatus.InProgress`, `TrustLevel.Auto` |
| RLS policies | `policy_{table}_{operation}_{role}` | `policy_invoices_select_member` |
| RPC functions | `{verb}_{entity}` returning `jsonb` | `create_invoice`, `has_access` |
| Route handlers | `route.ts` in route directory | `app/api/stripe/webhook/route.ts` |

**Import Ordering (Enforced):**
1. React / Next.js imports
2. Third-party libraries (Supabase, Zod, Stripe SDK)
3. Internal packages (`@flow/ui`, `@flow/validators`, `@flow/db`)
4. Internal hooks and utilities (`@/lib/`, `@/hooks/`)
5. Internal components (`@/components/`, `./components/`)
6. Types (`./types`, type-only imports)
7. Styles (last)

**Type Safety Rules:**
- Use `interface` for object shapes that can be extended. Use `type` for unions, intersections, mapped types, primitives. Never both for the same concept.
- No `any`. Use `unknown` + type guard, or explicit eslint-disable with comment explaining why.
- No manual type assertions (`as SomeType`). Use Zod schema validation at boundaries.
- Zod schemas are the source of truth for runtime shapes. Derived TypeScript types via `z.infer<>`.

**`"use client"` / `"use server"` Placement:**
- Server Actions in `actions/*.ts` files with `"use server"` at top of file. No inline `"use server"` in mixed files.
- Client components with `"use client"` at top of file. Server Components have no directive.
- No ambiguous modules mixing client and server code in one file.

**Agent Module Contract:**
- Every agent exports a standard executor: `execute(input: {AgentName}Input): Promise<{AgentName}Proposal>`
- Pre-checks export: `preCheck(proposal: {AgentName}Proposal): Promise<{ passed: boolean; errors: string[] }>`
- Agent module `index.ts` exports only: `execute`, `preCheck`, input/output types, and Zod schemas. Internal implementation stays private.

**Dependency Injection & Testability:**
- Server Actions and agent executors receive dependencies (DB client, LLM provider, email provider) via parameters or context — never reach for globals or singletons directly.
- Pure functions in `utils/`. Side effects (DB writes, API calls, email sends) isolated to service modules or Server Actions.
- Side-effect boundary: a function either computes a result OR performs an effect. Not both in the same function.

**ActionResult Contract:**
- All Server Actions return `ActionResult<T>`: `{ success: true; data: T } | { success: false; error: AppError }`.
- `AppError` base type with `code` (machine-readable), `message` (user-friendly), `retryable` (boolean), `statusCode` (HTTP status).
- Financial operations use `Result<T, E>` pattern. No throwing for business logic errors.
- Supabase `PostgrestError` mapped to `AppError` in `packages/utils/error-handler.ts`. Map once, reuse everywhere.

**Code Organization Limits:**
- 200 lines per file (250 hard limit with eslint rule). Excludes auto-generated files (Supabase types, generated SDKs). If you hit 200, split by responsibility.
- 50 lines for pure logic functions, 80 for React components. When exceeding, annotate with comment explaining why.
- Max 3 levels of control-flow nesting (`if`/`for`/`while`/`try`/`switch`). Prefer early returns and extracted functions.

**Comments & Documentation:**
- Comments explain *why*, not *what*. No comments restating code. Well-named functions like `validateEmailFormat()` need no comment.
- JSDoc required on: exported hooks, shared utility functions, shared types (params + return + one usage example). Not required on React components (props are self-documenting via TypeScript) or obvious CRUD.
- `// TODO(FO-123):` format with ticket number. No bare `// TODO`.
- Agent pre-check functions include inline comment explaining validation logic — these are security-critical and must be reviewable.
- Database migrations include comment block: purpose, related ticket.
- Complex orchestration or data-flow files get a one-line purpose statement at top.

**Git Conventions:**
- Conventional commits: `feat(scope):`, `fix(scope):`, `test(scope):`, `refactor(scope):`. Valid scopes: feature names (`clients`, `invoices`, `agents`), agent names (`inbox-agent`, `ar-agent`), infrastructure (`rls`, `migrations`, `ci`).
- Breaking changes: `feat(scope)!: description` with `BREAKING CHANGE:` in body.
- One logical change per commit. Migrations in their own commit, separate from application code.
- Branch naming: `feature/`, `fix/`, `refactor/` prefixes.

### Development Workflow Rules

**Local Development Setup:**
- Supabase local instance via `supabase start` for all development. **No shared dev database.**
- `supabase stop && supabase start` resets ALL data — be aware. Seed scripts must be re-runnable.
- Seed script creates test workspaces with all 4 roles (Owner, Admin, Member, ClientUser) + client scoping + tier configurations. Seed scripts are idempotent.
- Test JWTs generated for each role. Developer switches contexts locally via test JWT injection.
- Stripe test mode with CLI webhook forwarding for local payment flow testing.
- `.env.local` for local overrides. `.env.example` documents all required variables. Never commit `.env.local`.
- `supabase gen types` runs automatically — never commit stale generated types.
- Local Supabase doesn't mirror remote storage buckets — seed scripts must create them.
- Workspace dependency order: `@flow/database` → `@flow/shared` → `@flow/validators` → `@flow/ui` → apps. Use `workspace:*` protocol for internal deps.

**Database Migrations:**
- Every schema change is a migration file. **No manual schema modifications** in any environment.
- Migration files are append-only. Never edit a migration after applied to any environment.
- RLS policies are migrations. Policy changes = new migration file.
- `supabase db diff` generates migration scaffolds — **human reviews every generated migration.** Auto-generated diffs can be noisy.
- Separate data migrations from schema migrations. Data migrations use `ISOLATION LEVEL SERIALIZABLE`.
- Destructive changes = multi-step migration: add new column → backfill data → drop old column. Never destructive in one step.
- Every `up` migration has a tested `down` migration. CI verifies: apply all → rollback → re-apply.
- Test data seed scripts separate from migrations. Seeds are idempotent and re-runnable.

**Environment Strategy:**
- **Local:** Supabase local + Stripe test mode. All agent calls route through mock layer.
- **Preview:** Ephemeral per-PR environment with own Supabase branch. Cleaned up on PR close.
- **Staging:** Mirrors production config. Agent tool calls **NEVER hit real external APIs** — all route through mock layer. No real emails, no real Stripe charges, no real calendar modifications.
- **Production:** Full integration. Feature flags gate agent rollouts.
- Every new env var must be added to **all environments** in the same PR that introduces it. No "I'll add it to Vercel later."
- Supabase CLI version pinned in CI. Version skew = silent migration failures.

**Merge Gates (Non-Negotiable):**
- All CI checks must pass before merge — **no exceptions, no override buttons.**
- At least one code review approval required. No direct pushes to `main`.
- Status checks required: build, lint, type-check (`tsc --noEmit` per package), unit tests, integration tests, migration dry-run, SAST scan, dependency audit.
- PRs must include migration files + RLS test coverage + type changes together. **Never split these across PRs.**
- Any PR modifying a Supabase type (table, RPC, view) must include updated TypeScript types AND a contract test validating frontend renders with new shape.

**CI/CD Pipeline:**
- Turborepo pipeline: `build → test → lint`. Packages build before apps. Explicit `dependsOn` for every package.
- RLS isolation test suite runs on **every deploy. Zero tolerance.**
- Migration dry-run in CI: apply all migrations to fresh DB, verify schema, test rollback path.
- Security scanning: SAST (semgrep), dependency audit (`npm audit` + Dependabot), pre-commit secret scanning, automated check that every table has RLS enabled.
- E2E tests run against preview deployments, **not local.** Agent workflows span multiple API calls — unit tests won't catch integration breaks.
- Bundle size check — agent payloads affect tier billing.

**Test Pyramid Enforcement:**
- **70% Unit** — services, utils, agent logic, pre-checks. No network calls. Mock Supabase at service boundary.
- **20% Integration** — RLS policies, API routes, auth flows, Server Actions. Real local Supabase, real PostgreSQL, real RLS. Not mocks.
- **10% E2E** — critical user journeys only (signup → client → invoice → agent proposal → approval).

**Flaky Test Policy:**
- Tests get 3 retries max. If a test fails >2% of runs → quarantined to separate suite.
- Quarantined tests have 7-day SLA: fix or delete.
- CI reports flake rate per PR. Target: <1%.

**Deployment Pipeline:**
- Preview deployments for every PR. Staging mirrors production config.
- Database migrations run automatically before app deployment. No manual migration execution in production.
- Feature flags via env vars for agent activation, tier boundaries, experimental features. Each agent has independent kill switch.
- **Post-deploy verification:** health check → smoke tests (auth, core API, agent dispatch) → RLS suite → error rate monitor (5 min window) → **auto-rollback if error rate exceeds threshold.** Data-driven go/no-go, not manual "looks good."
- Synthetic health checks every 5 minutes against critical paths post-deploy.

**Code Review Standards:**
- Every PR reviewed before merge. No direct pushes to main.
- RLS policy changes require explicit security review comment.
- Agent pre-check changes require test coverage demonstration.
- Financial logic changes require traceability to specific FR from PRD.
- Agent behavior changes (prompts, tool definitions, orchestration) require integration test against staging with mocked externals.

### Critical Don't-Miss Rules

**Meta-Rule: Every async boundary is a failure boundary.** For every async interaction (agents, webhooks, Realtime, Stripe, LLM streams), document: what happens on failure, what happens on timeout, what happens on duplicate delivery. If you can't answer all three, you have a production incident waiting to happen.

**Financial Data Handling:**
- All monetary values stored and computed as **integers in cents.** Never float. Display layer formats to currency. `1099` = $10.99 in database.
- Invoice totals are computed, never stored as editable fields. Line items are the source of truth. Total = sum of line items.
- Stripe amounts are in cents. Map once at the integration boundary. Never pass dollar amounts to Stripe.
- Duplicate invoice detection: same client + same line items + same date range = single invoice. Alert user if match found.
- Invoice state machine: `draft → sent → viewed → partially_paid → paid → overdue → voided`. No skipping states. No backward transitions except `voided` from any state before `paid`.
- "Hours worked" ≠ "hours billable" ≠ "hours invoiced." Three separate numbers. Retainer clients: hours within retainer aren't line items. AR agent understands all billing models.

**Agent Edge Cases:**
- Inbox→Calendar race condition: email says "actually Friday" while Calendar is already booking Thursday. Solution: FIFO processing per thread. Scheduling requests held in pending state for 60 seconds. Superseding emails cancel and replace.
- Agent cascade failure: >3 agent failures in same workspace within 5 minutes → pause signal bus for that workspace. Agents degrade to independent scheduled execution.
- LLM cost overrun: hard per-workspace daily LLM budget. Exceeding budget → graceful degradation (cheap model only, no drafts), not hard failure. Mid-stream LLM responses truncated when budget exhausted.
- Agent runs are idempotent. Same trigger + same input = same output. No duplicate side effects from retries.
- Agent execution timeout: single-step actions 30s, multi-step 120s. Incomplete actions paused with resume/cancel option.
- **Human-override cooldown:** if a human modifies an agent's classification or output, the agent must not re-process that item for 24 hours. Log overrides as training signal data.
- Agent mutations participate in the same optimistic locking as user mutations. If agent write fails due to version mismatch → re-read, re-evaluate, retry. Never silently overwrite.
- **Email hold window:** agent-drafted emails have configurable 60-second hold before send where VA can cancel. Email equivalent of calendar pending window.

**Multi-Tenant Edge Cases:**
- JWT token refresh does NOT re-evaluate Supabase Realtime subscriptions. Use server-sent events or polling for permission-sensitive real-time updates.
- Workspace switch in multi-tab: session-level workspace context, not JWT-only. Token refresh kills Realtime subscriptions across open tabs.
- RLS returns empty result sets, not 403s. Application cannot distinguish "no data" from "not allowed." Use `has_access()` RPC for explicit permission checks before rendering.
- Client portal magic links scoped to `(workspace_id, client_id)`. No cross-client visibility. Links expire after 15 minutes. Max 5 generation attempts per email per hour.
- **Service role RLS bypass:** every server-side query using service_role key must include explicit `workspace_id` filter via shared data-access layer. One unprotected `.select('*')` = cross-tenant leak. Linter rule flags unprotected service-role queries.
- **LLM context isolation:** context windows explicitly cleared between workspace processing. No shared in-memory conversation state across tenants. No shared conversation threads across client boundaries, even within the same VA session.
- **Post-generation PII scanner:** agent outputs scanned against PII pattern library before delivery. Tokenization covers storage, not LLM output.

**Security Edge Cases:**
- PII tokenization before data enters LLM prompts — agent prompts never contain raw client names, emails, or financial figures. MVP uses regex-based entity detection with token vault.
- **Prompt injection via user content:** calendar events, invoice memos, client notes — all user-authored, all potential injection vectors. Trust boundary between system prompts and user-sourced content. Never interpolate user content into agent system prompts without sanitization. Treat all user-authored fields as adversarial input.
- Email content sanitized before LLM: HTML stripped, scripts removed, tracking pixels removed, quoted replies stripped, signatures removed. Deterministic pipeline independent of LLM defenses.
- OAuth tokens encrypted at rest (Supabase Vault). Refresh token rotation on every use. Auto-disconnect after 3 consecutive refresh failures.
- Session invalidation on role change or access revocation within 60 seconds (JWT TTL). Aspire to 5 seconds post-MVP.
- `service_role` key in client bundle = instant security incident. Verify with build-time check.

**LLM Integration Patterns:**
- Model-tier routing: categorization/extraction → cheap/fast model (Groq). Draft generation/reports → quality model (Anthropic). Never use quality model for categorization.
- LLM output validated via Zod schema before any side effect. Invalid output → logged with full context + user notified. Never retry blindly.
- Prompt injection defense: (1) input sanitization, (2) system prompt guardrails, (3) output Zod validation. MVP ships all three.
- LLM provider failure: multi-provider routing with circuit breaker. 5 consecutive failures → 60-second circuit open. No cascading failures.

**Concurrency & Data Integrity:**
- Optimistic locking on invoices, client records, project data. `updated_at` as conflict resolver. Last write wins with notification to other editor.
- Agent-human conflict: entity-level versioning detects concurrent modification. Human intent always takes priority. Agent's attempted action preserved for review.
- All system write operations use idempotency mechanisms. Duplicate side effects from retries, reconnections, or agent re-execution = bug.
- Stripe webhooks processed exactly once. **Idempotent by design:** "already in target state" = success, not error. Log every receipt with Stripe event ID. Reconciliation job compares state to Stripe's daily.
- Supabase connection pool: PgBouncer in transaction mode for server-side queries. Pool limits per consumer type. Alert at 70% capacity.

**Billing State Machine:**
- Workspace lifecycle: `Active → Past Due (7 days) → Suspended (read-only, 30 days) → Deleted`. Reactivation available before deletion.
- Past Due/Suspended: agent jobs paused, user notified. Agents resume on reactivation. No orphaned actions.
- **Subscription transition vs. running agents:** agents in flight get 60-second completion window. New tasks rejected immediately. Mid-stream LLM responses truncated. Billing state machine and agent orchestrator share single source of truth for workspace entitlement.
- Downgrade Pro→Free: clients beyond 2 become read-only (not deleted). User selects which 2 remain active.
- Hard delete: cascade across all workspace-scoped tables. Tiered GDPR retention: PII deleted at 30 days, financial records 7 years, audit trail preserved with PII tokens.

**Domain-Specific Invariants (VA Workflow Rules):**
- **Timezone authority:** calendar actions resolve against *calendar owner's* timezone, not the VA's timezone.
- **Delegated resource atomicity:** agent actions on delegated client resources (inboxes, calendars) are atomic per-item with explicit failure modes, not batch-atomic. Handle token scope mismatch and mid-session revocation.
- **Send-as identity:** agent-drafted replies use the *client's* email address, not the VA's. Permission check on every outbound action.
- **Retrospective time entry:** first-class workflow. "Self-reported" entry type validates against *whether activity happened* (email sent? event created?), not *when the timer ran*. Do not flag retrospective entries as anomalous by default.
- **VA reassignment:** workspace mutation triggers: (a) agent model warm-start from previous VA's preferences, (b) task reassignment with audit trail, (c) historical data attribution lock. Agent learning transfer is a migration, not a reset.
- **Weekly report negative-space:** reports must include "stalled items" section — tasks expected but not completed, emails awaiting response beyond SLA, invoices past due. Negative-space reporting is more valuable than positive-space.
- **Dual identity permission resolution:** users holding multiple roles (admin + VA) resolve each action to a single effective permission context. No permission union — explicit role selection when acting.

**GDPR & Compliance:**
- Workspace data export within 24 hours of request. Formats: CSV, JSON.
- PII replaced by non-reversible tokens before hash chain computation. Audit trail integrity preserved, PII removed.
- Audit log: append-only, no UPDATE/DELETE. Tamper detection via hash chain with nightly integrity check. Retention: 90 days hot, 7 years cold.

---

## Usage Guidelines

**For AI Agents:**
- Read this entire file before implementing any code in this project.
- Follow ALL rules exactly as documented. When rules conflict, prefer the more restrictive option.
- When in doubt about a domain-specific rule, default to protecting client data and preserving VA agency.
- The "Never Do This" section in Framework Rules is instant PR rejection — treat those as hard constraints.
- Update this file if new patterns emerge during implementation.

**For Humans:**
- Keep this file lean and focused on agent needs. Remove rules that become obvious over time.
- Update when technology stack changes or new patterns are established.
- Review quarterly for outdated rules.
- Add new rules when an AI agent makes the same mistake twice — that's the signal threshold.

Last Updated: 2026-04-23
