import { pgTable, uuid, integer, date, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clients } from './clients';
import { users } from './users';
import { projects } from './projects';
import { sql } from 'drizzle-orm';

export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    date: date('date').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_time_entries_workspace_id').on(table.workspaceId),
    index('idx_time_entries_client_id').on(table.clientId),
    index('idx_time_entries_user_id').on(table.userId),
    index('idx_time_entries_workspace_client_date').on(table.workspaceId, table.clientId, table.date),
    check(
      'time_entries_duration_check',
      sql`duration_minutes > 0`,
    ),
  ],
);

export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
