import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { agentRuns } from './agent-runs';
import { agentIdTypeEnum } from './agent-signals';

export const llmCostLogs = pgTable(
  'llm_cost_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    agentId: agentIdTypeEnum('agent_id').notNull(),
    runId: uuid('run_id').references(() => agentRuns.id),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    estimatedCostCents: integer('estimated_cost_cents'),
    actualCostCents: integer('actual_cost_cents'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_cost_logs_workspace_date').on(table.workspaceId, table.createdAt),
    index('idx_cost_logs_workspace_agent').on(table.workspaceId, table.agentId),
  ],
);
