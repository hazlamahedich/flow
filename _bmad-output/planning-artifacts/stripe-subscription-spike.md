# Stripe Subscription Integration — Spike Document

**Date:** 2026-06-10  
**Author:** Team Mantis  
**Status:** Research Complete  
**Epic:** Epic 9 — Client Portal, Subscriptions & Billing  

---

## 1. Executive Summary

Flow OS requires Stripe integration for two distinct purposes: (1) subscription billing for workspace tiers (Free/Pro/$59 Agency), and (2) one-time invoice payments via the client portal. This spike covers the subscription side. Invoice payment processing is covered separately in the invoicing domain (FR35-45).

**Key decision:** Use Stripe as the source of truth for billing state, sync to Supabase for fast application-level reads. Avoid split-brain by always writing to Stripe first, then syncing via webhooks.

---

## 2. Architecture Decision: Stripe ↔ Supabase Integration

### 2.1 Integration Pattern

```
┌─────────────────────────────────────────────────────┐
│ Flow OS (Next.js 15 App Router)                     │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Checkout     │  │ Customer     │  ← User-facing  │
│  │ Session      │  │ Portal       │                 │
│  └──────┬───────┘  └──────┬───────┘                 │
│         │                 │                         │
│  ┌──────┴─────────────────┴──────────────────┐      │
│  │ Server Actions / Route Handlers           │      │
│  │ (lib/actions/billing/, /api/webhooks/)     │      │
│  └──────┬──────────────────────────┬─────────┘      │
│         │                          │                │
│    Stripe API (outbound)     Webhook (inbound)       │
│         │                          │                │
└─────────┼──────────────────────────┼────────────────┘
          │                          │
          ▼                          ▼
   ┌──────────────┐          ┌──────────────┐
   │   Stripe     │          │   Supabase   │
   │ (billing     │  sync    │ (app state,  │
   │  source of   │ ───────► │  fast reads) │
   │  truth)      │          │              │
   └──────────────┘          └──────────────┘
```

**Stripe owns:** Products, Prices, Customers, Subscriptions, Invoices, Payment Methods, Disputes  
**Supabase owns:** Workspace tier, feature flags, usage counters, agent pause/resume triggers

### 2.2 Why This Pattern

| Consideration | Decision | Rationale |
|---|---|---|
| Source of truth for billing | Stripe | Financial data should live in the payment processor. Avoids reconciliation bugs. |
| Source of truth for app state | Supabase | Application reads subscription status from DB for fast RLS-gated queries. No per-request Stripe API calls. |
| Sync mechanism | Webhook → Supabase | Stripe pushes state changes. Idempotent handler writes to DB. |
| Read pattern | Supabase first, Stripe fallback | App reads from `workspaces.subscription_status`. Stripe API only for billing pages and portal. |
| Customer creation | On first checkout | Lazy creation — don't create Stripe customers for Free tier users who never pay. |

### 2.3 Data Flow — Key Scenarios

**Upgrade (Free → Pro):**
1. User clicks "Upgrade to Pro" → Server Action `createCheckoutSession(priceId, workspaceId)`
2. Stripe Checkout Session created with `customer` (create if needed) + `metadata: { workspaceId }`
3. User completes Checkout → Stripe fires `checkout.session.completed` webhook
4. Webhook handler reads `workspaceId` from metadata → updates `workspaces` row (tier, subscription_id, stripe_customer_id)
5. Application invalidates cache → features unlock instantly

**Customer Portal (manage billing):**
1. User clicks "Manage Billing" → Server Action `createPortalSession(stripeCustomerId, returnUrl)`
2. Redirect to Stripe-hosted portal → user updates card, views invoices, cancels
3. Stripe fires subscription events → webhook syncs to Supabase

**Payment Failure:**
1. Stripe fires `invoice.payment_failed` → webhook updates `workspaces.subscription_status = 'past_due'`
2. Application gates: agents paused, banner shown, 7-day countdown
3. If recovered → `invoice.paid` → status back to `active`
4. If expired → `customer.subscription.deleted` → status to `suspended`, then `deleted` after 30 days

---

## 3. Database Schema Additions

### 3.1 Workspace Table Extensions

The existing `workspaces` table (migration `00000001_workspaces.sql`) needs these columns:

```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  subscription_status text NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN (
      'free', 'active', 'past_due', 'suspended',
      'cancelled', 'deleted', 'trialing'
    )),
  subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro', 'agency')),
  subscription_current_period_end timestamptz,
  subscription_current_period_start timestamptz,
  subscription_cancel_at_period_end boolean DEFAULT false,
  subscription_updated_at timestamptz DEFAULT now();
```

**Design notes:**
- `subscription_tier` is the application-level concept (free/pro/agency). Maps to Stripe Price IDs.
- `subscription_status` tracks the lifecycle state from the PRD: Active → Past Due → Suspended → Deleted.
- `stripe_customer_id` and `stripe_subscription_id` are nullable — Free tier users have neither.
- Index `stripe_customer_id` for webhook lookups (webhook has Stripe customer ID, needs workspace).

### 3.2 Stripe Event Dedup Table (from PRD FR42)

```sql
CREATE TABLE stripe_processed_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_stripe_processed_events_created
  ON stripe_processed_events (created_at);

-- TTL: delete events older than 72 hours via cron
-- Prevents dedup table from growing unbounded
```

### 3.3 Tier Configuration (app_config)

Already planned in architecture as `app_config` table. Stripe-specific rows:

```sql
INSERT INTO app_config (key, value) VALUES
('stripe_prices', '{
  "pro_monthly": "price_xxx_pro_monthly",
  "agency_monthly": "price_xxx_agency_monthly"
}'::jsonb),
('stripe_free_transaction_fee_percent', '5'::jsonb),
('subscription_grace_period_days', '7'::jsonb),
('subscription_suspension_period_days', '30'::jsonb);
```

Price IDs are environment-specific (test vs live). Config is cached with `cache() + revalidateTag('config:tiers')`.

### 3.4 Index for Webhook Lookups

```sql
CREATE INDEX idx_workspaces_stripe_customer
  ON workspaces (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
```

Webhook handlers look up workspace by `stripe_customer_id`. This must be fast — every Stripe event hits this query.

---

## 4. API Routes Needed

### 4.1 Route Handler: Webhook (`/api/webhooks/stripe`)

**Already planned** in architecture at `apps/web/app/api/webhooks/stripe/route.ts`.

**Handled events:**

| Event | Action |
|---|---|
| `checkout.session.completed` | Activate subscription, set tier, store subscription IDs |
| `customer.subscription.updated` | Sync status, tier, period dates, cancel_at_period_end |
| `customer.subscription.deleted` | Mark cancelled → trigger suspension flow |
| `invoice.paid` | Confirm active status, reset failure counters |
| `invoice.payment_failed` | Set `past_due`, pause agents, start grace countdown |
| `customer.updated` | Sync email/name changes (optional, low priority) |

**Critical requirements:**
- Signature verification via `stripe.webhooks.constructEvent(body, signature, webhookSecret)`
- Idempotency: check `stripe_processed_events` before processing. INSERT first, process second (or use ON CONFLICT DO NOTHING).
- Raw body parsing: Next.js App Router Route Handlers must read body as text, not JSON.
- Return `200 { received: true }` immediately, process asynchronously (or within timeout).
- `service_role` key for DB writes — webhook is a system-level operation.

### 4.2 Server Actions (in `lib/actions/billing/`)

| Action | Purpose |
|---|---|
| `createCheckoutSession` | Creates Stripe Checkout for upgrade. Takes `priceId`, returns session URL. Creates Stripe Customer if needed. |
| `createPortalSession` | Creates Stripe Customer Portal session for self-serve billing management. Takes `returnUrl`, returns portal URL. |
| `getSubscriptionStatus` | Reads workspace subscription state from Supabase (fast, no Stripe API call). |
| `cancelSubscription` | Initiates cancellation via Stripe API (at period end by default). Updates local state. |
| `reactivateSubscription` | Re-activates a cancelled-but-not-expired subscription. |

**Pattern:** Each action follows the standard `ActionResult<T>` contract with Zod validation.

### 4.3 Stripe Customer Portal Configuration

Configure via Stripe Dashboard or API (`stripe.billingPortal.configurations.create`):

```typescript
const portalConfig = {
  business_profile: {
    headline: 'Flow OS Billing',
    privacy_policy_url: 'https://flow.app/privacy',
    terms_of_service_url: 'https://flow.app/terms',
  },
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      cancellation_reason: { enabled: true, options: [
        'too_expensive', 'missing_features', 'switched_service',
        'unused', 'customer_service', 'too_complex', 'other'
      ]},
    },
    subscription_pause: { enabled: false },
  },
};
```

Portal is Stripe-hosted — no UI code needed on our side. Just redirect.

---

## 5. Key Security Considerations

### 5.1 Webhook Signature Verification

**Non-negotiable.** Every webhook must verify the Stripe-Signature header:

```typescript
const event = stripe.webhooks.constructEvent(
  body,           // raw string, NOT parsed JSON
  signature,      // from Stripe-Signature header
  webhookSecret   // from env, different for each webhook endpoint
);
```

- Raw body required — do not parse as JSON first.
- Webhook secret stored as environment variable, never in code.
- Separate secrets for test/live mode.

### 5.2 Idempotency

Per PRD FR42: "exactly once per event, even if the payment provider sends duplicate notifications."

Pattern:
```sql
INSERT INTO stripe_processed_events (event_id, event_type, workspace_id)
VALUES (:eventId, :eventType, :workspaceId)
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id;
```

If INSERT returns nothing → event already processed → return 200 immediately.

### 5.3 PCI Compliance

Flow OS never touches raw card data. Stripe Checkout and Stripe Customer Portal handle all payment collection. This qualifies for **SAQ A** (simplest PCI-DSS self-assessment).

- No card numbers, CVVs, or expiry dates flow through our servers.
- Stripe Elements / Checkout Session for all payment forms.
- `stripe_customer_id` stored in DB (this is allowed — it's a token, not card data).

### 5.4 API Key Management

| Key | Storage | Usage | Rotation |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Vercel env var | Server-side API calls | 90-day per project-context.md |
| `STRIPE_WEBHOOK_SECRET` | Vercel env var | Webhook verification | On webhook endpoint change |
| `STRIPE_PUBLISHABLE_KEY` | Client-side only | Checkout redirect | Low sensitivity, public |
| `STRIPE_RESTRICTED_KEY` | Vercel env var (optional) | Webhook handler only, write-limited | 90-day |

**Recommendation:** Use a restricted API key for the webhook handler with only the permissions it needs (`customers:read`, `subscriptions:read`, `invoices:read`). Separate from the main secret key used for creating checkout sessions.

### 5.5 Metadata Integrity

All Stripe objects must include `metadata: { workspaceId }` for:
- Customer creation
- Checkout session creation
- Subscription creation

This is the only reliable way to map Stripe events back to workspaces in webhook handlers. Do not rely on email matching.

---

## 6. Integration with Existing Architecture

### 6.1 Subscription State Machine ↔ Workspace Lifecycle

The PRD defines this lifecycle (FR59):

```
Free ──checkout──► Active ──payment_failed──► Past Due (7d grace)
                      ◄──payment_recovered──│
                      │                     ▼
                      │               Suspended (30d)
                      ◄──reactivated──│
                                        ▼
                                    Cancelled (30d)
                                        ▼
                                      Deleted
```

**Mapping to Stripe:**
- Free: No Stripe subscription. `subscription_status = 'free'`, `stripe_subscription_id IS NULL`.
- Active: Stripe subscription `status = 'active'`.
- Past Due: Stripe subscription `status = 'past_due'` OR `invoice.payment_failed`. Application enforces 7-day grace.
- Suspended: Application-level state after grace period expires. Stripe subscription may still exist.
- Cancelled: Stripe subscription `cancel_at_period_end = true` or `status = 'canceled'`.
- Deleted: Application hard-deletes workspace after 30-day suspended window.

### 6.2 Tier Limits Enforcement

Tier limits (client count, team member count, agent count) are enforced at the application level, not by Stripe. Stripe only gates payment.

Pattern from architecture: `app_config` table stores limits per tier. Server Actions check limits before creating resources.

```typescript
const limits = await getTierLimits(workspace.subscription_tier);
const currentClientCount = await getClientCount(workspace.id);
if (currentClientCount >= limits.maxClients) {
  return { success: false, error: { type: 'validation', code: 'TIER_LIMIT_EXCEEDED', ... } };
}
```

### 6.3 Agent Pause on Payment Failure

Per FR60: When subscription enters Past Due or Suspended, scheduled agent jobs are paused.

Implementation: The agent orchestrator checks `workspaces.subscription_status` before dequeuing jobs. If not `active` or `free`, skip the job. No architectural change needed — just a guard clause in `PgBossOrchestrator.dequeue()`.

### 6.4 Free Tier 5% Transaction Fee

Per FR61: Free tier users are charged 5% on Stripe payments.

This is an application-level calculation, not a Stripe subscription feature. When a Free tier workspace creates an invoice:
1. Invoice amount = `base_amount * 1.05` (5% surcharge)
2. Display "5% processing fee" to the VA
3. Stripe processes the full amount; Flow OS retains the 5% portion

This requires Stripe Connect or Stripe's Application Fee feature. **Deferred complexity** — for MVP, the 5% fee can be a simple line item added to the invoice. Full Stripe Connect integration is Agency+ tier (Phase 2).

### 6.5 Cache Invalidation

Per architecture cache policy:
```typescript
await invalidateAfterMutation('workspace', 'update', workspaceId);
// Tags: config:tiers, branding:{workspaceId}
```

This ensures the UI reflects the new tier immediately without per-request Stripe API calls.

---

## 7. Stripe Products & Pricing Setup

### 7.1 Products in Stripe

| Product | Stripe Product ID | Description |
|---|---|---|
| Flow OS Pro | `prod_xxx_pro` | Solo VA workspace — 15 clients, 6 agents, portal |
| Flow OS Agency | `prod_xxx_agency` | Unlimited team, full features, Stripe Connect |

Free tier has no Stripe Product — it's the absence of a subscription.

### 7.2 Prices

| Price | Stripe Price ID | Amount | Interval | Maps To |
|---|---|---|---|---|
| Pro Monthly | `price_xxx_pro_monthly` | $29.00 | month | `subscription_tier = 'pro'` |
| Agency Monthly | `price_xxx_agency_monthly` | $59.00 | month | `subscription_tier = 'agency'` |

No annual pricing for MVP. No trials (Free tier IS the trial). No metered billing.

### 7.3 Environment Strategy

- **Development:** Stripe test mode with test products/prices. Seed script creates test products.
- **Staging:** Stripe test mode with separate products (prefixed `staging_`).
- **Production:** Stripe live mode. Products created once, IDs stored in `app_config`.

Price IDs differ between test and live mode. Config-driven lookup prevents hardcoding.

---

## 8. Estimated Story Breakdown

### Story 9-1: Stripe Infrastructure & Checkout (Foundation)
**Estimated effort:** 3-4 days

- Create Stripe Products and Prices in test mode
- Add workspace subscription columns to Supabase migration
- Create `stripe_processed_events` dedup table
- Add tier config to `app_config`
- Implement `createCheckoutSession` Server Action
- Implement Stripe webhook Route Handler (signature verification + idempotency)
- Handle `checkout.session.completed` event → activate subscription
- Handle `customer.subscription.updated` event → sync status
- Handle `invoice.payment_failed` → set `past_due`
- RLS policies for billing queries (owner-only)
- Unit tests for webhook handler (mocked Stripe events)
- Integration test: full checkout → webhook → DB update flow

**Delivers:** Users can upgrade from Free to Pro via Stripe Checkout. Subscription state is tracked in Supabase.

### Story 9-2: Customer Portal & Self-Serve Billing
**Estimated effort:** 2-3 days

- Configure Stripe Customer Portal (payment method update, invoice history, cancellation)
- Implement `createPortalSession` Server Action
- Implement `cancelSubscription` Server Action
- Implement `reactivateSubscription` Server Action
- Handle `customer.subscription.deleted` → cancel flow
- Billing settings page UI (`(workspace)/settings/billing/`)
- Show current tier, usage vs limits, payment method (last 4), next billing date
- Cancellation flow with usage data (per Journey 7: "280 hours, 23 invoices, $14,200")
- Downgrade logic: Pro→Free with client archival (FR57)
- E2E test: upgrade → manage billing → cancel → reactivate

**Delivers:** Full self-serve billing management. Users can update cards, view invoices, cancel/reactivate.

### Story 9-3: Subscription Lifecycle & Agent Integration
**Estimated effort:** 2-3 days

- Implement workspace lifecycle state machine (Active → Past Due → Suspended → Deleted)
- Grace period enforcement (7-day cron job or Trigger.dev scheduled job)
- Suspension enforcement (30-day cron job)
- Agent orchestrator guard clause: skip jobs for non-active workspaces (FR60)
- Tier limit enforcement in Server Actions (client count, team size, agent count)
- Auto-upgrade prompt when approaching limits (FR56)
- Proration handling for mid-cycle upgrades (Pro → Agency)
- Downgrade data preservation (excess clients → read-only)
- Notification flow: payment failed → banner + email → escalation
- Stripe reconciliation job (nightly: compare Stripe state to DB state, flag drift)
- Integration test: payment failure → agents pause → payment recovery → agents resume
- RLS test: billing queries restricted to workspace owner

**Delivers:** Complete subscription lifecycle. Agent behavior responds to billing state. Tier limits enforced.

---

## 9. Risks and Open Questions

### 9.1 Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Webhook delivery ordering** — Stripe doesn't guarantee event order. `subscription.updated` may arrive before `checkout.session.completed`. | Medium | Use `stripe_processed_events` for idempotency. Each handler reads current DB state and applies only if the event represents a newer state. Compare Stripe timestamps, not arrival order. |
| **Split-brain between Stripe and Supabase** — webhook fails, DB doesn't update, Stripe says active but app says free. | High | Nightly reconciliation job compares Stripe state to DB. Also: success redirect page calls `syncStripeData()` as a synchronous fallback. Never rely solely on webhooks. |
| **Free tier 5% fee implementation complexity** — requires Stripe Connect or Application Fee API for proper fund splitting. | Medium | MVP simplification: add 5% as a line item on the invoice. Client pays full amount to VA's Stripe. VA's Stripe account receives 100%. Flow OS doesn't take a cut in MVP. True fee collection deferred to Agency+ with Stripe Connect. |
| **Proration edge cases** — mid-cycle upgrade + immediate downgrade in same billing period. | Medium | Use Stripe's default proration behavior. Don't override. Let Stripe calculate. Sync the resulting invoice to DB. |
| **Stripe API key exposure** — `STRIPE_PUBLISHABLE_KEY` is client-visible. Secret key could leak in SSR bundle. | High | Secret key NEVER leaves server. Use `next.config.ts serverExternalPackages` if needed. Audit bundle with `npx @next/bundle-analyzer`. |
| **Webhook endpoint URL availability** — Stripe retries for up to 3 days. If endpoint is down, events queue. | Low | Vercel provides 99.9% uptime for serverless functions. Stripe's retry mechanism handles transient failures. Monitor via Stripe Dashboard webhook logs. |

### 9.2 Open Questions

| # | Question | Impact | Recommendation |
|---|---|---|---|
| 1 | **Should Free tier users have a Stripe Customer object?** | Affects when we create Stripe customers. If lazy (first checkout), Free tier has no Stripe footprint. If eager (on signup), we have a customer ID ready but pay for unused records. | **Lazy creation.** Create Stripe Customer only when user initiates first checkout. Free tier users who never upgrade never touch Stripe. Reduces Stripe account clutter. |
| 2 | **Should we use Stripe Checkout or Embedded Payment Form?** | UX and implementation complexity. Checkout is Stripe-hosted (redirect). Embedded is in-app (more control). | **Stripe Checkout for MVP.** Less code, PCI-simple (SAQ A), mobile-responsive out of the box. Embedded form is a Phase 2 polish item. |
| 3 | **How to handle the Free → Pro transition for workspaces with existing data?** | PRD says "instant unlock, all data preserved." Client count may exceed Pro limit (15) if VA imported data on Free. | Allow upgrade regardless of current usage. Enforce limits only on *new* resource creation, not existing data. If they have 20 clients on Free and upgrade to Pro, all 20 stay active. Limit kicks in at next client creation. |
| 4 | **Stripe Connect for Agency tier — in scope for Epic 9?** | Connect adds KYC/AML, 1099-K reporting, funds segregation. Significant complexity. | **Out of scope for Epic 9.** Agency tier gets "Connect-ready" architecture (provider abstraction in invoicing), but actual Stripe Connect activation is Phase 2 with Agency+. |
| 5 | **Should the webhook handler use `waitUntil` for async processing?** | Next.js Route Handlers have execution time limits. Vercel serverless functions timeout at 10s (hobby) or 60s (pro). | **Yes.** Use `waitUntil()` pattern (or just process synchronously — our webhook handlers are fast: dedup check + single DB UPDATE). For complex handlers (agent pause), enqueue a pg-boss job and return immediately. |
| 6 | **Should we use Stripe's built-in dunning or implement custom?** | Stripe Smart Retries vs custom grace period logic. | **Custom for MVP.** PRD specifies exact grace period (7 days) and escalation (suspended → deleted). Stripe's built-in dunning is configurable but adds opaque behavior. We control the timeline explicitly in webhook handlers. |

### 9.3 Deferred Items (Not Epic 9)

| Item | Reason | Trigger |
|---|---|---|
| Stripe Connect (Agency tier) | KYC/AML complexity, legal review needed | Agency+ tier activation |
| Annual pricing | Reduces billing complexity but adds refund edge cases | User demand (6+ requests) |
| Usage-based billing (per-agent-run) | Requires Stripe Metering Events API | LLM cost optimization at scale |
| Stripe Tax | Tax compliance complexity | First non-US customer or 50+ workspaces |
| Stripe Invoicing (VA invoices via Stripe) | Separate from subscription billing — already in invoicing domain | Epic 8/9 overlap |
| Webhook signature key rotation automation | Nice-to-have | SOC 2 prep |
| Multi-currency | Adds pricing complexity | International expansion signal |

---

## 10. Testing Strategy

### 10.1 Unit Tests

- Webhook handler: mocked Stripe events, verify correct DB updates per event type
- Checkout session creation: verify correct price ID mapping, customer creation
- Portal session creation: verify correct customer ID usage
- Dedup logic: send same event twice, verify only one DB write
- State machine: verify all transitions (active → past_due → suspended → deleted)

### 10.2 Integration Tests

- Full checkout flow: create session → simulate webhook → verify DB state
- Payment failure flow: simulate `invoice.payment_failed` → verify agents paused
- Upgrade + downgrade: verify proration, data preservation
- Reconciliation: inject drift between Stripe and DB, verify reconciliation job fixes it

### 10.3 E2E Tests

- Full upgrade path: login → navigate to billing → upgrade → verify features unlock
- Cancel and reactivate: cancel → verify access maintained to period end → reactivate
- Portal flow: open portal → update payment method → verify webhook updates

### 10.4 Stripe Test Mode

All development and CI uses Stripe test mode. Test cards:
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 0002` — declines
- `4000 0000 0000 3220` — 3D Secure

CI pipeline runs against Stripe test mode with `STRIPE_WEBHOOK_SECRET` for the test endpoint.

---

## 11. Implementation Sequence (Recommended Order)

```
Phase A: Foundation (Story 9-1)
  1. Add DB columns + dedup table (migration)
  2. Create Stripe Products/Prices in test mode
  3. Add config rows to app_config
  4. Implement webhook handler (just signature verification + dedup first)
  5. Add checkout.session.completed handler
  6. Implement createCheckoutSession action
  7. Wire up billing page UI (basic: current tier + upgrade button)
  8. Test: full upgrade flow end-to-end

Phase B: Self-Serve (Story 9-2)
  1. Configure Stripe Customer Portal
  2. Implement createPortalSession action
  3. Add cancel/reactivate actions
  4. Build billing settings page (full: tier, usage, portal link, cancel)
  5. Add subscription.updated and subscription.deleted handlers
  6. Test: cancel → reactivate flow

Phase C: Lifecycle (Story 9-3)
  1. Implement state machine (past_due → suspended → deleted)
  2. Add grace period cron job (Trigger.dev or pg-boss scheduled)
  3. Add agent orchestrator guard clause
  4. Add tier limit enforcement in resource-creating Server Actions
  5. Add limit-proximity notifications
  6. Build reconciliation job
  7. Test: payment failure → agent pause → recovery flow
```

---

## 12. Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Supabase workspace schema | ✅ Exists | Epic 1 complete |
| `packages/db/` client setup | ✅ Exists | Can add billing queries |
| `packages/types/subscription.ts` | ✅ Exists | Zod schemas for subscription types |
| `app_config` table | ✅ Planned | Migration `00000010_app-config.sql` |
| Stripe account (test mode) | ⬜ Needed | Create before Story 9-1 |
| Stripe CLI (local testing) | ⬜ Needed | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| Vercel env vars | ⬜ Needed | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |

---

## 13. Reference Documents

- PRD: `_bmad-output/planning-artifacts/prd.md` — FR55-62 (Subscription & Tier Management)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Subscription state machine, webhook pattern, cache policy
- Project context: `docs/project-context.md` — 180 technical rules
- Stripe Subscriptions docs: https://stripe.com/docs/billing/subscriptions/overview
- Stripe Customer Portal: https://stripe.com/docs/customer-management/portal
- Stripe Webhook best practices: https://stripe.com/docs/webhooks/best-practices
- t3.gg Stripe recommendations: https://github.com/t3dotgg/stripe-recommendations
