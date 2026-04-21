import { pgTable, uuid, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';

export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull().default(sql`now() + interval '7 days'`),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    invitedBy: uuid('invited_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_invitations_token_hash').on(table.tokenHash),
    uniqueIndex('one_pending_invitation_per_workspace_email')
      .on(table.workspaceId, table.email)
      .where(sql`accepted_at IS NULL`),
    index('idx_workspace_invitations_workspace_id').on(table.workspaceId),
  ],
);
