import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const memberClientAccess = pgTable(
  'member_client_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    clientId: uuid('client_id').notNull(),
    grantedBy: uuid('granted_by').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('member_client_access_workspace_user_client_unique')
      .on(table.workspaceId, table.userId, table.clientId),
    index('idx_member_client_access_workspace_user')
      .on(table.workspaceId, table.userId),
  ],
);
