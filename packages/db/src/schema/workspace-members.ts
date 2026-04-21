import { pgTable, uuid, text, timestamp, check, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    status: text('status').notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('workspace_members_role_check', sql`role IN ('owner', 'admin', 'member', 'client_user')`),
    check('workspace_members_status_check', sql`status IN ('active', 'expired', 'revoked')`),
    check('workspace_members_expires_at_check', sql`expires_at IS NULL OR expires_at > joined_at`),
    uniqueIndex('idx_workspace_members_unique_active').on(table.workspaceId, table.userId).where(sql`status = 'active'`),
    index('idx_workspace_members_workspace_id').on(table.workspaceId),
    index('idx_workspace_members_user_id').on(table.userId),
    index('idx_workspace_members_workspace_user').on(table.workspaceId, table.userId),
  ],
);
