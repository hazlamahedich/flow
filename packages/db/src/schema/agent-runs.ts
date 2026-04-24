import { pgTable, pgEnum, uuid, text, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { agentSignals, agentIdTypeEnum } from './agent-signals';

export const agentRunStatusEnum = pgEnum('agent_run_status', [
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'timed_out',
  'cancelled',
]);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    agentId: agentIdTypeEnum('agent_id').notNull(),
    jobId: text('job_id').notNull(),
    signalId: uuid('signal_id').references(() => agentSignals.id),
    actionType: text('action_type').notNull(),
    clientId: uuid('client_id'),
    idempotencyKey: text('idempotency_key'),
    status: agentRunStatusEnum('status').notNull().default('queued'),
    input: jsonb('input').notNull().default({}),
    output: jsonb('output'),
    error: jsonb('error'),
    trustTierAtExecution: text('trust_tier_at_execution'),
    trustSnapshotId: uuid('trust_snapshot_id'),
    correlationId: uuid('correlation_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_agent_runs_workspace_status').on(table.workspaceId, table.status),
    index('idx_agent_runs_workspace_created').on(table.workspaceId, table.createdAt),
    uniqueIndex('idx_agent_runs_job_id').on(table.jobId),
    index('idx_agent_runs_correlation_id').on(table.correlationId),
    index('idx_agent_runs_agent_workspace').on(table.agentId, table.workspaceId),
  ],
);
