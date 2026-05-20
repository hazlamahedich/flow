import { pgTable, pgEnum, uuid, text, integer, jsonb, timestamp, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clients } from './clients';
import { calendarEvents } from './calendar-events';
import { sql } from 'drizzle-orm';

export const schedulingRequestSourceTypeEnum = pgEnum('scheduling_request_source_type', [
  'email_extraction',
  'va_manual',
  'client_portal',
]);

export const schedulingRequestTypeEnum = pgEnum('scheduling_request_type', [
  'book_new',
  'reschedule',
  'cancel',
  'check_availability',
]);

export const schedulingRequestStatusEnum = pgEnum('scheduling_request_status', [
  'pending',
  'options_proposed',
  'option_selected',
  'booked',
  'failed',
  'cancelled',
]);

export const schedulingRequests = pgTable(
  'scheduling_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    sourceEmailId: uuid('source_email_id'),
    sourceType: schedulingRequestSourceTypeEnum('source_type').notNull(),
    requestType: schedulingRequestTypeEnum('request_type').notNull(),
    requestedBy: jsonb('requested_by').notNull(),
    requestedSlots: jsonb('requested_slots'),
    durationMinutes: integer('duration_minutes'),
    preferences: jsonb('preferences').notNull().default({}),
    status: schedulingRequestStatusEnum('status').notNull(),
    proposedOptions: jsonb('proposed_options').notNull().default([]),
    selectedOption: integer('selected_option'),
    bookedEventId: uuid('booked_event_id')
      .references(() => calendarEvents.id, { onDelete: 'set null' }),
    agentRunId: uuid('agent_run_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_scheduling_requests_dedup').on(table.workspaceId, table.sourceEmailId, table.requestType),
    index('idx_scheduling_requests_workspace').on(table.workspaceId),
    index('idx_scheduling_requests_workspace_status').on(table.workspaceId, table.status),
    index('idx_scheduling_requests_client').on(table.workspaceId, table.clientId),
  ],
);
