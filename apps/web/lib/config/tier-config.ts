import { cache } from 'react';
import { createServiceClient } from '@flow/db';
import { z } from 'zod';

const tierEntrySchema = z.object({
  maxClients: z.number().nullable(),
  maxTeamMembers: z.number().nullable(),
  maxAgents: z.number().nullable(),
});

const tierLimitsSchema = z
  .object({
    free: tierEntrySchema,
    pro: tierEntrySchema,
    agency: tierEntrySchema,
  })
  .strict();

const tierPricesSchema = z
  .object({
    pro_monthly: z.string(),
    agency_monthly: z.string(),
  })
  .strict();

export type TierLimits = z.infer<typeof tierLimitsSchema>;
export type TierPrices = z.infer<typeof tierPricesSchema>;
export interface SubscriptionWindows {
  grace_period_days: number;
  suspension_period_days: number;
}

const PLACEHOLDER_PREFIX = 'price_placeholder_';

/**
 * Human-readable display price for a plan card. Kept separate from the Stripe
 * price ID so copy can be tuned without touching checkout logic.
 */
export interface PlanDisplayPrice {
  label: string;
  interval: string;
}

export interface TierConfig {
  tierLimits: TierLimits;
  stripePrices: TierPrices;
  planDisplayPrices: Record<'pro' | 'agency', PlanDisplayPrice>;
  windows: SubscriptionWindows;
  freeTransactionFeePercent: number;
}

async function fetchConfigValue<T>(
  supabase: ReturnType<typeof createServiceClient>,
  key: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', key)
    .single();
  if (error || !data) {
    throw new Error(`Missing app_config key: ${key}`);
  }
  return schema.parse(data.value);
}

const planDisplayPricesSchema = z.record(
  z.enum(['pro', 'agency']),
  z.object({ label: z.string(), interval: z.string() }),
) as z.ZodType<Record<'pro' | 'agency', PlanDisplayPrice>>;

export const getTierConfig = cache(async (): Promise<TierConfig> => {
  const supabase = createServiceClient();

  const [
    tierLimits,
    stripePrices,
    displayPrices,
    graceDays,
    suspensionDays,
    freeFee,
  ] = await Promise.all([
    fetchConfigValue(supabase, 'tier_limits', tierLimitsSchema),
    fetchConfigValue(supabase, 'stripe_prices', tierPricesSchema),
    fetchConfigValue(
      supabase,
      'plan_display_prices',
      planDisplayPricesSchema,
    ).catch(() => DEFAULT_DISPLAY_PRICES),
    fetchConfigValue(supabase, 'subscription_grace_period_days', z.number()),
    fetchConfigValue(
      supabase,
      'subscription_suspension_period_days',
      z.number(),
    ),
    fetchConfigValue(
      supabase,
      'stripe_free_transaction_fee_percent',
      z.number(),
    ),
  ]);

  const invalidPrices = Object.entries(stripePrices).filter(([, value]) =>
    value.startsWith(PLACEHOLDER_PREFIX),
  );
  if (invalidPrices.length > 0) {
    throw new Error(
      `stripe_prices contains placeholder values that must be replaced before use: ${invalidPrices.map(([k]) => k).join(', ')}`,
    );
  }

  return {
    tierLimits,
    stripePrices,
    planDisplayPrices: displayPrices,
    windows: {
      grace_period_days: graceDays,
      suspension_period_days: suspensionDays,
    },
    freeTransactionFeePercent: freeFee,
  };
});

const DEFAULT_DISPLAY_PRICES: Record<'pro' | 'agency', PlanDisplayPrice> = {
  pro: { label: '$29 / month', interval: 'month' },
  agency: { label: '$99 / month', interval: 'month' },
};
