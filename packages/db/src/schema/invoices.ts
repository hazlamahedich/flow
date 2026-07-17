import {
  pgTable,
  uuid,
  text,
  bigint,
  date,
  timestamp,
  index,
  check,
  numeric,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clients } from './clients';
import { users } from './users';
import { timeEntries } from './time-entries';
import { retainerAgreements } from './retainer-agreements';
import { sql } from 'drizzle-orm';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    invoiceNumber: text('invoice_number').notNull(),
    status: text('status').notNull().default('draft'),
    issueDate: date('issue_date').notNull(),
    dueDate: date('due_date').notNull(),
    totalCents: bigint('total_cents', { mode: 'number' }).notNull().default(0),
    amountPaidCents: bigint('amount_paid_cents', { mode: 'number' })
      .notNull()
      .default(0),
    creditBalanceCents: bigint('credit_balance_cents', { mode: 'number' })
      .notNull()
      .default(0),
    version: integer('version').notNull().default(1),
    currency: text('currency').notNull().default('usd'),
    notes: text('notes'),
    metadata: jsonb('metadata').notNull().default({}),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason'),
    paymentUrl: text('payment_url'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    deliveryToken: text('delivery_token').unique(),
    dedupHash: text('dedup_hash'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_invoices_invoice_number').on(
      table.workspaceId,
      table.invoiceNumber,
    ),
    index('idx_invoices_workspace_client').on(
      table.workspaceId,
      table.clientId,
    ),
    index('idx_invoices_workspace_status').on(table.workspaceId, table.status),
    check(
      'invoices_status_valid',
      sql`(status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'voided'))`,
    ),
    check('invoices_total_nonneg', sql`total_cents >= 0`),
    check('invoices_amount_paid_nonneg', sql`amount_paid_cents >= 0`),
    check('invoices_credit_balance_nonneg', sql`credit_balance_cents >= 0`),
  ],
);

export const invoicePayments = pgTable(
  'invoice_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    amountCents: bigint('amount_cents', { mode: 'number' })
      .notNull()
      .default(0),
    paymentMethod: text('payment_method').notNull(),
    paymentDate: date('payment_date').notNull(),
    notes: text('notes'),
    stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_invoice_payments_invoice_id').on(table.invoiceId),
    index('idx_invoice_payments_workspace_id').on(table.workspaceId),
    check('ip_amount_nonneg', sql`amount_cents >= 0`),
  ],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyHash: text('key_hash').notNull(),
    scope: text('scope').notNull(),
    invoiceId: uuid('invoice_id').references(() => invoices.id, {
      onDelete: 'cascade',
    }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    responseJson: jsonb('response_json'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idx_idempotency_keys_scope').on(table.scope),
    index('idx_idempotency_keys_expires').on(table.expiresAt),
  ],
);

export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceType: text('source_type').notNull(),
    timeEntryId: uuid('time_entry_id').references(() => timeEntries.id, {
      onDelete: 'set null',
    }),
    retainerId: uuid('retainer_id').references(() => retainerAgreements.id, {
      onDelete: 'set null',
    }),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
    unitPriceCents: bigint('unit_price_cents', { mode: 'number' })
      .notNull()
      .default(0),
    amountCents: bigint('amount_cents', { mode: 'number' })
      .notNull()
      .default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_invoice_line_items_invoice_id').on(table.invoiceId),
    index('idx_invoice_line_items_time_entry_id').on(table.timeEntryId),
    index('idx_invoice_line_items_workspace_id').on(table.workspaceId),
    check('ili_amount_nonneg', sql`amount_cents >= 0`),
    check('ili_quantity_pos', sql`quantity > 0`),
    check('ili_unit_price_nonneg', sql`unit_price_cents >= 0`),
    check(
      'ili_source_fields',
      sql`(
        (source_type = 'time_entry' AND time_entry_id IS NOT NULL AND retainer_id IS NULL)
        OR (source_type = 'fixed_service' AND time_entry_id IS NULL AND retainer_id IS NULL)
        OR (source_type = 'retainer' AND retainer_id IS NOT NULL AND time_entry_id IS NULL)
      )`,
    ),
  ],
);

export const invoiceDeliveries = pgTable(
  'invoice_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    retryCount: integer('retry_count').notNull().default(0),
    lastError: text('last_error'),
    messageId: text('message_id'),
    attemptLog: jsonb('attempt_log').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_invoice_deliveries_invoice_id').on(table.invoiceId),
    index('idx_invoice_deliveries_workspace_id').on(table.workspaceId),
    index('idx_invoice_deliveries_status').on(table.status),
  ],
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type InvoiceDelivery = typeof invoiceDeliveries.$inferSelect;
export type NewInvoiceDelivery = typeof invoiceDeliveries.$inferInsert;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type NewInvoicePayment = typeof invoicePayments.$inferInsert;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
