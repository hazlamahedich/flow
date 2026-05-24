import { pgTable, uuid, text, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { calendarEvents } from './calendar-events';
import { sql } from 'drizzle-orm';

export const calendarEventRelations = pgTable(
  'calendar_event_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentEventId: uuid('parent_event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    childEventId: uuid('child_event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    relationType: text('relation_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_cal_event_relations_parent_child_type').on(table.parentEventId, table.childEventId, table.relationType),
    index('idx_cal_event_relations_parent').on(table.parentEventId),
    index('idx_cal_event_relations_child').on(table.childEventId),
    index('idx_cal_event_relations_parent_type').on(table.parentEventId, table.relationType),
    check(
      'calendar_event_relations_relation_type_check',
      sql`relation_type IN ('prep_time', 'travel_time', 'debrief', 'rescheduled_from')`,
    ),
  ],
);
