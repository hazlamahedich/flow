import { pgTable, uuid, integer, numeric, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clients } from './clients';

export const calendarBypassMetrics = pgTable(
  'calendar_bypass_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    totalEvents: integer('total_events').notNull().default(0),
    bypassCount: integer('bypass_count').notNull().default(0),
    bypassRate: numeric('bypass_rate', { precision: 5, scale: 4 }).notNull().default('0'),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_cal_bypass_metrics_workspace_client_window').on(table.workspaceId, table.clientId, table.windowStart),
    index('idx_cal_bypass_metrics_workspace_window').on(table.workspaceId, table.windowEnd),
    index('idx_cal_bypass_metrics_workspace_client').on(table.workspaceId, table.clientId),
  ],
);
