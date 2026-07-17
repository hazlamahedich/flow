import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clientCalendars } from './client-calendars';
import { clients } from './clients';
import { sql } from 'drizzle-orm';

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientCalendarId: uuid('client_calendar_id')
      .notNull()
      .references(() => clientCalendars.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, {
      onDelete: 'cascade',
    }),
    providerEventId: text('provider_event_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    isAllDay: boolean('is_all_day').notNull().default(false),
    attendees: jsonb('attendees').notNull().default([]),
    eventType: text('event_type').notNull().default('unknown'),
    source: text('source').notNull().default('unknown'),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurringRule: text('recurring_rule'),
    createdVia: text('created_via'),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_calendar_events_calendar_provider').on(
      table.clientCalendarId,
      table.providerEventId,
    ),
    index('idx_calendar_events_time_range').on(
      table.clientCalendarId,
      table.startAt,
      table.endAt,
    ),
    index('idx_cal_events_conflicts')
      .on(table.workspaceId, table.startAt, table.endAt)
      .where(sql`end_at > now()`),
    index('idx_calendar_events_workspace').on(table.workspaceId),
    index('idx_calendar_events_calendar_provider_id').on(
      table.clientCalendarId,
      table.providerEventId,
    ),
    check(
      'calendar_events_event_type_check',
      sql`event_type IN ('meeting', 'focus_block', 'travel', 'personal', 'deadline', 'unknown')`,
    ),
    check(
      'calendar_events_source_check',
      sql`source IN ('va_created', 'client_created', 'third_party', 'auto_generated', 'unknown')`,
    ),
  ],
);
