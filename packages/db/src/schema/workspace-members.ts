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
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('workspace_members_role_check', sql`role IN ('owner', 'admin', 'member', 'client_user')`),
    uniqueIndex('idx_workspace_members_unique_active').on(table.workspaceId, table.userId).where(sql`removed_at IS NULL`),
    index('idx_workspace_members_workspace_id').on(table.workspaceId),
    index('idx_workspace_members_user_id').on(table.userId),
    index('idx_workspace_members_workspace_user').on(table.workspaceId, table.userId),
  ],
);
