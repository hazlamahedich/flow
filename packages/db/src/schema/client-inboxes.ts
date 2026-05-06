import { pgTable, uuid, text, timestamp, jsonb, index, check } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clients } from './clients';
import { sql } from 'drizzle-orm';

export const clientInboxes = pgTable(
  'client_inboxes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('gmail'),
    emailAddress: text('email_address').notNull(),
    accessType: text('access_type').notNull(),
    oauthState: jsonb('oauth_state').notNull().default({}),
    syncStatus: text('sync_status').notNull().default('disconnected'),
    syncCursor: text('sync_cursor'),
    errorMessage: text('error_message'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_client_inboxes_workspace_email').on(table.workspaceId, table.emailAddress),
    index('idx_client_inboxes_workspace_client').on(table.workspaceId, table.clientId),
    check('client_inboxes_provider_check', sql`provider IN ('gmail', 'outlook')`),
    check('client_inboxes_access_type_check', sql`access_type IN ('direct', 'delegated', 'service_account')`),
    check(
      'client_inboxes_sync_status_check',
      sql`sync_status IN ('connected', 'syncing', 'error', 'disconnected')`,
    ),
  ],
);
