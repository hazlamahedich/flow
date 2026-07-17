import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';

export const timeIntegritySignals = pgTable(
  'time_integrity_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sweepDate: date('sweep_date').notNull(),
    anomalyType: text('anomaly_type').notNull(),
    affectedEntryIds: uuid('affected_entry_ids').array().notNull().default([]),
    signalKey: text('signal_key').notNull(),
    payload: jsonb('payload').notNull().default({}),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_tis_workspace').on(table.workspaceId),
    index('idx_tis_sweep_date').on(table.workspaceId, table.sweepDate),
    // P8: unique constraint mirrors SQL migration uq_signal_per_day — required by upsert onConflict target
    uniqueIndex('uq_signal_per_day').on(
      table.workspaceId,
      table.sweepDate,
      table.signalKey,
    ),
    // P8: check constraint mirrors SQL migration — prevents invalid anomaly_type values
    check(
      'chk_anomaly_type',
      sql`${table.anomalyType} IN ('gap', 'overlap', 'low-hours')`,
    ),
  ],
);

export type TimeIntegritySignal = typeof timeIntegritySignals.$inferSelect;
export type NewTimeIntegritySignal = typeof timeIntegritySignals.$inferInsert;
