import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';

export const transferRequests = pgTable(
  'transfer_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id').notNull(),
    toUserId: uuid('to_user_id').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull().default(sql`now() + interval '48 hours'`),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('one_pending_transfer_per_workspace')
      .on(table.workspaceId)
      .where(sql`status = 'pending'`),
  ],
);
