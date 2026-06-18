/**
 * Subscription types and input schemas for billing flows.
 *
 * Story 9.3b — FR55, FR58.
 *
 * Conventions:
 * - `subscriptionTierSchema` (`free|pro|agency`) — read model for the workspace's
 *   current tier. Matches the `workspaces.subscription_tier` DB CHECK constraint.
 * - `upgradableTierSchema` (`pro|agency`) — write model for checkout input.
 *   `free` cannot be "checked out" (it is the absence of a subscription).
 * - `subscriptionStatusSchema` — matches the `workspaces.subscription_status`
 *   DB CHECK constraint (`free|active|past_due|cancelled`). British spelling
 *   for `cancelled` aligns with 9-3a's migration. `suspended`/`deleted`/`trialing`
 *   are NOT in 9-3a's migration and belong to 9-5a.
 * - `billingIntervalSchema` (`monthly|yearly`) — full universe of intervals
 *   (yearly reserved for future prices). `checkoutIntervalSchema` (`monthly`)
 *   is the input contract today.
 */
import { z } from 'zod';

export const subscriptionTierSchema = z.enum(['free', 'pro', 'agency']);
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

export const upgradableTierSchema = z.enum(['pro', 'agency']);
export type UpgradableTier = z.infer<typeof upgradableTierSchema>;

export const subscriptionStatusSchema = z.enum([
  'free',
  'active',
  'past_due',
  'cancelled',
  'suspended',
  'deleted',
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionLifecycleStatusSchema = z.enum([
  'free',
  'active',
  'past_due',
  'suspended',
  'deleted',
]);
export type SubscriptionLifecycleStatus = z.infer<typeof subscriptionLifecycleStatusSchema>;

export const ReconciliationReportSchema = z.object({
  checked: z.number().int().nonnegative(),
  drift: z.array(
    z.object({
      workspaceId: z.string(),
      fromStatus: subscriptionStatusSchema,
      toStatus: subscriptionStatusSchema,
      corrected: z.boolean(),
    })
  ),
  uncorrectable: z.array(
    z.object({
      workspaceId: z.string(),
      reason: z.string(),
    })
  ),
});
export type ReconciliationReport = z.infer<typeof ReconciliationReportSchema>;

export const billingIntervalSchema = z.enum(['monthly', 'yearly']);
export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const checkoutIntervalSchema = z.enum(['monthly']);
export type CheckoutInterval = z.infer<typeof checkoutIntervalSchema>;

export const createCheckoutSessionSchema = z.object({
  tier: upgradableTierSchema,
  interval: checkoutIntervalSchema,
});
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;

/**
 * changeTierSchema — write model for `changeTierAction` (Story 9.4 AC4, FR62).
 *
 * `targetTier` is `pro | agency`. Downgrade-to-Free is NOT a tier change — it
 * is a cancel-at-period-end flow owned by 9-5a/FR57. EC7 verifies this at the
 * schema level.
 */
export const changeTierSchema = z.object({
  targetTier: upgradableTierSchema,
});
export type ChangeTierInput = z.infer<typeof changeTierSchema>;

export const createPortalSessionSchema = z.object({}).optional();
export type CreatePortalSessionInput = z.infer<typeof createPortalSessionSchema>;

/**
 * Empty input schema for billing management actions that accept no meaningful
 * payload (e.g., cancel/reactivate subscription). Keeps the validation layer
 * explicit and decoupled from portal-session schemas.
 */
export const manageSubscriptionSchema = z.object({}).optional();
export type ManageSubscriptionInput = z.infer<typeof manageSubscriptionSchema>;
