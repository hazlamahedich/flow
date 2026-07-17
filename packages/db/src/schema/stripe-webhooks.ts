import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  index,
  check,
  jsonb,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { invoices } from './invoices';
import { sql } from 'drizzle-orm';

export const stripeWebhookEvents = pgTable(
  'stripe_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stripeEventId: text('stripe_event_id').notNull().unique(),
    eventType: text('event_type').notNull(),
    status: text('status').notNull().default('pending'),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, {
      onDelete: 'cascade',
    }),
    payloadJson: jsonb('payload_json').notNull().default({}),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idx_stripe_webhook_events_stripe_event_id').on(table.stripeEventId),
    index('idx_stripe_webhook_events_expires_at').on(table.expiresAt),
    index('idx_stripe_webhook_events_workspace_id').on(table.workspaceId),
    check(
      'swe_status_valid',
      sql`(status IN ('pending', 'processed', 'failed'))`,
    ),
  ],
);

export const invoicePaymentAttempts = pgTable(
  'invoice_payment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    stripeEventId: text('stripe_event_id'),
    attemptType: text('attempt_type').notNull(),
    status: text('status').notNull(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    amountCents: bigint('amount_cents', { mode: 'number' })
      .notNull()
      .default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_invoice_payment_attempts_invoice_id').on(table.invoiceId),
    index('idx_invoice_payment_attempts_invoice_created_at').on(
      table.invoiceId,
      table.createdAt,
    ),
    index('idx_invoice_payment_attempts_workspace_id').on(table.workspaceId),
    check(
      'ipa_attempt_type_valid',
      sql`(attempt_type IN ('manual', 'stripe_checkout'))`,
    ),
    check(
      'ipa_status_valid',
      sql`(status IN ('failed', 'succeeded', 'pending'))`,
    ),
    check('ipa_amount_nonneg', sql`amount_cents >= 0`),
  ],
);

export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type NewStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;
export type InvoicePaymentAttempt = typeof invoicePaymentAttempts.$inferSelect;
export type NewInvoicePaymentAttempt =
  typeof invoicePaymentAttempts.$inferInsert;
