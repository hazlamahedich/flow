import { pgTable, pgEnum, uuid, text, smallint, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const agentIdTypeEnum = pgEnum('agent_id_type', [
  'inbox',
  'calendar',
  'ar-collection',
  'weekly-report',
  'client-health',
  'time-integrity',
]);

export const agentSignals = pgTable(
  'agent_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    correlationId: uuid('correlation_id').notNull(),
    causationId: uuid('causation_id'),
    agentId: agentIdTypeEnum('agent_id').notNull(),
    signalType: text('signal_type').notNull(),
    version: smallint('version').notNull().default(1),
    payload: jsonb('payload').notNull().default({}),
    targetAgent: agentIdTypeEnum('target_agent'),
    clientId: uuid('client_id'),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_agent_signals_correlation_id').on(table.correlationId),
    index('idx_agent_signals_workspace_created').on(table.workspaceId, table.createdAt),
    index('idx_agent_signals_causation_id').on(table.causationId),
    index('idx_agent_signals_agent_workspace').on(table.workspaceId, table.agentId),
  ],
);
