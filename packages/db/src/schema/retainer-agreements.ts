import { pgTable, uuid, text, bigint, integer, date, timestamp, index, check, numeric } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clients } from './clients';
import { sql } from 'drizzle-orm';

export const retainerAgreements = pgTable(
  'retainer_agreements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    hourlyRateCents: bigint('hourly_rate_cents', { mode: 'number' }),
    monthlyFeeCents: bigint('monthly_fee_cents', { mode: 'number' }),
    monthlyHoursThreshold: numeric('monthly_hours_threshold', { precision: 10, scale: 2, mode: 'string' }),
    packageHours: numeric('package_hours', { precision: 10, scale: 2, mode: 'string' }),
    packageName: text('package_name'),
    billingPeriodDays: integer('billing_period_days').notNull().default(30),
    startDate: date('start_date').notNull().default(sql`CURRENT_DATE`),
    endDate: date('end_date'),
    status: text('status').notNull().default('active'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_retainer_agreements_workspace_active')
      .on(table.workspaceId, table.clientId),
    index('idx_retainer_agreements_client_status')
      .on(table.clientId, table.status),
    check(
      'ra_type_fields_check',
      sql`(
        (type = 'hourly_rate' AND hourly_rate_cents IS NOT NULL AND monthly_fee_cents IS NULL AND package_hours IS NULL AND package_name IS NULL) OR
        (type = 'flat_monthly' AND monthly_fee_cents IS NOT NULL AND hourly_rate_cents IS NULL AND package_hours IS NULL AND package_name IS NULL) OR
        (type = 'package_based' AND package_hours IS NOT NULL AND package_name IS NOT NULL AND monthly_fee_cents IS NULL)
      )`,
    ),
    check(
      'ra_cancelled_at_check',
      sql`((status = 'cancelled' AND cancelled_at IS NOT NULL) OR (status != 'cancelled'))`,
    ),
  ],
);
