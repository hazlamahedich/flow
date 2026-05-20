import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clients } from './clients';
import { sql } from 'drizzle-orm';

export const clientCalendars = pgTable(
  'client_calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('google_calendar'),
    calendarId: text('calendar_id').notNull(),
    calendarName: text('calendar_name').notNull(),
    accessType: text('access_type').notNull().default('read_only'),
    oauthState: jsonb('oauth_state').notNull().default({}),
    syncCursor: text('sync_cursor'),
    syncStatus: text('sync_status').notNull().default('disconnected'),
    consecutiveRefreshFailures: integer('consecutive_refresh_failures').notNull().default(0),
    colorTag: text('color_tag'),
    emailAddress: text('email_address'),
    isPrimary: boolean('is_primary').notNull().default(false),
    errorMessage: text('error_message'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_client_calendars_workspace_calendar').on(table.workspaceId, table.calendarId),
    index('idx_client_calendars_workspace_client').on(table.workspaceId, table.clientId),
    index('idx_client_calendars_workspace').on(table.workspaceId),
    index('idx_client_calendars_workspace_calendar_id').on(table.workspaceId, table.calendarId),
    check('client_calendars_provider_check', sql`provider IN ('google_calendar', 'outlook')`),
    check('client_calendars_access_type_check', sql`access_type IN ('owner', 'read_write', 'read_only')`),
    check(
      'client_calendars_sync_status_check',
      sql`sync_status IN ('connected', 'syncing', 'error', 'disconnected')`,
    ),
  ],
);
