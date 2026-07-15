import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { timeEntries } from './time-entries';
import { users } from './users';

export const timeEntryEditHistory = pgTable(
  'time_entry_edit_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    timeEntryId: uuid('time_entry_id')
      .notNull()
      .references(() => timeEntries.id, { onDelete: 'cascade' }),
    previousValues: jsonb('previous_values').notNull(),
    changedBy: uuid('changed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    editReason: text('edit_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_teeh_entry').on(table.timeEntryId),
    index('idx_teeh_changed_by').on(table.changedBy),
  ],
);

export type TimeEntryEditHistory = typeof timeEntryEditHistory.$inferSelect;
export type NewTimeEntryEditHistory = typeof timeEntryEditHistory.$inferInsert;
