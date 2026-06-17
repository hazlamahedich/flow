# Story 9.3b: Checkout & Customer Portal Integration

Status: ready-for-dev

<!--
Slice of 9.3 (split per epic-9-planning-review.md §6). Parent key
`9-3-stripe-payment-integration-webhook-processing` is `deprecated` (split → 9-3a + 9-3b).
This is the FRONTEND slice — depends on 9-3a (DONE): webhook handler already
activates subscriptions from `checkout.session.completed` (mode=subscription) and
syncs `customer.subscription.updated/deleted`.

CRITICAL — DO NOT REINVENT. 9-3a already shipped the subscription side effects:
  - apps/web/lib/stripe/handlers/checkout-completed.ts → activateSubscription()
      reads metadata.workspace_id (SNAKE_CASE), expands subscription via provider,
      maps priceId→tier via getTierConfig().stripePrices, upserts via RPC.
  - apps/web/lib/stripe/handlers/subscription-updated.ts → syncs status/tier/period,
      maps cancel_at_period_end, handles subscription.deleted → 'cancelled'.
  - packages/db RPCs: upsert_workspace_subscription + set_workspace_subscription_status
      (SECURITY DEFINER, granted to authenticated + service_role).
9-3b only adds: user-facing Server Actions (create checkout/portal sessions,
cancel/reactivate), a syncStripeData() success-redirect fallback, the billing
settings page UI, and the provider + types extension those actions require.

ATDD scaffold (RED, currently passing via vi.hoisted stubs):
  apps/web/__tests__/acceptance/epic-9/9-3b-checkout-portal-integration.spec.ts
-->

## Story

As a workspace owner,
I want to upgrade my subscription via Stripe Checkout, manage my billing through the Stripe Customer Portal, and cancel/reactivate at period end,
so that I can self-serve billing through Stripe-hosted handoffs launched from Flow OS (FR55, FR58).

> Stakeholder impact: owners see current tier, usage, and billing history on a settings page; upgrade/cancel flows hand off to Stripe-hosted pages; the webhook (9-3a) records the resulting state. Clients/portal users do NOT touch this story (one-time invoice checkout belongs to 9-2).

## Traceability

| AC | Scenario | PRD / NFR tag |
|---|---|---|
| AC1 | Subscription checkout session action (Free→Pro/Agency) | **FR55** |
| AC2 | Stripe Customer Portal session action | FR58 |
| AC3 | Cancel / reactivate subscription actions | FR58 |
| AC4 | syncStripeData() success-redirect fallback | FR42 (reliability) |
| AC5 | Billing settings page (tier, history, manage) | **FR55**, FR58 |
| AC6 | Provider abstraction extension (subscription checkout + portal) | **FR55** |
| AC7 | Types + error codes | FR58 |

## Acceptance Criteria

0. **[AC0 — Test-First]** The ATDD scaffold `apps/web/__tests__/acceptance/epic-9/9-3b-checkout-portal-integration.spec.ts` and a new unit scaffold `apps/web/__tests__/billing/9-3b-checkout-portal.spec.ts` exist and are **red** before implementation. Story cannot be marked `in-progress` until the test files with failing tests are created. During GREEN phase, remove the `vi.hoisted`/`vi.mock` stubs and replace with real imports so the 13 ATDD tests assert real behavior. Reconcile the mock path `@/lib/supabase-server` → `getServerSupabase` (the real action uses `getServerSupabase()` from `@/lib/supabase-server`, NOT `@flow/db` `createServiceClient` — these are **user-facing** actions; service_role is forbidden here per project-context.md:150). Record the first red-phase commit SHA in the Test Commit Record below.

1. **[AC1 — createCheckoutSessionAction (FR55)]** A Server Action `createCheckoutSessionAction(input: unknown): Promise<ActionResult<{ url: string }>>` is exported from `apps/web/lib/actions/billing/create-checkout-session.ts`. It:
   - Validates input with `createCheckoutSessionSchema` (Zod: `tier: z.enum(['pro','agency'])`, `interval: z.enum(['monthly'])`) — defined in `packages/types/src/subscription.ts`, exported from `@flow/types`. The separate `subscriptionTierSchema` (`free|pro|agency`) is used for reading workspace state, not for checkout input.
   - Calls `requireTenantContext(supabase)` and rejects with `createFlowError(403, 'FORBIDDEN', 'Only owners can manage billing.', 'auth')` when `ctx.role !== 'owner'`.
   - Reads the workspace row's `stripe_customer_id`. If absent, **lazily creates** a Stripe Customer via `provider.createCustomer({ email, name, workspaceId: ctx.workspaceId, metadata: { workspace_id: ctx.workspaceId } })` and persists `stripe_customer_id` to the workspaces row **before** creating the checkout session. Customer creation must be idempotent: use Stripe idempotency key `customer:${ctx.workspaceId}` and, on retry, reuse an existing persisted `stripe_customer_id` to avoid duplicate Stripe customers (EC1/EC2).
   - Resolves the target `priceId` from `getTierConfig().stripePrices` (only `pro_monthly` + `agency_monthly` are seeded today; reject any tier/interval with no price mapping with `createFlowError(400, 'SYSTEM_CONFIG_MISSING', 'Selected plan is not available.', 'system')` — `getTierConfig()` already throws on `price_placeholder_*` sentinels; wrap that in the same SYSTEM_CONFIG_MISSING error).
   - Calls the **new** `provider.createSubscriptionCheckoutSession({ customerId, priceId, successUrl, cancelUrl, metadata: { workspace_id: ctx.workspaceId }, idempotencyKey: checkout:${ctx.workspaceId}:${tier}:${interval} })` (AC6) and returns `{ success: true, data: { url } }` where `url` matches `^https://checkout\.stripe\.com/` (or `.checkout.stripe.com/`).
   - `successUrl` = `${getAppUrl()}/settings/billing?sync=1&session_id={CHECKOUT_SESSION_ID}`; `cancelUrl` = `${getAppUrl()}/settings/billing?status=cancel`. (`{CHECKOUT_SESSION_ID}` is Stripe's literal placeholder.) Reuse `getAppUrl()` from `apps/web/lib/actions/portal/helpers.ts`.
   - Never accepts `workspaceId` from the client — uses `ctx.workspaceId` only (project-context.md:136).

2. **[AC2 — createPortalSessionAction (FR58)]** A Server Action `createPortalSessionAction(input?: unknown): Promise<ActionResult<{ url: string }>>` is exported from `apps/web/lib/actions/billing/create-portal-session.ts`. It enforces owner role (AC1 pattern), reads the workspace's `stripe_customer_id`, and:
   - Returns `createFlowError(409, 'NOT_CONFIGURED', 'No Stripe customer is linked to this workspace.', 'financial')` when `stripe_customer_id` is null/empty.
   - Calls the **new** `provider.createPortalSession({ customerId, returnUrl: \`${getAppUrl()}/settings/billing\` })` (AC6) and returns `{ success: true, data: { url } }` where `url` matches `^https://billing\.stripe\.com/`. Reuse `getAppUrl()` from `apps/web/lib/actions/portal/helpers.ts`.

3. **[AC3 — cancel/reactivate (FR58)]** Two Server Actions in `apps/web/lib/actions/billing/subscription-manage.ts`:
   - `cancelSubscriptionAction(input?: unknown): Promise<ActionResult<{ cancelAtPeriodEnd: true }>>` — owner-gated. Reads `stripe_subscription_id` + `subscription_status`. Returns `createFlowError(409, 'NO_ACTIVE_SUBSCRIPTION', 'No active subscription to cancel.', 'financial')` when `subscription_status === 'free'` or `stripe_subscription_id` is null. Otherwise calls `provider.cancelSubscription(stripe_subscription_id, false)` (false = cancel at period end — user keeps access through the current period) and returns `{ success: true, data: { cancelAtPeriodEnd: true } }`. Does **not** write local DB state — the `customer.subscription.updated` webhook (9-3a) sets `subscription_cancel_at_period_end=true`; do not race the webhook. After a successful Stripe call, invalidate the workspace cache tag so the UI refreshes promptly.
   - `reactivateSubscriptionAction(input?: unknown): Promise<ActionResult<{ reactivated: true }>>` — owner-gated. Rejects `free`/no-subscription with `NO_ACTIVE_SUBSCRIPTION`. Calls `provider.resumeSubscription(stripe_subscription_id)` (sets `cancel_at_period_end: false`). Returns success. Webhook reconciles local state. Invalidate the workspace cache tag after success.
   - The billing UI must show a confirmation step (modal or destructive form submit with confirm) before invoking `cancelSubscriptionAction` to prevent accidental cancellation. 

4. **[AC4 — syncStripeDataAction success-redirect fallback (FR42 reliability)]** A Server Action `syncStripeDataAction(input: { sessionId?: string }): Promise<ActionResult<{ synced: true }>>` exported from `apps/web/lib/actions/billing/sync-stripe-data.ts`. Owner-gated. On load of the billing page with `?sync=1` (the success redirect), the page calls this action. It is the split-brain recovery path and must NOT rely solely on webhooks:
   - Read the workspace row's `stripe_subscription_id` and `stripe_customer_id` from the authenticated tenant context (`ctx.workspaceId`).
   - If `stripe_subscription_id` is set: call `provider.getSubscription(stripe_subscription_id)`, verify the returned subscription's `customerId` matches `workspace.stripe_customer_id`, then call `upsert_workspace_subscription` via the **user-scoped** Supabase client after the owner check. The RPC is SECURITY DEFINER and granted to `authenticated`, so `service_role` is unnecessary here. **Never use client-supplied `sessionId` to choose the write target.**
   - If `stripe_subscription_id` is null but `sessionId` is provided: fetch the Stripe Checkout Session `GET /v1/checkout/sessions/{sessionId}` expanded with `subscription`, extract the subscription ID, verify `customerId === workspace.stripe_customer_id`, then upsert via the same RPC path.
   - If both are missing: return no-op success.
   - Wrap all external calls in try/catch; the action always returns `{ success: true, data: { synced: true } }` (best-effort fallback, never blocks render). Webhook remains source of truth; "already in target state" = success per project-context.md:494. 

5. **[AC5 — Billing settings page (FR55, FR58)]** `apps/web/app/(workspace)/settings/billing/page.tsx` is a **Server Component** (no `"use client"`; default export). It reads the workspace row (tier, status, period, `cancel_at_period_end`, `stripe_customer_id`) and recent invoices via `getServerSupabase()` + `requireTenantContext()`, then passes data to child client components for interactivity. The page renders:
   - A current-plan card (tier, status, current period start/end, "Cancels at period end" badge when applicable).
   - Plan cards for upgrade (Free→Pro, Free→Agency, Pro→Agency) — each wrapped in a client component using `<form action={createCheckoutSessionAction}>` with `useActionState` (project-context.md:138).
   - A "Manage billing" button → `createPortalSessionAction` (Stripe Customer Portal).
   - Cancel / Reactivate buttons (conditionally rendered) → `cancelSubscriptionAction` / `reactivateSubscriptionAction`; cancel must require confirmation.
   - A billing-history list (most recent Flow OS invoices from the `invoices` table for this workspace; Stripe subscription invoice history is deferred to 9-7).
   - A client `SyncBanner` component that reads `?sync=1` and `?status=cancel` search params and shows the corresponding success / cancellation-return banner.
   Add `{ href: '/settings/billing', label: 'Billing' }` to `settingsTabs` in `apps/web/app/(workspace)/settings/layout.tsx` (e.g., after "Team" or at the end of the array).
   **Out of scope (deferred to 9-4 / 9-7):** tier-limit enforcement badges, 5% free-tier fee notice, full usage metering dashboard, dispute window display, downgrade/cross-grade checkout flows (Pro→Agency or Agency→Pro are upgrades; downgrade to Free is cancel-at-period-end; other downgrades deferred to 9-5a/FR57).

6. **[AC6 — Provider abstraction extension (FR55)]** Extend (do not break) the existing `PaymentProvider` interface (`packages/agents/providers/payment-provider.ts`) and `StripePaymentProvider` (`packages/agents/providers/stripe/stripe-payment-provider.ts`) with two new methods — raw `fetch()` to Stripe REST API, NO `stripe` npm SDK:
   - `createSubscriptionCheckoutSession(params: { customerId: string; priceId: string; successUrl: string; cancelUrl: string; metadata: Record<string, string>; idempotencyKey?: string }): Promise<CheckoutSession>` — `POST /checkout/sessions` with `mode: 'subscription'`, `line_items: [{ price: priceId, quantity: 1 }]`, `customer`, `success_url`, `cancel_url`, `metadata`, `subscription_data.metadata`. Returns `{ url, sessionId }`.
   - `createPortalSession(params: { customerId: string; returnUrl: string; configuration?: string }): Promise<PortalSession>` — `POST /billing_portal/sessions` with `customer`, `return_url`. Returns `{ url }`. (One-time portal `configuration` creation is a manual Stripe Dashboard step — do NOT script it in code; documented in Dev Notes.)
   Existing `createCustomer`, `getSubscription`, `cancelSubscription(id, immediately)`, `resumeSubscription(id)` are ALREADY implemented — reuse, do not rewrite.
   > Note: The `Subscription.status` union currently uses American spelling `'canceled'`. The DB CHECK constraint in 9-3a and the `subscriptionStatusSchema` in this story use British spelling `'cancelled'`. Update `PaymentProvider` `Subscription.status` to `'cancelled'` (and map Stripe `'canceled'` → `'cancelled'` in `StripePaymentProvider`) so types align with the database. 

7. **[AC7 — Types + error codes (FR58)]**
   - Create `packages/types/src/subscription.ts` with Zod schemas:
     - `subscriptionTierSchema` = `z.enum(['free','pro','agency'])` — used when reading workspace subscription tier/status.
     - `upgradableTierSchema` = `z.enum(['pro','agency'])` — used for checkout input (free cannot be checked out).
     - `billingIntervalSchema` = `z.enum(['monthly','yearly'])` — used for future yearly prices once seeded.
     - `checkoutIntervalSchema` = `z.enum(['monthly'])` — used for checkout input today.
     - `subscriptionStatusSchema` = `z.enum(['free','active','past_due','cancelled'])` — align to the **DB CHECK constraint**; `suspended`/`deleted`/`trialing` are NOT in the 9-3a migration and belong to 9-5a.
     - `createCheckoutSessionSchema` = `z.object({ tier: upgradableTierSchema, interval: checkoutIntervalSchema })`.
     - `createPortalSessionSchema` = `z.object({}).optional()` (or `z.void()`), documenting that the action accepts no meaningful input.
     - Infer and export TS types: `SubscriptionTier`, `UpgradableTier`, `BillingInterval`, `CheckoutInterval`, `SubscriptionStatus`, `CreateCheckoutSessionInput`, `CreatePortalSessionInput`.
   - Export all from `packages/types/src/index.ts`.
   - Add `'NOT_CONFIGURED'` and `'NO_ACTIVE_SUBSCRIPTION'` to the `FlowErrorCode` union in `packages/types/src/errors.ts`.

### Edge Case Matrix

Mandatory — financial flows, state transitions, Stripe split-brain.

| Case | Input / Condition | Expected Behavior | AC Ref |
|------|-------------------|-------------------|--------|
| EC1 | Owner upgrades Free→Pro with `stripe_customer_id` = null | Lazy-create Customer first, persist `stripe_customer_id`, then create checkout session | AC1 |
| EC2 | Owner calls upgrade twice rapidly (double-submit) | Stripe idempotency key `checkout:${workspaceId}:${tier}:${interval}` → second call returns same session; customer creation idempotency key `customer:${workspaceId}` prevents duplicate customers | AC1, AC6 |
| EC3 | `getTierConfig()` throws (placeholder prices not replaced) | Action returns `SYSTEM_CONFIG_MISSING` 400, never exposes the raw throw to the client | AC1 |
| EC4 | Non-owner (member/admin) calls any billing action | `FORBIDDEN` 403 before any Stripe call | AC1–AC4 |
| EC5 | `createPortalSessionAction` for workspace with `subscription_status='free'` but `stripe_customer_id` set | Returns portal URL (portal shows payment methods); only block when `stripe_customer_id` is null/empty | AC2 |
| EC6 | `cancelSubscriptionAction` for already-canceling subscription (`subscription_cancel_at_period_end=true`) | Webhook owns this state; action calls `cancelSubscription(id, false)` (idempotent), returns success | AC3 |
| EC7 | `reactivateSubscriptionAction` for already-expired subscription (period end passed) | `resumeSubscription` may fail with Stripe error → map to `STRIPE_ERROR` 502, do not fabricate success | AC3 |
| EC8 | Webhook delayed — success page loads before `checkout.session.completed` processed | `syncStripeDataAction` calls `upsert_workspace_subscription` synchronously as fallback; page shows optimistic "synced" banner; webhook later confirms (no-op) | AC4 |
| EC9 | `syncStripeDataAction` and webhook race on the same subscription | Both call `upsert_workspace_subscription`; RPC is idempotent by `stripe_subscription_id`, last-writer-wins on period (9-3a design) | AC4 |
| EC10 | `createPortalSessionAction` Stripe API failure (network/5xx) | Return `createFlowError(502, 'STRIPE_ERROR', 'Unable to open billing portal.', 'financial')` | AC2, AC6 |
| EC11 | `cancelSubscriptionAction` with `stripe_subscription_id` null but status `active` (data drift) | `NO_ACTIVE_SUBSCRIPTION` 409 — flag drift; reconciliation job (9-7) reconciles | AC3 |
| EC12 | Owner downgrades Pro→Free via portal (outside our UI) | `customer.subscription.deleted` webhook (9-3a) sets `cancelled`; our page reflects new state on next load. No action required from 9-3b | AC5 |
| EC14 | Owner cancels checkout or hits back from Stripe | Page lands on `/settings/billing?status=cancel`; UI shows informational cancellation-return banner | AC5 |

> This is a financial / state-machine story — the Edge Case Matrix is mandatory (per Epic 7 retro).

## Pre-Dev Dependency Scan

- [x] Graphify query run — key dependencies listed below
- [x] Dependencies (REUSE — do not reinvent):
  - **9-3a webhook handlers** (`apps/web/lib/stripe/handlers/checkout-completed.ts`, `subscription-updated.ts`) — **EXTEND nothing, REUSE as-is.** The subscription activation + sync path is complete. 9-3b only *triggers* the Stripe objects whose events these handlers consume.
   - **9-3a RPCs** (`upsert_workspace_subscription`, `set_workspace_subscription_status`) in `supabase/migrations/20260618000001_workspace_subscription_columns.sql` — call from `syncStripeDataAction` (AC4) via the **user-scoped** `getServerSupabase()` client after owner verification (the RPC is SECURITY DEFINER and granted to `authenticated`). Prefer RLS-enforced client; avoid `createServiceClient()` unless a concrete reason is documented.
   - **`StripePaymentProvider`** (`packages/agents/providers/stripe/stripe-payment-provider.ts`) — `createCustomer` (line 74), `getSubscription` (226), `cancelSubscription` (246, `at_period_end` toggle), `resumeSubscription` (253), `createCheckoutSession` (153, ONE-TIME only — do NOT reuse for subscriptions) are **already implemented**. **ADD** `createSubscriptionCheckoutSession` + `createPortalSession` (AC6). `getProviderName()` returns `'stripe'`; raw `fetch()` pattern via private `stripeRequest<T>()` + `flattenForForm()`.
   - **`PaymentProvider` interface** (`packages/agents/providers/payment-provider.ts:90-165`) — ADD the two new methods to the interface (AC6). `CheckoutSession` type already exists (line 85-88). Also update `Subscription.status` union spelling from `'canceled'` to `'cancelled'` to match DB CHECK.
  - **Provider registry** (`packages/agents/providers/registry.ts:68-75`) — `getPaymentProvider('stripe')` auto-registers; new methods are available with no registry change.
  - **`getTierConfig()`** (`apps/web/lib/config/tier-config.ts`) — React `cache()` wrapped; returns `{ tierLimits, stripePrices: { pro_monthly, agency_monthly }, windows, freeTransactionFeePercent }`. Throws on `price_placeholder_*` sentinels. Use this for price IDs — never hardcode.
  - **`workspaces` schema** (`packages/db/src/schema/workspaces.ts`) — all 8 subscription columns present (Drizzle). Read `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_tier`, `subscription_current_period_start/end`, `subscription_cancel_at_period_end`.
  - **`requireTenantContext` / `createFlowError` / `cacheTag` / `invalidateAfterMutation`** (`packages/db/src/rls-helpers.ts`, `packages/db/src/cache-policy.ts`) — exported from `@flow/db`. `requireTenantContext` returns `{ workspaceId, userId, role }` and THROWS `FlowErrorBase` on auth failure (catch + return in actions). `cacheTag('workspace', id)` → `'workspaces:{id}'`.
   - **`getServerSupabase`** (`apps/web/lib/supabase-server.ts`) — user-scoped client (RLS-enforced). Use in ALL 9-3b actions + the page, including the `syncStripeDataAction` RPC call. The `upsert_workspace_subscription` RPC is SECURITY DEFINER and granted to `authenticated`; `service_role` is unnecessary and should not be used in this user-facing action unless formally justified in an ADR.
   - **`getAppUrl()`** (`apps/web/lib/actions/portal/helpers.ts`) — canonical public app URL resolver used by 9-2; reuse for all 9-3b success/cancel/return URLs.
   - **`ActionResult<T>`** (`packages/types/src/action-result.ts`) — `{ success: true; data: T } | { success: false; error: FlowError }`. All actions return this.
  - **9-2 portal checkout pattern** (`apps/web/lib/actions/portal/pay-invoice.ts`) — reference for `getPaymentProvider('stripe').createCheckoutSession(...)` usage + idempotency key shape. ⚠️ 9-2 uses **camelCase** metadata; 9-3b MUST use **snake_case** `workspace_id` (the 9-3a `checkout-completed.ts:52` handler reads snake_case).
- [x] UX AC review — N/A (billing settings page follows existing settings tab patterns; no new UX-DR surfaces). Sally sign-off not required for a standard settings tab.
- [x] Architect sign-off: **Provider abstraction extension is mandatory.** Do NOT call Stripe REST directly from Server Actions — go through the `PaymentProvider` interface (project-context.md:174-177). The two new methods are added to the interface + `StripePaymentProvider`. `service_role` is forbidden in user-facing actions (project-context.md:150). `syncStripeDataAction` uses the authenticated owner-scoped client for its RPC call; no service_role exception is required because the RPC is granted to `authenticated` and SECURITY DEFINER.

## Tasks / Subtasks

- [ ] **T1 — Types + error codes** (AC: 7)
  - [ ] T1.1 Create `packages/types/src/subscription.ts`: `subscriptionTierSchema` (`free|pro|agency`), `upgradableTierSchema` (`pro|agency`), `subscriptionStatusSchema` (free/active/past_due/cancelled — DB-aligned), `billingIntervalSchema` (monthly/yearly), `checkoutIntervalSchema` (monthly), `createCheckoutSessionSchema` (`{ tier: upgradableTierSchema, interval: checkoutIntervalSchema }`), `createPortalSessionSchema` (optional/empty). Infer + export types (`SubscriptionTier`, `UpgradableTier`, `SubscriptionStatus`, `BillingInterval`, `CheckoutInterval`, `CreateCheckoutSessionInput`, `CreatePortalSessionInput`).
  - [ ] T1.2 Update `packages/agents/providers/payment-provider.ts`: add `PortalSession` type `{ url: string }`; add `createSubscriptionCheckoutSession` + `createPortalSession` methods; change `Subscription.status` from `'canceled'` to `'cancelled'`.
  - [ ] T1.3 Export subscription schemas/types from `packages/types/src/index.ts`.
  - [ ] T1.4 Add `'NOT_CONFIGURED'` + `'NO_ACTIVE_SUBSCRIPTION'` to `FlowErrorCode` in `packages/types/src/errors.ts`.
- [ ] **T2 — Provider extension** (AC: 6)
  - [ ] T2.1 Add `createSubscriptionCheckoutSession` + `createPortalSession` to `PaymentProvider` interface (`packages/agents/providers/payment-provider.ts`). Add `PortalSession` type `{ url: string }`. Ensure `Subscription.status` uses `'cancelled'` (British spelling) to match the DB CHECK constraint.
  - [ ] T2.2 Implement both in `StripePaymentProvider` (`packages/agents/providers/stripe/stripe-payment-provider.ts`) using the existing `stripeRequest<T>()` + `flattenForForm()` pattern. `createSubscriptionCheckoutSession` → `POST /v1/checkout/sessions` `mode='subscription'` + `line_items[0][price]` + `subscription_data[metadata]`. `createPortalSession` → `POST /v1/billing_portal/sessions`. Both map `StripeApiError` → throw (actions catch + map to FlowError). Update `mapSubscription` to map Stripe `'canceled'` → `'cancelled'`.
- [ ] **T3 — createCheckoutSessionAction** (AC: 1)
  - [ ] T3.1 Create `apps/web/lib/actions/billing/create-checkout-session.ts` (`'use server'`). Validate with `createCheckoutSessionSchema`. `requireTenantContext` → owner guard. Read workspace `stripe_customer_id`; lazy-create Customer if null (idempotency key `customer:${ctx.workspaceId}`) + persist via RLS update. Resolve priceId from `getTierConfig()`. Call `provider.createSubscriptionCheckoutSession(...)` with idempotency key `checkout:${ctx.workspaceId}:${tier}:${interval}`. Return `ActionResult<{ url }>`.
  - [ ] T3.2 Add rate-limit helper call (e.g., `check_rate_limit` RPC) per workspace for checkout creation.
- [ ] **T4 — createPortalSessionAction** (AC: 2)
  - [ ] T4.1 Create `apps/web/lib/actions/billing/create-portal-session.ts`. Owner guard. Validate optional empty input via `createPortalSessionSchema`. Read `stripe_customer_id` → `NOT_CONFIGURED` if null. Call `provider.createPortalSession(...)`. Return `ActionResult<{ url }>`. Add per-workspace rate limiting.
- [ ] **T5 — cancel/reactivate actions** (AC: 3)
  - [ ] T5.1 Create `apps/web/lib/actions/billing/subscription-manage.ts` with `cancelSubscriptionAction` + `reactivateSubscriptionAction`. Owner guard. `NO_ACTIVE_SUBSCRIPTION` for `free`/null subscription id. Call provider; map Stripe errors to `STRIPE_ERROR`. Cache invalidate `'workspace'` after.
- [ ] **T6 — syncStripeDataAction** (AC: 4)
  - [ ] T6.1 Create `apps/web/lib/actions/billing/sync-stripe-data.ts`. Owner guard. Read `stripe_subscription_id` + `stripe_customer_id` under the authenticated tenant context. If `stripe_subscription_id` set, call `provider.getSubscription(id)`, verify `customerId === workspace.stripe_customer_id`, then call `upsert_workspace_subscription` via `getServerSupabase()` (user-scoped). If `stripe_subscription_id` is null but `sessionId` provided, fetch Stripe Checkout Session expanded with subscription, extract subscription ID, verify customer match, then upsert. try/catch — always return `{ success: true, data: { synced: true } }`. No-op if no subscription and no sessionId.
- [ ] **T7 — Billing settings page** (AC: 5)
  - [ ] T7.1 Create `apps/web/app/(workspace)/settings/billing/page.tsx` (Server Component, default export). Fetch workspace + recent invoices (from local `invoices` table). Pass data to client child components.
  - [ ] T7.2 Create `apps/web/app/(workspace)/settings/billing/components/` — `PlanCard.tsx`, `ManageBillingButton.tsx`, `SubscriptionActions.tsx`, `BillingHistory.tsx`, `SyncBanner.tsx` (reads `?sync=1` and `?status=cancel`, uses `useActionState` for forms). Keep each ≤80 lines.
  - [ ] T7.3 Add `{ href: '/settings/billing', label: 'Billing' }` to `settingsTabs` in `apps/web/app/(workspace)/settings/layout.tsx` (e.g., after "Team" or at end).
  - [ ] T7.4 Add confirmation UX in `SubscriptionActions` before calling `cancelSubscriptionAction`.
- [ ] **T8 — Red/Green the ATDD + unit tests** (AC: 0)
  - [ ] T8.1 **Create the red-phase unit scaffold** `apps/web/__tests__/billing/9-3b-checkout-portal.spec.ts` **before marking `in-progress`**. It should import the not-yet-implemented actions and fail. Record its first failing commit SHA in the Test Commit Record.
  - [ ] T8.2 ATDD greened — rewrite the existing 13 tests to call the **real** actions/components with mocked boundaries (`getServerSupabase`, `requireTenantContext`, `getPaymentProvider('stripe')`, `getTierConfig`). Remove all `vi.hoisted` stubs for billing actions and the page. Assert provider method calls and args (including `metadata.workspace_id` and `subscription_data.metadata.workspace_id`), error codes, and Server Component status (file source has no top-level `"use client"`). Add new ATDD tests for `syncStripeDataAction`, `SYSTEM_CONFIG_MISSING`, and `STRIPE_ERROR`.
  - [ ] T8.3 `apps/web/__tests__/billing/9-3b-checkout-portal.spec.ts` — unit tests covering EC1–EC14: lazy customer creation + idempotency, FORBIDDEN role, price resolution + SYSTEM_CONFIG_MISSING, NOT_CONFIGURED, NO_ACTIVE_SUBSCRIPTION, cancel-at-period-end + no local DB write, reactivate + expired mapping, syncStripeData fallback paths (subscription ID present, sessionId present, no-op), provider form-encoded bodies, idempotency key shape, `createServiceClient` used nowhere except if justified. Mock the provider + `getTierConfig` + Supabase client.
- [ ] **T9 — Quality gates** (AC: 0, 6)
  - [ ] T9.1 `pnpm typecheck` (0 errors — includes new types + provider methods). `pnpm lint` (0 errors).
  - [ ] T9.2 `pnpm test` (no regressions; new tests green). No new pgTAP file required for 9-3b if 9-3a already covers owner-only RLS on `workspaces` subscription columns; otherwise add one test verifying owner can update `stripe_customer_id` and non-owner cannot read/write subscription columns.
  - [ ] T9.3 Verify file sizes: action files <200 lines soft (250 hard); `stripe-payment-provider.ts` is currently 521 — the 2 new methods (~30 lines) push it to ~550; if it approaches 600, extract a `stripe-checkout.ts` helper, otherwise leave (provider is cohesive).

## Dev Notes

### Architecture Compliance (non-negotiable)

- **App Router only; Server Actions for all mutations.** No Route Handlers in this slice (the one sanctioned webhook route is 9-3a). The billing page is a Server Component; client interactivity lives in child components under `billing/components/` (project-context.md:43, 315).
- **`'use server'` placement:** top of each `actions/billing/*.ts` file. The page may use inline `'use server'` delegating wrappers OR import the standalone actions — prefer standalone files (project-context.md:315).
- **RLS is the perimeter; `service_role` ONLY in system webhooks/agents.** 9-3b actions are **user-facing** → use `getServerSupabase()` + `requireTenantContext()`. The **single exception** is `syncStripeDataAction`'s fallback `upsert_workspace_subscription` RPC call, which mirrors the webhook's system-reconciliation role (project-context.md:150, 212). Never expose `createServiceClient()` to the checkout/portal/cancel/reactivate actions.
- **Never trust client `workspace_id`.** Always `ctx.workspaceId` from `requireTenantContext` (project-context.md:136).
- **Provider abstraction is mandatory.** Server Actions import `getPaymentProvider` from `@flow/agents/providers`, never `StripePaymentProvider` directly and never `fetch('https://api.stripe.com/...')` directly. The two new methods live on the interface + provider (project-context.md:174-177).
- **Zod as cross-layer contract.** Input schemas in `packages/types/src/subscription.ts`, validated in every action (project-context.md:59).
- **Financial Result type — no throwing for business logic.** All actions return `ActionResult<T>`; Stripe API failures map to `STRIPE_ERROR` 502 (project-context.md:329-333, 450). Money is integer cents (not applicable to checkout URL generation, but keep consistent).
- **`::text` JWT cast** is handled inside `requireTenantContext` (already correct). No new RLS policies in this slice.
- **Named exports only** (default export only for the Next.js page component). **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — strict mode, `noUncheckedIndexedArrayAccess`, `exactOptionalPropertyTypes`.
- **200 lines/file soft (250 hard).** Each action file is small (~40-70 lines). The billing page + components must be split to stay under the limit. `stripe-payment-provider.ts` grows ~30 lines — acceptable (cohesive provider module).

### What 9-3b REUSES vs ADDS

**REUSES (do not rewrite):**
- 9-3a webhook subscription handlers + RPCs (activateSubscription, upsert_workspace_subscription, set_workspace_subscription_status)
- `StripePaymentProvider.createCustomer / getSubscription / cancelSubscription / resumeSubscription`
- `getTierConfig()` (cached price + limit reader)
- `requireTenantContext`, `createFlowError`, `cacheTag`, `invalidateAfterMutation`, `ActionResult`
- `getServerSupabase` (user client)

**ADDS (9-3b scope):**
- `PaymentProvider.createSubscriptionCheckoutSession` + `createPortalSession` (interface + impl)
- `packages/types/src/subscription.ts` (schemas/types)
- `NOT_CONFIGURED` + `NO_ACTIVE_SUBSCRIPTION` error codes
- 4 Server Actions: create-checkout, create-portal, subscription-manage (cancel/reactivate), sync-stripe-data
- Billing settings page + components + layout tab

### Stripe Customer Portal configuration (one-time, manual — do NOT script)

Per spike §4.3, the Customer Portal configuration is created **once** in the Stripe Dashboard (or via a one-off script run against test mode). 9-3b code only **creates sessions** against the configured portal. Document the required config in a `BILLING_SETUP.md` note (optional) or Dev Agent Record:
- `business_profile.headline: 'Flow OS Billing'`
- `features.payment_method_update.enabled: true`
- `features.invoice_history.enabled: true`
- `features.subscription_cancel.enabled: true`, `mode: 'at_period_end'`, `cancellation_reason.enabled: true`
- `features.subscription_pause.enabled: false`

Do NOT add a `createBillingPortalConfiguration` method or run it on app boot — configurations are environment-specific (test/live differ).

### Split-brain mitigation (spike §9.1)

Stripe is source of truth; Supabase mirrors for fast reads. The webhook (9-3a) is the primary sync path. `syncStripeDataAction` (AC4) is the **synchronous fallback** for webhook delivery delay/failure — the success redirect page calls it on load. It must be idempotent (the `upsert_workspace_subscription` RPC is) and best-effort (never block the page render). This satisfies the spike requirement "never rely solely on webhooks."

### Metadata convention (CRITICAL)

Use **snake_case** `workspace_id` in all Stripe object metadata (Customer, Checkout Session, Subscription). The 9-3a `checkout-completed.ts:52` + `subscription-updated.ts` handlers read `metadata.workspace_id`. ⚠️ 9-2's portal pay action (`pay-invoice.ts:116`) uses **camelCase** `workspaceId` — this is a known inconsistency in 9-2; do NOT replicate it in 9-3b. (9-2 reads its own metadata correctly in its own path; the subscription path is snake_case.)

### Lazy customer creation (EC1)

Free-tier users have no `stripe_customer_id` until first checkout. `createCheckoutSessionAction` creates the Customer on demand (spike §9.2 Q1). Persist `stripe_customer_id` to the workspace row **before** creating the checkout session so the webhook's customer-lookup fallback (`findWorkspaceIdByCustomer`) works even if metadata is stripped. Use Stripe idempotency key `customer:${ctx.workspaceId}` for `createCustomer` and reuse an already-persisted `stripe_customer_id` on retry to avoid duplicate Stripe customers.

### Project Structure Notes

```
apps/web/
  app/(workspace)/settings/
    layout.tsx                                   # MODIFY (T7.3) — add Billing tab
    billing/                                     # NEW
      page.tsx                                   # NEW (T7.1) — Server Component, default export
      components/                                # NEW
        PlanCard.tsx
        ManageBillingButton.tsx
        SubscriptionActions.tsx
        BillingHistory.tsx
        SyncBanner.tsx
  lib/actions/billing/                           # NEW folder
    create-checkout-session.ts                   # NEW (T3)
    create-portal-session.ts                     # NEW (T4)
    subscription-manage.ts                       # NEW (T5) — cancel + reactivate
    sync-stripe-data.ts                          # NEW (T6)
  __tests__/billing/
    9-3b-checkout-portal.spec.ts                 # NEW (T8.2)
packages/
   types/src/
     subscription.ts                              # NEW (T1.1)
     index.ts                                     # MODIFY (T1.3) — export subscription schemas
     errors.ts                                    # MODIFY (T1.4) — 2 new error codes
   agents/providers/
     payment-provider.ts                          # MODIFY (T1.2 + T2.1) — Subscription.status spelling, 2 methods, PortalSession type
     stripe/stripe-payment-provider.ts            # MODIFY (T2.2) — implement 2 methods + map 'canceled' → 'cancelled'
apps/web/__tests__/acceptance/epic-9/
  9-3b-checkout-portal-integration.spec.ts       # GREEN (T8.1)
```

No new migrations. No changes to `packages/db` schema (workspaces columns already present). If 9-3a's migration/test does not already assert owner-only RLS on the subscription columns, add a pgTAP test in this slice to verify it (T9.2).

### Testing Requirements

- **Vitest (unit):** `apps/web/__tests__/billing/9-3b-checkout-portal.spec.ts` — EC1–EC14, action return shapes, owner/FORBIDDEN, NOT_CONFIGURED, NO_ACTIVE_SUBSCRIPTION, SYSTEM_CONFIG_MISSING, STRIPE_ERROR, provider method calls and form-encoded bodies, idempotency key shape, syncStripeData fallback paths, no service_role in user-facing actions. Mock the provider via the registry — assert the action calls `createSubscriptionCheckoutSession` / `createPortalSession` / `cancelSubscription` / `resumeSubscription` with correct args.
- **Vitest (ATDD):** `9-3b-checkout-portal-integration.spec.ts` — rewrite the 13 tests to call real actions/components with mocked boundaries; add tests for `syncStripeDataAction`, `SYSTEM_CONFIG_MISSING`, `STRIPE_ERROR`, and Server Component status.
- **pgTAP:** Only required if 9-3a does not already cover owner-only RLS on `workspaces` subscription columns. If needed, add one test file verifying owner update of `stripe_customer_id` and non-owner read/write denial.
- **E2E:** optional (deferred) — a full Stripe test-mode checkout→success→sync flow is valuable but blocked on real Stripe test prices replacing the `price_placeholder_*` sentinels in `app_config.stripe_prices`. Document the manual E2E in Dev Agent Record if performed.

### Environment Prerequisites (block dev if missing)

- `STRIPE_SECRET_KEY` (server-side — already used by `StripePaymentProvider`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client-side — not strictly needed for redirect-based checkout, but set for consistency)
- Stripe test-mode **Products + Prices** — IDs must replace the `price_placeholder_pro_monthly` / `price_placeholder_agency_monthly` sentinels in `app_config.stripe_prices` before any real checkout (seed script or manual SQL UPDATE). `getTierConfig()` throws until this is done — unit tests mock `getTierConfig` to bypass; manual/E2E requires real prices.
- Stripe Customer Portal **configuration** created in test mode (see "Stripe Customer Portal configuration" above).
- `getAppUrl()` from `apps/web/lib/actions/portal/helpers.ts` resolves the public origin from `NEXT_PUBLIC_APP_URL` or `VERCEL_URL`. Reuse it for all 9-3b success/cancel/return URLs.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.3] — story statement + ACs (lines 1545-1559)
- [Source: _bmad-output/planning-artifacts/epic-9-planning-review.md#§2] 9.3 split; [#§6] 9-3b scope (checkout + portal + cancel/reactivate + billing UI); [#§8.2] 9-3b test plan; [#§11] Sprint 2 placement
- [Source: _bmad-output/planning-artifacts/stripe-subscription-spike.md#§2.3] checkout pattern; [#§4.2] Server Action design; [#§4.3] Customer Portal config; [#§5.5] metadata scheme; [#§6.1] cancel-at-period-end; [#§9.1] syncStripeData fallback + out-of-order delivery
- [Source: _bmad-output/implementation-artifacts/9-3a-stripe-webhook-infrastructure.md] previous slice — webhook handlers (checkout-completed subscription activation, subscription.updated/deleted sync), `upsert_workspace_subscription` + `set_workspace_subscription_status` RPCs, `getTierConfig()` cached reader. 9-3b REUSES all of this; only triggers the Stripe objects.
- [Source: _bmad-output/implementation-artifacts/9-2-client-portal-invoice-payment-report-approval.md] portal one-time checkout pattern (reference for provider call shape; ⚠️ metadata case inconsistency noted)
- [Source: docs/project-context.md#L150] service_role only in webhooks/agents; [#L136] never trust client workspace_id; [#L174-177] provider abstraction; [#L315] 'use server' placement; [#L329-333] ActionResult/Result type; [#L450] money = cents; [#L494] exactly-once = "already in target state" = success
- [Source: packages/agents/providers/payment-provider.ts#L38-165] `Subscription` type spelling + `CheckoutSession` type + `PaymentProvider` interface (extend here and align `'canceled'` → `'cancelled'`)
- [Source: packages/agents/providers/stripe/stripe-payment-provider.ts#L153] existing ONE-TIME `createCheckoutSession` (do NOT reuse for subscriptions); [#L38-72] `stripeRequest<T>` + `flattenForForm` pattern to mirror; [#L246-253] `cancelSubscription`/`resumeSubscription` already implemented; update `mapSubscription` spelling
- [Source: apps/web/lib/stripe/handlers/checkout-completed.ts#L52] reads `metadata.workspace_id` (snake_case) — drives the metadata convention
- [Source: apps/web/lib/config/tier-config.ts] `getTierConfig()` — price + limit reader (throws on placeholders)
- [Source: apps/web/lib/actions/invoices/record-payment.ts] canonical Server Action pattern (Zod → requireTenantContext → RPC → cache invalidate → ActionResult)
- [Source: packages/db/src/rls-helpers.ts] `requireTenantContext` (throws FlowErrorBase), `createFlowError`
- [Source: packages/types/src/errors.ts] FlowErrorCode union (add NOT_CONFIGURED + NO_ACTIVE_SUBSCRIPTION here)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Deferred Items (at close)

_Count recorded at each code review pass. If >5, require Architect + PM approval (see scope-check-gate.md step 7)._

### Test Commit Record

_Epic 5 retro A2: Record the SHA of the first failing test commit (red phase) before any implementation commit. This makes AC0 test-first auditable._

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| apps/web/__tests__/acceptance/epic-9/9-3b-checkout-portal-integration.spec.ts | (existing RED scaffold, 2026-06-15) | 2026-06-15 |
| apps/web/__tests__/billing/9-3b-checkout-portal.spec.ts | 73166ab15c5ba2350cc6fc696912cf8b9ddf2971 | 2026-06-17 |

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | Story 9-3b created: Checkout & Customer Portal integration — subscription checkout Server Action, Stripe Customer Portal session, cancel/reactivate actions, syncStripeData success-redirect fallback, billing settings page UI, provider + types extension. Parent 9-3 split → 9-3a (DONE) + 9-3b per epic-9-planning-review.md §6. Depends on 9-3a webhook handlers + RPCs (REUSE, do not reinvent). **FR55**, FR58. | Claude (glm-5.2) |
| 2026-06-17 | Party-mode adversarial review + implementation-readiness validation: fixed FR mapping (FR39→FR55), rewrote AC4 to use `sessionId` when local subscription ID is absent, split checkout schema (`upgradableTierSchema`/`checkoutIntervalSchema`), aligned `Subscription.status` spelling to `'cancelled'`, removed service_role exception, added `getAppUrl()` reuse, added confirmation/rate-limit/cancel-banner requirements, and clarified ATDD/unit-scaffold gaps. | OpenCode |
