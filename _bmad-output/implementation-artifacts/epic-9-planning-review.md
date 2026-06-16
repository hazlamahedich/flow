# Epic 9 Planning Review: Client Portal, Subscriptions & Billing

**Date:** 2026-06-10
**Status:** Pre-Kickoff Review
**Reviewer:** Team Mantis

---

## 1. Epic Overview

Epic 9 delivers the client-facing portal and full subscription billing system. Scope includes:

- **Client portal** with light theme, portal branding presets, invoice viewing + payment, report approval, strict data isolation
- **Stripe payment integration** with subscription tiers (Free/Pro/Agency), tier limit enforcement, downgrade data preservation, billing history
- **Subscription lifecycle** (Active → Past Due → Suspended → Deleted), agent job pause on suspension, proration
- **Recurring invoices** (moved from Epic 7), idempotent webhook processing, 5% free-tier transaction fee notice
- CSV client import (v1.1 placeholder), duplicate invoice dedup, client email notifications

**FRs covered:** FR8, FR15, FR37, FR39, FR42, FR44, FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR82

**UX-DRs covered:** UX-DR12, UX-DR26

---

## 2. Story Breakdown & Estimated Effort

| Story | Title | Key FRs | Complexity | Risk | Recommended Slicing | Suggested Agent Model |
|-------|-------|---------|------------|------|---------------------|----------------------|
| 9.1 | Client Portal Foundation & Light Theme | FR8, FR51, FR54, UX-DR12, UX-DR26 | High | Critical | **Split → 9-1a (Portal Auth & Layout) + 9-1b (Branding & Theming)** | Deterministic |
| 9.2 | Client Portal Invoice Payment & Report Approval | FR52, FR53, FR82, UX-DR36, UX-DR37, UX-DR39, UX-DR40 | Medium | Critical | No split (focused CRUD in portal) | Deterministic |
| 9.3 | Stripe Payment Integration & Webhook Processing | FR39, FR42, FR44, NFR05, NFR46 | High | High | **Split → 9-3a (Stripe Webhook Infrastructure) + 9-3b (Checkout & Portal Integration)** | LLM (documentation-aware coding) |
| 9.4 | Subscription Tiers & Tier Limits | FR55, FR56, FR61, FR62 | Medium | Medium | No split (data-driven limits, not complex) | Deterministic |
| 9.5 | Subscription Lifecycle & Downgrade Handling | FR57, FR58, FR59, FR60 | High | High | **Split → 9-5a (Lifecycle State Machine) + 9-5b (Agent Pause & Downgrade Handling)** | Deterministic |
| 9.6 | Recurring Invoices | FR37, FR60 | Medium | Low | No split (follows existing invoice patterns) | Deterministic |
| 9.7 | Billing Accuracy & Usage Visibility | NFR54, NFR55, NFR56 | Medium | Low | No split (reporting/monitoring) | Deterministic |

**Estimated total effort:** 18-26 days across 7 stories (10 slices if all splits approved)

Story-level estimates from Stripe spike:
- **9-3a (Stripe Infrastructure & Checkout):** 3-4 days
- **9-3b (Customer Portal & Self-Serve Billing):** 2-3 days
- **9-5a/b (Subscription Lifecycle & Agent Integration):** 2-3 days

---

## 3. Prerequisites Checklist

| # | Prerequisite | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Supabase running locally | ✅ | 45/45 pgTAP passing, 566 total tests |
| 2 | service_role workspaceId audit | ✅ | 6 unfiltered queries fixed across agent modules, 1 skipped (non-blocking) |
| 3 | 8-3 green-phase completion | ✅ | Tasks 2.5, 2.6, 3.8, Task 10 addressed in closeout |
| 4 | Deferred pgTAP RLS tests verified | ✅ | All 45 pgTAP files passing from Epics 8-3, 8-4, 8-1a |
| 5 | Stripe subscription spike complete | ✅ | Architecture, schema, risks, implementation sequence documented |
| 6 | Agent model + finding density tracking document created | ✅ | Per-story tracking from Epic 8 onward, recommendations for Epic 9 documented |

**All prerequisites met.** No blockers for kickoff.

---

## 4. Dependency Map

### 4.1 Intra-Epic Dependencies

```
9.1 (Portal Foundation)
  └── 9.2 (Invoice Payment & Report Approval)

9.3 (Stripe Integration)
  └── 9.4 (Subscription Tiers)
        └── 9.5 (Subscription Lifecycle)
              └── 9.6 (Recurring Invoices)
                    └── 9.7 (Billing Accuracy)
```

9.1 and 9.3 are independent starting points — portal and billing can be developed in parallel.

### 4.2 Cross-Epic Dependencies

| Source | Target Stories | Dependency |
|--------|---------------|------------|
| Epic 7: Invoices + payments | 9.2, 9.3, 9.6, 9.7 | Invoice data model, PaymentProvider interface, payment link generation |
| Epic 7: Stripe PaymentProvider | 9.3, 9.4 | Payment provider abstraction (SubscriptionProvider extends this) |
| Epic 7: Recurring invoices | 9.6 | Moved from Epic 7 scope |
| Epic 8: Reports (8-1a/8-1b/8-1c) | 9.2 | Report sharing via portal, report approval flow |
| Epic 8: Client Health (8-3) | 9.7 | Validation metrics → billing accuracy tracking |
| Epic 2: Agent Orchestrator | 9.5 | Agent job dequeue guard clause for non-active workspaces |
| Epic 1: Workspace schema | 9.3, 9.4, 9.5 | Workspace table subscription column extensions |

### 4.3 External Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| Stripe account (test mode) | ⬜ Needed | Create before Story 9-3a |
| Stripe CLI (local testing) | ⬜ Needed | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| Vercel env vars | ⬜ Needed | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| `app_config` table | ✅ Planned | Migration `00000010_app-config.sql` |
| `packages/types/subscription.ts` | ✅ Exists | Zod schemas for subscription types |
| `packages/db/` client setup | ✅ Exists | Can add billing queries |

---

## 5. Risk Assessment

Based on finding density data (financial domain averages 23 findings/story from Epic 7) and Epic 8 retro insights:

| Risk Level | Stories | Rationale |
|-----------|---------|-----------|
| **Critical** | 9.1, 9.2 | Portal exposes app to non-authenticated users. Time-limited links must be unguessable, rate-limited, expireable. RLS must hold against `anon` role access. service_role audit (TD1) was completed but must be verified under portal access patterns. |
| **High** | 9.3, 9.5 | Stripe money flows — webhook reliability, split-brain between Stripe and Supabase. 9.3 webhook handler is the single point of failure for all billing state. 9.5 state machine has complex transitions (Active → Past Due → Suspended → Deleted) with agent integration. |
| **Medium** | 9.4, 9.5 | Subscription state machines — complex lifecycle transitions, tier limit enforcement at application level, proration handling. Stripe doesn't guarantee event ordering; handlers must be idempotent. |
| **Low** | 9.6, 9.7 | Well-understood patterns — recurring invoices follow existing invoice lifecycle, billing accuracy is reporting/monitoring. |

### Specific Risk Items from Stripe Spike

| Risk | Severity | Mitigation |
|------|----------|------------|
| Webhook delivery ordering — Stripe doesn't guarantee event order | Medium | Use `stripe_processed_events` for idempotency. Compare Stripe timestamps, not arrival order. |
| Split-brain between Stripe and Supabase | High | Nightly reconciliation job. Success redirect page calls `syncStripeData()` as synchronous fallback. Never rely solely on webhooks. |
| Free tier 5% fee implementation complexity | Medium | MVP: add 5% as line item. Full Stripe Connect deferred to Agency+ tier (Phase 2). |
| Stripe API key exposure in SSR bundle | High | Secret key NEVER leaves server. `serverExternalPackages` config. Audit bundle with `@next/bundle-analyzer`. |
| Proration edge cases (mid-cycle upgrade + immediate downgrade) | Medium | Use Stripe's default proration behavior. Don't override. Let Stripe calculate. |

---

## 6. Recommended Story Slicing

Based on Epic 8's lesson: splitting 8-1 into 8-1a/b/c reduced findings from 26 to 4-9 per slice.

### Stories to Split BEFORE Dev

**9.1 → 9-1a (Portal Auth & Layout) + 9-1b (Branding & Theming)**

| Slice | Scope | Complexity | Rationale |
|-------|-------|------------|-----------|
| 9-1a | Time-limited link auth, portal layout, RLS for `anon` role, "Powered by Flow OS" footer | High | Auth is complex — time-limited links with no account, `anon` role RLS, abuse prevention (FR8). Security-critical. |
| 9-1b | Light theme (#FAFAF8, #D4A574), branding presets (Minimalist, Warm Host, Bold Professional), 8 visual vars + 4 content vars, trophy case philosophy | Medium | Branding is mostly CSS/theme configuration. Lower risk, no security surface. Can be developed independently after portal auth works. |

**9.3 → 9-3a (Stripe Webhook Infrastructure) + 9-3b (Checkout & Portal Integration)**

| Slice | Scope | Complexity | Rationale |
|-------|-------|------------|-----------|
| 9-3a | Webhook Route Handler, signature verification, `stripe_processed_events` dedup, `checkout.session.completed` handler, workspace subscription columns migration, `app_config` tier config | High | Backend-only. No UI dependency. Most critical infrastructure — all other billing stories depend on this. |
| 9-3b | `createCheckoutSession` Server Action, Stripe Customer Portal configuration, `createPortalSession`, cancel/reactivate actions, billing settings page UI | Medium | Frontend + Stripe API. Can be developed once webhook infrastructure is stable. Estimated 2-3 days. |

**9.5 → 9-5a (Lifecycle State Machine) + 9-5b (Agent Pause & Downgrade Handling)**

| Slice | Scope | Complexity | Rationale |
|-------|-------|------------|-----------|
| 9-5a | State machine (Active → Past Due → Suspended → Deleted), grace period enforcement (7-day), suspension enforcement (30-day), reconciliation job | High | Complex state transitions with cron/scheduled jobs. Pure backend logic. |
| 9-5b | Agent orchestrator guard clause, tier limit enforcement in Server Actions, downgrade data preservation, auto-upgrade prompts, notification flow | Medium | Agent integration is a separate concern from state machine. Can be tested independently. |

### Stories to Keep As-Is

| Story | Rationale |
|-------|-----------|
| 9.2 | Focused scope — CRUD operations in portal context. Payment and report approval build on 9.1 portal foundation. |
| 9.4 | Tier limits are data-driven via `app_config`. No complex state. Subscription changes are prorated by Stripe. |
| 9.6 | Recurring invoices follow existing invoice patterns from Epic 7. Schedule-based generation is well-understood. |
| 9.7 | Billing accuracy is reporting/monitoring. Usage metering, reconciliation window, dispute tracking. Standard data pipeline work. |

### Projected Finding Density (Post-Split)

| Story/Slice | Projected Findings | Basis |
|-------------|-------------------|-------|
| 9-1a | 12-18 | Critical security surface, but well-scoped slice |
| 9-1b | 4-8 | Theming/CSS work, low risk |
| 9-2 | 10-15 | Portal CRUD, email notifications |
| 9-3a | 15-20 | Financial domain (avg 23/story), but backend-only reduces surface |
| 9-3b | 8-12 | Stripe API integration, UI work |
| 9-4 | 8-12 | Data-driven limits, straightforward |
| 9-5a | 12-18 | Complex state machine |
| 9-5b | 8-12 | Agent integration, well-bounded |
| 9-6 | 6-10 | Follows existing patterns |
| 9-7 | 6-10 | Reporting/monitoring |

---

## 7. Security Surface Analysis

Epic 9 introduces **three new attack surfaces** not present in any previous epic:

### 7.1 Unauthenticated Portal Access (9.1, 9.2)

**Surface:** External users access the app without authentication via time-limited links.

**Threats:**
- Link enumeration/guessing to access other clients' data
- Link sharing/leakage (client forwards link to unauthorized party)
- Automated scraping of portal pages
- Rate abuse (repeated portal access attempts)

**Mitigations:**
- Portal links: crypto-random tokens (32+ bytes via `crypto.randomBytes`), TTL enforcement, single-use or time-window options
- Rate limiting: per-IP and per-token rate limits on portal routes
- RLS: portal queries run as `anon` role with `portal_token`-based row filtering — no `workspace_id` exposure
- Audit: log all portal access events for anomaly detection

### 7.2 Stripe Webhook Endpoint (9.3)

**Surface:** Publicly accessible endpoint receives events from Stripe.

**Threats:**
- Fake webhook events (replay attacks, forged events)
- Webhook secret compromise
- Event injection (attacker sends crafted events)

**Mitigations:**
- Signature verification on every request: `stripe.webhooks.constructEvent(body, signature, webhookSecret)`
- Raw body parsing — never parse JSON before verification
- Idempotency: `stripe_processed_events` table with `ON CONFLICT DO NOTHING`
- Restricted API key for webhook handler (only `customers:read`, `subscriptions:read`, `invoices:read`)
- Separate webhook secrets for test/live mode

### 7.3 Client Payment Flow (9.2, 9.3)

**Surface:** Clients enter payment information through the portal.

**Threats:**
- Card data exposure (PCI compliance risk)
- Payment manipulation (client modifies amount)
- Man-in-the-middle on payment flow

**Mitigations:**
- Stripe Checkout handles all card collection — Flow OS never touches card data (SAQ A qualification)
- Payment amounts set server-side, not client-modifiable
- HTTPS enforced, HSTS headers
- Metadata integrity: `metadata: { workspaceId }` on all Stripe objects

### 7.4 Subscription Status Manipulation (9.4, 9.5)

**Surface:** Users might attempt to bypass billing via direct database access or API manipulation.

**Threats:**
- Direct DB updates to change tier (if RLS is misconfigured)
- API calls to modify subscription status without Stripe flow
- Downgrade to retain premium features

**Mitigations:**
- RLS: owner-only billing queries. `service_role` only in webhook handlers and system operations.
- Tier checks: Server Actions verify `subscription_tier` from DB before granting access
- Stripe reconciliation: nightly job compares Stripe state to DB, flags drift
- Downgrade data preservation: excess clients → read-only, not deleted

---

## 8. Testing Strategy

### 8.1 Global Gates (Apply to All Stories)

| Gate | Requirement | Enforcement |
|------|------------|-------------|
| pgTAP RLS | All RLS tests passing before `done` | Hard gate — enforced by close-out script |
| Typecheck | `pnpm typecheck` — 0 errors | Pre-commit |
| Lint | `pnpm lint` — 0 errors | Pre-commit |
| Unit tests | `pnpm test` — all passing | CI gate |
| ATDD | Story-specific acceptance tests | P1 gate |

### 8.2 Per-Story Test Plan

| Story | Test Requirements | Priority |
|-------|------------------|----------|
| **9-1a** | pgTAP RLS with `SET ROLE anon` for portal access patterns. Token generation/uniqueness tests. Token TTL expiration tests. Rate limiting tests. | P0 |
| **9-1b** | Visual regression tests for theme presets. Variable constraint tests (8 visual + 4 content max). | P1 |
| **9.2** | Portal CRUD tests (invoice view, payment, report approval) as `anon` role. Cross-tenant isolation tests. Email notification trigger tests. | P0 |
| **9-3a** | Webhook handler unit tests (mocked Stripe events for each event type). Dedup logic tests (same event twice → single write). Signature verification tests. Integration test: full checkout → webhook → DB update flow. | P0 |
| **9-3b** | Checkout session creation tests. Portal session creation tests. Cancel/reactivate flow tests. Billing settings page E2E. | P0 |
| **9.4** | Tier limit enforcement tests (client count, team size, agent count). Proration verification (Stripe default behavior). 5% fee display tests. | P1 |
| **9-5a** | State machine tests (all transitions: active → past_due → suspended → deleted). Grace period tests. Reconciliation job tests (inject drift, verify correction). | P0 |
| **9-5b** | Agent orchestrator guard clause tests (skip jobs for non-active workspaces). Downgrade data preservation tests. Auto-upgrade prompt tests. | P0 |
| **9.6** | Recurring invoice generation tests (schedule, pause on suspension). Invoice lifecycle conformance tests. | P1 |
| **9.7** | Billing accuracy tests (≥99.9% metering, 1-hour reconciliation window). Dispute window tests (30-day). Usage visibility tests. | P1 |

### 8.3 Stripe Test Mode

All development and CI uses Stripe test mode:
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 0002` — declines
- `4000 0000 0000 3220` — 3D Secure

CI pipeline runs against Stripe test mode with `STRIPE_WEBHOOK_SECRET` for the test endpoint.

---

## 9. Agent Model Recommendations

Based on finding density tracking data and Epic 8 insights:

| Story/Slice | Recommended Model | Rationale |
|-------------|------------------|-----------|
| 9-1a | Deterministic | Portal auth is security-critical CRUD+RLS. Zero hallucination tolerance. Precise access patterns must be correct. |
| 9-1b | Deterministic | Theming/CSS configuration. No narrative generation needed. |
| 9.2 | Deterministic | Portal CRUD operations. Report approval is workflow logic, not prose. |
| 9-3a | LLM (if needed) | Stripe API integration has complex patterns, webhook event handling, and edge cases that benefit from documentation-aware coding. Highest-risk story — budget extra review cycles. |
| 9-3b | Deterministic | Checkout/portal UI follows standard Server Action patterns. |
| 9.4 | Deterministic | Tier limits are data-driven. `app_config` lookups and enforcement checks are computation, not narrative. |
| 9-5a | Deterministic | State machine logic is pure computation. Transitions must be precise. |
| 9-5b | Deterministic | Agent guard clause and tier enforcement are conditional logic. |
| 9.6 | Deterministic | Recurring invoices follow existing invoice patterns from Epic 7. |
| 9.7 | Deterministic | Usage tracking, reconciliation, dispute windows — all data pipeline work. |

**Key insight from Epic 8:** Deterministic agents (glm-5.1) averaged ~4 findings vs LLM agents (kimi-k2.6) at ~13 findings. Financial domain averages 23 findings/story. Prefer deterministic for all non-narrative work.

**LLM usage guidance:** If any story needs AI-generated text (e.g., payment receipt messages, dunning emails), isolate LLM usage to a single function/module. Do not let LLM handle security-critical logic.

---

## 10. Open Decisions

Decisions needed **BEFORE** kickoff:

| # | Decision | Options | Recommendation | Impact if Deferred |
|---|----------|---------|----------------|-------------------|
| 1 | **Story slicing confirmed?** | (a) Accept 9-1, 9-3, 9-5 splits as proposed; (b) Modify splits; (c) No splits | Accept proposed splits (Option A) | Blocks story creation — cannot create story files without agreed scope |
| 2 | **Stripe account (test mode) created?** | Create new or use existing | Create before 9-3a kickoff | Blocks 9-3a development entirely |
| 3 | **Portal link token format and TTL?** | (a) JWT with embedded claims; (b) Opaque token + DB lookup; (c) HMAC-signed token | Opaque token + DB lookup (Option B) — simpler revocation, audit trail | Blocks 9-1a design decisions |
| 4 | **Subscription grace period: fixed 7 days or configurable?** | (a) Hardcoded 7 days; (b) Configurable via `app_config` | Configurable via `app_config` (Option B) — spike already specifies this pattern | Low impact — can default to 7, add config later |
| 5 | **Free tier 5% fee: line item or Stripe Connect?** | (a) Line item on invoice (MVP); (b) Stripe Connect Application Fee | Line item (Option A) for MVP — Stripe Connect deferred to Agency+ Phase 2 | Low impact — spike recommends deferral |
| 6 | **Recurring invoice scheduler: pg-boss or Trigger.dev?** | (a) pg-boss (already in stack); (b) Trigger.dev (also planned) | pg-boss (Option A) — already used for agent orchestration, no new dependency | Medium impact — affects 9-6 architecture |
| 7 | **Stripe Checkout or Embedded Payment Form?** | (a) Stripe Checkout (redirect); (b) Embedded (in-app) | Stripe Checkout (Option A) for MVP — SAQ A, less code, mobile-responsive | Low impact — can migrate to embedded later |

---

## 11. Implementation Order (Recommended)

Based on dependency analysis, risk sequencing (highest-risk first), and parallel work opportunities:

```
Sprint 1: Foundation
  9-3a: Stripe Webhook Infrastructure         [3-4 days] Backend-only, no UI dependency
  9-1a: Portal Auth & Layout                  [3-4 days] Portal foundation, security-critical
  → Parallel: 9-3a and 9-1a have zero dependencies

Sprint 2: Portal Features
  9-1b: Portal Branding & Theming             [2 days]   CSS/theme, depends on 9-1a
  9-2:  Client Portal Invoice Payment         [3-4 days] CRUD in portal, depends on 9-1a
  9-3b: Checkout & Portal Integration         [2-3 days] Frontend + Stripe, depends on 9-3a
  → Parallel: 9-1b, 9-2, and 9-3b can run concurrently

Sprint 3: Subscription System
  9-4:  Subscription Tiers & Tier Limits      [2-3 days] Data-driven, depends on 9-3a
  9-5a: Lifecycle State Machine              [2-3 days] Complex backend, depends on 9-4
  → Sequential: 9-4 → 9-5a (state machine needs tier definitions)

Sprint 4: Completion
  9-5b: Agent Pause & Downgrade Handling      [2-3 days] Agent integration, depends on 9-5a
  9-6:  Recurring Invoices                    [2-3 days] Follows invoice patterns, depends on 9-5a
  9-7:  Billing Accuracy & Usage Visibility   [2-3 days] Reporting/monitoring, depends on 9-5a
  → Parallel: 9-5b, 9-6, and 9-7 can run concurrently
```

**Total estimated duration:** 4 sprints, ~18-26 dev-days

**Critical path:** 9-3a → 9-4 → 9-5a → {9-5b, 9-6, 9-7}

---

## 12. Go/No-Go Assessment

| Dimension | Status | Notes |
|-----------|--------|-------|
| Prerequisites complete | ✅ | All 6 items resolved: Supabase local, service_role audit, 8-3 green-phase, deferred pgTAP, Stripe spike, finding density tracking |
| Stories defined | ✅ | 7 stories in epics.md with ACs for all stories |
| Stripe spike complete | ✅ | Architecture (Stripe ↔ Supabase), schema (workspace columns, dedup table, app_config), risks (6 identified), implementation sequence documented |
| Security surface understood | ✅ | 4 attack surfaces identified: unauthenticated portal, webhook endpoint, payment flow, subscription manipulation |
| Story slicing planned | ⬜ | 9-1, 9-3, 9-5 splits recommended — pending team approval |
| Agent models assigned | ⬜ | Deterministic recommended for 9/10 slices — pending team review |
| Testing strategy defined | ✅ | pgTAP gate enforced, per-story test plan with P0/P1 priorities, Stripe test mode documented |
| Finding density data available | ✅ | Per-story tracking from Epic 8, financial domain baseline (23 avg), split impact documented |
| External dependencies ready | ⬜ | Stripe test account, Stripe CLI, Vercel env vars — need setup before Sprint 1 |
| Open decisions resolved | ⬜ | 7 decisions identified — 3 critical (slicing, Stripe account, token format), 4 configurable |

### Verdict

**READY** for Epic 9 kickoff pending:
1. Team review of story slicing recommendations (3 splits)
2. Stripe test account creation
3. Portal token format decision
4. External dependency setup (Stripe CLI, env vars)

**Recommended next step:** Schedule 30-minute planning review session with team to resolve open decisions, then create story files for Sprint 1 (9-3a and 9-1a).

---

## Appendix A: Reference Documents

- **PRD:** `_bmad-output/planning-artifacts/prd.md` — FR8, FR15, FR37, FR39, FR42, FR44, FR51-62, FR82
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — Subscription state machine, webhook pattern, cache policy
- **Epics:** `_bmad-output/planning-artifacts/epics.md` — Epic 9 story specs (lines 1504-1619)
- **Stripe spike:** `_bmad-output/planning-artifacts/stripe-subscription-spike.md` — Full integration design
- **Epic 8 retro:** `_bmad-output/implementation-artifacts/epic-8-retro-2026-06-10.md` — Prerequisites and carry-forwards
- **Finding density:** `_bmad-output/implementation-artifacts/agent-model-finding-density-tracking.md` — Model selection data
- **Project context:** `docs/project-context.md` — 180 technical rules
- **Stripe docs:** Subscriptions overview, Customer Portal, Webhook best practices

## Appendix B: Epic 8 Retro Carry-Forwards

| # | Epic 8 Lesson | Application in Epic 9 |
|---|---------------|----------------------|
| 1 | Story re-slicing is a superpower | Applied to 9-1, 9-3, 9-5 (3 splits recommended) |
| 2 | service_role without workspaceId is #1 systemic risk | Critical for 9-1, 9-2 — portal exposes app to anon users. Audit completed but must be verified under new access patterns. |
| 3 | Deterministic > LLM for non-narrative work | 9/10 slices recommended as deterministic. LLM only considered for 9-3a (Stripe API complexity). |
| 4 | Supabase local is non-negotiable | pgTAP gate enforced for all stories. 45/45 files passing. |
| 5 | Conditional-write pattern for mutable shared state | Apply to webhook dedup (`INSERT ... ON CONFLICT DO NOTHING`) and subscription state transitions (`UPDATE ... WHERE status = $expected`). |
| 6 | Shared helpers in packages, not apps | Billing queries go in `@flow/db/queries` from the start. Portal helpers in `packages/shared/`. |
| 7 | Track model per story from Epic 9 onward | Finding density table must be populated during each story's dev cycle. |

## Appendix C: Close-Out Checklist (run before `epic-9-retrospective: done`)

Triggered once all Epic 9 stories are `done` and the retrospective is opened.

- [ ] **Graphify semantic re-extraction (deferred from per-story runs).** The git post-commit hook keeps **code** AST nodes current for free, but **markdown/prose** (`planning-artifacts/`, `implementation-artifacts/`) needs an LLM batch to refresh the `INFERRED` concept/edge layer. Run once over both directories:
  ```bash
  OLLAMA_API_KEY=x graphify _bmad-output/planning-artifacts/ --update \
    --backend ollama --model qwen2.5:14b --max-concurrency 1
  OLLAMA_API_KEY=x graphify _bmad-output/implementation-artifacts/ --update \
    --backend ollama --model qwen2.5:14b --max-concurrency 1
  ```
  Prereq: `pip install openai` (graphify's ollama backend uses the OpenAI-compatible client). This is **not** a code-quality gate — it refreshes traceability/coverage-gap/drift queries for the retrospective (`/graphify coverage`, `/graphify drift`, `/graphify path "FR52" "<code>"`).
- [ ] Epic 9 ATDD: all P0 acceptance tests green (currently 163/163 contract-phase).
- [ ] pgTAP: all Epic 9 RLS test files passing (portal_tokens, portal_role, portal-branding, + new portal-invoice-report-rls from 9-2).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean.
- [ ] service_role audit re-verified under portal access patterns (Epic 8 carry-forward #2).
- [ ] Finding-density table populated for every Epic 9 story (carry-forward #7).
