import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { agentIdTypeEnum } from './agent-signals';

export const agentStatusEnum = pgEnum('agent_status', [
  'inactive',
  'activating',
  'active',
  'draining',
  'suspended',
]);

export const integrationHealthEnum = pgEnum('integration_health_type', [
  'healthy',
  'degraded',
  'disconnected',
]);

export const agentConfigurations = pgTable(
  'agent_configurations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    agentId: agentIdTypeEnum('agent_id').notNull(),
    status: agentStatusEnum('status').notNull().default('inactive'),
    lifecycleVersion: integer('lifecycle_version').notNull().default(0),
    setupCompleted: boolean('setup_completed').notNull().default(false),
    hasEverBeenActivated: boolean('has_ever_been_activated').notNull().default(false),
    integrationHealth: integrationHealthEnum('integration_health').default('healthy'),
    schedule: jsonb('schedule').notNull().default({}),
    triggerConfig: jsonb('trigger_config').notNull().default({}),
    llmPreferences: jsonb('llm_preferences').notNull().default({}),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    suspendedReason: text('suspended_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_agent_configs_unique').on(table.workspaceId, table.agentId),
    index('idx_agent_configs_workspace').on(table.workspaceId),
    index('idx_agent_configs_workspace_active').on(table.workspaceId),
  ],
);
