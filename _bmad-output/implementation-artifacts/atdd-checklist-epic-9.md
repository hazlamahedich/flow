---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-06-15'
workflowType: testarch-atdd
epicId: '9'
epicTitle: 'Client Portal, Subscriptions & Billing'
storyIds:
  - '9.1a'
  - '9.1b'
  - '9.2'
  - '9.3a'
  - '9.3b'
  - '9.4'
  - '9.5a'
  - '9.5b'
  - '9.6'
  - '9.7'
testDir: apps/web/__tests__/acceptance/epic-9/
generatedTestFiles:
  - apps/web/__tests__/acceptance/epic-9/9-1a-portal-auth-layout.spec.ts
  - apps/web/__tests__/acceptance/epic-9/9-1b-portal-branding-theming.spec.ts
  - apps/web/__tests__/acceptance/epic-9/9-2-portal-invoice-payment-report-approval.spec.ts
  - apps/web/__tests__/acceptance/epic-9/9-3a-stripe-webhook-infrastructure.spec.ts
  - apps/web/__tests__/acceptance/epic-9/9-3b-checkout-portal-integration.spec.ts
  - apps/web/__tests__/acceptance/epic-9/9-4-subscription-tiers-tier-limits.spec.ts
  - apps/web/__tests__/acceptance/epic-9/9-5a-subscription-lifecycle-state-machine.spec.ts
  - apps/web/__tests__/acceptance/epic-9/9-5b-agent-pause-downgrade-handling.spec.ts
  - apps/web/__tests__/acceptance/epic-9/9-6-recurring-invoices.spec.ts
  - apps/web/__tests__/acceptance/epic-9/9-7-billing-accuracy-usage-visibility.spec.ts
totalTests: 163
totalFiles: 10
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 9, lines 1504-1619)
  - _bmad-output/implementation-artifacts/epic-9-planning-review.md
  - _bmad-output/planning-artifacts/stripe-subscription-spike.md
  - docs/project-context.md
  - packages/db/src/schema/stripe-webhooks.ts
  - packages/db/src/schema/app-config.ts
  - packages/db/src/schema/workspaces.ts
---

# ATDD Checklist — Epic 9: Client Portal, Subscriptions & Billing

**Date:** 2026-06-15
**Primary Test Level:** Acceptance (Vitest, contract-first red-phase scaffolds)
**Stack:** Fullstack (Next.js 15 + Supabase + Stripe)
**Slicing:** 10 slices per `epic-9-planning-review.md` (9-1a/b, 9-3a/b, 9-5a/b splits)

---

## Story Summary

Epic 9 delivers the client-facing portal and full subscription billing system: client portal with light theme, Stripe payment integration with idempotent webhooks, subscription tiers with limit enforcement, lifecycle state machine (Active → Past Due → Suspended → Deleted), agent pause on suspension, recurring invoices, and billing accuracy monitoring.

**FRs covered:** FR8, FR15, FR37, FR39, FR42, FR44, FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR82
**NFRs covered:** NFR05, NFR46, NFR54, NFR55, NFR56
**UX-DRs covered:** UX-DR12, UX-DR26, UX-DR35, UX-DR36, UX-DR37, UX-DR38, UX-DR39, UX-DR40

---

## Red-Phase Test Scaffolds Created

All tests use the `vi.hoisted()` + `vi.mock()` red-phase pattern: non-existent modules are stubbed so tests verify contracts (schemas, constants, mock behavior). During GREEN phase, the developer replaces `vi.mock` stubs and inline constants with real imports — tests then become acceptance criteria that fail until the implementation is correct.

### Summary Table

| File | Slice | Tests | Priority | Key FRs |
|------|-------|-------|----------|---------|
| `9-1a-portal-auth-layout.spec.ts` | Portal Auth & Layout | 17 | P0/P1 | FR8, FR51, FR54, UX-DR38 |
| `9-1b-portal-branding-theming.spec.ts` | Portal Branding & Theming | 19 | P0/P1 | FR51, UX-DR12, UX-DR26, UX-DR35 |
| `9-2-portal-invoice-payment-report-approval.spec.ts` | Portal Invoice/Report | 16 | P0/P1 | FR52, FR53, FR82, UX-DR36-40 |
| `9-3a-stripe-webhook-infrastructure.spec.ts` | Stripe Webhook Infra | 22 | P0 | FR39, FR42, FR44, NFR05, NFR46 |
| `9-3b-checkout-portal-integration.spec.ts` | Checkout & Portal Integration | 13 | P0 | FR39, FR58 |
| `9-4-subscription-tiers-tier-limits.spec.ts` | Tiers & Tier Limits | 15 | P0 | FR55, FR56, FR61, FR62 |
| `9-5a-subscription-lifecycle-state-machine.spec.ts` | Lifecycle State Machine | 19 | P0 | FR59, FR60 |
| `9-5b-agent-pause-downgrade-handling.spec.ts` | Agent Pause & Downgrade | 14 | P0/P1 | FR57, FR60 |
| `9-6-recurring-invoices.spec.ts` | Recurring Invoices | 15 | P0 | FR37, FR60 |
| `9-7-billing-accuracy-usage-visibility.spec.ts` | Billing Accuracy & Usage | 13 | P0 | NFR54, NFR55, NFR56 |
| **Total** | **10 slices** | **163** | | |

---

## Per-Slice Test Details

### 9-1a: Portal Auth & Layout (17 tests)

- `generatePortalLinkAction` defined, returns URL with token (FR51)
- Portal token crypto-random ≥32 bytes, TTL enforced (FR8)
- Role guard: non-owner/admin rejected (FORBIDDEN)
- `validatePortalTokenAction`: valid/expired/revoked/unknown token handling (FR8)
- `portalTokenSchema` rejects malformed input
- anon-role RLS isolation, cross-client leakage blocked (FR54)
- Rate limiting, constant-time token lookup (FR8)
- "Powered by Flow OS" footer with referral tracking (UX-DR38)

### 9-1b: Portal Branding & Theming (19 tests)

- Light theme: surface `#FAFAF8`, accent `#D4A574`, warm gray border (UX-DR26)
- Trophy-case premium feel (UX-DR35)
- 3 presets: Minimalist, Warm Host, Bold Professional (UX-DR12)
- Each preset: 8 visual vars + 4 content vars
- `brandingConfigSchema` rejects >8 visual / >4 content (boundary tests)
- `resolveBrandingPreset` merges overrides
- `PortalBrandingProvider` component exported

### 9-2: Portal Invoice Payment & Report Approval (16 tests)

- `payInvoicePortalAction`: returns Stripe Checkout URL (FR52)
- Rejects paid invoice (FINANCIAL_INVALID_STATE), cross-client (FORBIDDEN)
- `approveReportAction` / `requestReportChangesAction` (FR53)
- Idempotency: already-approved rejected (INVALID_STATE)
- Email notifications: invoice_created, payment_confirmed, report_shared (FR82)
- `ZeroThoughtTasksHero`, value-receipt invoice, TV-cliffhanger preview, message channel (UX-DR36-40)

### 9-3a: Stripe Webhook Infrastructure (22 tests)

- POST handler exported, returns 200/400/401 (FR39)
- `verifyWebhookSignature`: valid/tampered (security surface)
- `stripeWebhookEvents` table unique `stripe_event_id` (FR42)
- `processStripeEvent`: first delivery processed, second deduped
- Webhook <5s processing (NFR05)
- Retry: max 3, backoff [1s, 5s, 30s] (NFR46)
- `workspaces` table lacks subscription columns (RED — migration pending)
- `appConfig` table shape verified
- Duplicate invoice dedup (FR44)

### 9-3b: Checkout & Portal Integration (13 tests)

- `createCheckoutSessionAction`: returns Stripe Checkout URL (FR39)
- `checkoutSessionSchema` validates tier/interval
- Metadata workspaceId on Stripe objects
- Non-owner rejected (FORBIDDEN)
- `createPortalSessionAction`: portal URL / NOT_CONFIGURED (FR58)
- `cancelSubscriptionAction` / `reactivateSubscriptionAction`
- Free tier cancel rejected (NO_ACTIVE_SUBSCRIPTION)
- `BillingSettingsPage` Server Component exported

### 9-4: Subscription Tiers & Tier Limits (15 tests)

- `subscriptionTierSchema`: free/pro/agency (FR55)
- `getTierLimits` from app_config: Pro > Free clients, Agency > Pro members
- `checkTierLimit`: blocks over-limit, allows under-limit, warns at 80% (FR56)
- `changeTierAction`: prorated checkout URL (FR62)
- Free tier 5% fee notice (FR61)

### 9-5a: Lifecycle State Machine (19 tests)

- `subscriptionStatusSchema`: free/active/past_due/suspended/deleted (FR59)
- Valid transitions: active→past_due→suspended→deleted
- Reactivation paths: suspended→active, past_due→active
- Invalid direct jump: active→deleted blocked
- Grace period: 7 days; Suspension window: 30 days (FR59)
- `reconcileSubscriptionsAction`: flags drift, corrects via Stripe truth

### 9-5b: Agent Pause & Downgrade Handling (14 tests)

- `shouldDequeueForWorkspace`: active/free=true, past_due/suspended/deleted=false (FR60)
- `enforceTierLimit`: blocks over-limit for clients/team/agents
- `applyDowngradeAction`: preserves excess data read-only (FR57)
- Auto-upgrade prompt on downgrade
- Never deletes client/time/invoice data

### 9-6: Recurring Invoices (15 tests)

- `recurringIntervalSchema`: weekly/monthly/quarterly (FR37)
- `recurringInvoiceSchema`: requires nextRunAt, validates line items
- `createRecurringInvoiceAction` / `getRecurringInvoicesAction`
- `generateScheduledInvoicesAction`: draft status, nextRunAt advances, idempotent
- Pauses on past_due/suspended (FR60)

### 9-7: Billing Accuracy & Usage Visibility (13 tests)

- `METERING_ACCURACY_TARGET` = 0.999 (NFR54)
- `RECONCILIATION_WINDOW_HOURS` = 1
- `getUsageMetricsAction`: clients/team/agents used vs limit (NFR55)
- `UsageDashboard` component exported
- `getBillingHistoryAction`: paginated history (FR58)
- `DISPUTE_WINDOW_DAYS` = 30 (NFR56)

---

## RED-GREEN Workflow

### RED Phase (Complete)

All 10 spec files (163 tests) use `vi.hoisted()` + `vi.mock()` stubs for non-existent modules. Tests verify contracts: schema shapes, constant values, state machine transitions, and mock return signatures. Tests currently pass because they assert the contract specification, not the real implementation.

### GREEN Phase (DEV Team — During Story Implementation)

For each slice:
1. Implement the real module (Server Action, component, schema, constant)
2. Remove the corresponding `vi.mock(path, factory)` block
3. Remove the inline constant/schema stub; replace with real import
4. Run the spec file — it now exercises the real code
5. Tests that fail indicate the implementation doesn't meet the contract

**Key:** The `vi.mock` blocks are clearly marked with `// ── RED-PHASE STUBS ──`. Remove them as each module is implemented.

---

## Running Tests

```bash
# Run all Epic 9 acceptance tests
cd apps/web && pnpm exec vitest run __tests__/acceptance/epic-9/

# Run a specific slice
cd apps/web && pnpm exec vitest run __tests__/acceptance/epic-9/9-3a-stripe-webhook-infrastructure.spec.ts

# Verbose output
cd apps/web && pnpm exec vitest run __tests__/acceptance/epic-9/ --reporter=verbose
```

**Current results:** 10 files, 163 tests, all passing (contract verification).

---

## Implementation Notes

- **9-3a migration**: The `workspaces` table currently lacks `subscription_status`, `subscription_tier`, `stripe_customer_id`, `stripe_subscription_id` columns. The test `[9.3a-ATDD-005]` explicitly asserts these are absent (RED) — flip to positive assertions after the migration lands.
- **`stripe_webhook_events` table**: Already exists in schema (`packages/db/schema/stripe-webhooks.ts`). The planning review called it `stripe_processed_events` but the actual table name is `stripe_webhook_events`.
- **`@flow/shared` subpaths**: The package only exports from index (`.`). Constants like `PORTAL_TOKEN_BYTES` must be added to `packages/shared/src/index.ts`, not a subpath module.
- **pgTAP RLS tests**: Portal access patterns (`anon` role, `SET ROLE anon`) require sibling pgTAP tests in `supabase/tests/epic-9/`. These are out of scope for this ATDD scaffold (Vitest-level only).
- **Stripe test mode**: All tests mock Stripe — no real API calls. Use `4242 4242 4242 4242` (success) and `4000 0000 0000 0002` (decline) in E2E.

---

## Test Execution Evidence

**Command:** `cd apps/web && pnpm exec vitest run __tests__/acceptance/epic-9/`

**Results:**
```
Test Files  10 passed (10)
     Tests  163 passed (163)
```

---

**Generated by BMad TEA Agent** — 2026-06-15
