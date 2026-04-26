import { pgTable, uuid, text, bigint, timestamp, index, check } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { sql } from 'drizzle-orm';

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    companyName: text('company_name'),
    address: text('address'),
    notes: text('notes'),
    billingEmail: text('billing_email'),
    hourlyRateCents: bigint('hourly_rate_cents', { mode: 'number' }),
    status: text('status').notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_clients_workspace_status').on(table.workspaceId, table.status),
    index('idx_clients_workspace_name').on(table.workspaceId, table.name),
    check(
      'clients_status_archived_at_check',
      sql`((status = 'archived' AND archived_at IS NOT NULL) OR (status = 'active' AND archived_at IS NULL))`,
    ),
  ],
);
