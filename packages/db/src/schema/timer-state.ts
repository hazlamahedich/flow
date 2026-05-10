import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clients } from './clients';
import { users } from './users';
import { projects } from './projects';

export const timerState = pgTable(
  'timer_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    notes: text('notes'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('timer_state_unique_user_per_workspace').on(table.workspaceId, table.userId),
    index('idx_timer_state_workspace_user').on(table.workspaceId, table.userId),
  ],
);

export type TimerState = typeof timerState.$inferSelect;
export type NewTimerState = typeof timerState.$inferInsert;
