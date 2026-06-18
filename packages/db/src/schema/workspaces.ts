import { pgTable, uuid, text, timestamp, jsonb, boolean, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    settings: jsonb('settings').notNull().default({}),
    isAgency: boolean('is_agency').notNull().default(false),
    subscriptionStatus: text('subscription_status').notNull().default('free'),
    subscriptionTier: text('subscription_tier').notNull().default('free'),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    subscriptionCurrentPeriodStart: timestamp('subscription_current_period_start', { withTimezone: true }),
    subscriptionCurrentPeriodEnd: timestamp('subscription_current_period_end', { withTimezone: true }),
    subscriptionCancelAtPeriodEnd: boolean('subscription_cancel_at_period_end').notNull().default(false),
    subscriptionUpdatedAt: timestamp('subscription_updated_at', { withTimezone: true }).notNull().defaultNow(),
    subscriptionStatusUpdatedAt: timestamp('subscription_status_updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (_table) => [
    check(
      'workspaces_subscription_status_valid',
      sql`subscription_status IN ('free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted')`,
    ),
    check(
      'workspaces_subscription_tier_valid',
      sql`subscription_tier IN ('free', 'pro', 'agency')`,
    ),
  ],
);
