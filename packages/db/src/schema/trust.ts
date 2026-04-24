import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { agentIdTypeEnum } from './agent-signals';
import { agentRuns } from './agent-runs';

export const trustLevelEnum = pgEnum('trust_level', [
  'supervised',
  'confirm',
  'auto',
]);

export const trustMatrix = pgTable(
  'trust_matrix',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    agentId: agentIdTypeEnum('agent_id').notNull(),
    actionType: text('action_type').notNull(),
    currentLevel: trustLevelEnum('current_level').notNull().default('supervised'),
    score: smallint('score').notNull().default(0),
    totalExecutions: integer('total_executions').notNull().default(0),
    successfulExecutions: integer('successful_executions').notNull().default(0),
    consecutiveSuccesses: integer('consecutive_successes').notNull().default(0),
    violationCount: integer('violation_count').notNull().default(0),
    lastTransitionAt: timestamp('last_transition_at', { withTimezone: true }).notNull().defaultNow(),
    lastViolationAt: timestamp('last_violation_at', { withTimezone: true }),
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_trust_matrix_cell').on(table.workspaceId, table.agentId, table.actionType),
    index('idx_trust_matrix_workspace').on(table.workspaceId, table.agentId),
    index('idx_trust_matrix_workspace_text').on(sql`(workspace_id::text)`),
    index('idx_trust_matrix_cooldown').on(table.cooldownUntil),
  ],
);

export const trustTransitions = pgTable(
  'trust_transitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matrixEntryId: uuid('matrix_entry_id')
      .notNull()
      .references(() => trustMatrix.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    fromLevel: trustLevelEnum('from_level').notNull(),
    toLevel: trustLevelEnum('to_level').notNull(),
    triggerType: text('trigger_type').notNull(),
    triggerReason: text('trigger_reason').notNull(),
    isContextShift: boolean('is_context_shift').notNull().default(false),
    snapshot: jsonb('snapshot').notNull(),
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_trust_transitions_entry').on(table.matrixEntryId, table.createdAt),
    index('idx_trust_transitions_workspace').on(table.workspaceId, table.createdAt),
    index('idx_trust_transitions_workspace_text').on(sql`(workspace_id::text)`),
  ],
);

export const trustSnapshots = pgTable(
  'trust_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    agentId: agentIdTypeEnum('agent_id').notNull(),
    actionType: text('action_type').notNull(),
    matrixVersion: integer('matrix_version').notNull(),
    level: trustLevelEnum('level').notNull(),
    score: smallint('score').notNull(),
    snapshotHash: text('snapshot_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_trust_snapshots_execution').on(table.executionId),
    index('idx_trust_snapshots_workspace').on(table.workspaceId, table.createdAt),
    index('idx_trust_snapshots_workspace_text').on(sql`(workspace_id::text)`),
  ],
);

export const trustPreconditions = pgTable(
  'trust_preconditions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    agentId: agentIdTypeEnum('agent_id').notNull(),
    actionType: text('action_type').notNull(),
    conditionKey: text('condition_key').notNull(),
    conditionExpr: text('condition_expr').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_trust_preconditions_workspace').on(table.workspaceId, table.agentId),
    index('idx_trust_preconditions_workspace_text').on(sql`(workspace_id::text)`),
  ],
);
