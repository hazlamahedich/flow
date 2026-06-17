# Story 9.3b — Code Review Findings

## Summary

- **Decision needed:** 1
- **Patch:** 6
- **Defer:** 2
- **Dismissed:** 1

:xed in this pass. Decision converted to Patch #7 and applied.

## Patch (7) — applied

- [x] [Review][Patch] Customer creation idempotency key missing [apps/web/lib/actions/billing/create-checkout-session.ts:122-127] — `PaymentProvider.createCustomer` / `StripePaymentProvider.createCustomer` now accept optional `idempotencyKey`; action passes `customer:${ctx.workspaceId}`. Unit + ATDD tests assert the key.
- [x] [Review][Patch] `syncStripeDataAction` passes `p_tier: null` to `upsert_workspace_subscription` [apps/web/lib/actions/billing/sync-stripe-data.ts:156] — now maps `subscription.priceId` to tier via `getTierConfig()` before calling the RPC, matching the 9-3a webhook pattern.
- [x] [Review][Patch] `syncStripeDataAction` ignores logical RPC errors [apps/web/lib/actions/billing/sync-stripe-data.ts:151-164] — now destructures `{ data, error }`; logs `data.error` when present.
- [x] [Review][Patch] `mapStatusForRpc` maps unknown Stripe statuses to `active` [apps/web/lib/actions/billing/sync-stripe-data.ts:172-177] — now aligned with 9-3a webhook: `active|trialing → active`, `past_due → past_due`, `canceled|unpaid|incomplete|incomplete_expired → cancelled`, unknown → null (skip upsert + log).
- [x] [Review][Patch] Unit-test mock masks null-tier RPC failure [apps/web/__tests__/billing/9-3b-checkout-portal.spec.ts:143-155] — mock now returns `{ success: true }` for `upsert_workspace_subscription`; added tests asserting `p_tier` is non-null and matches expected tier, plus tests for unmapped status/price skipping upsert and logical RPC error logging.
- [x] [Review][Patch] `cancelSubscriptionAction` / `reactivateSubscriptionAction` reuse `createPortalSessionSchema` for empty input [apps/web/lib/actions/billing/subscription-manage.ts:51,92] — now use dedicated `manageSubscriptionSchema` exported from `packages/types/src/subscription.ts`.
- [x] [Review][Patch] `PlanCard.tsx` hardcoded prices [apps/web/app/(workspace)/settings/billing/components/PlanCard.tsx:22,28] — prices now derived from `getTierConfig().planDisplayPrices` with a fallback default. `TierConfig` extended with `planDisplayPrices`; `app_config` key `plan_display_prices` is read with a default fallback so unseeded environments still render.

## Defer (2)

- [x] [Review][Defer] Workspaces RLS UPDATE policy allows admin role [supabase/migrations/20260616000001_portal_branding.sql:33-42] — pre-existing policy from portal branding story; 9.3b enforces owner-only at application layer. Defense-in-depth improvement belongs outside this story.
- [x] [Review][Defer] Root `pnpm typecheck` still reports 9 pre-existing calendar/inbox test errors — baseline issue already noted in T9.1; no new type errors introduced by 9.3b.

## Dismissed (1)

- `Subscription.status` union includes Stripe statuses (`incomplete`, `trialing`, `paused`) outside the DB CHECK — provider type legitimately models Stripe's status space; DB mapping occurs at `mapSubscription` / `mapStatusForRpc` boundaries. AC6 only required changing `'canceled'` → `'cancelled'`, not removing statuses.

