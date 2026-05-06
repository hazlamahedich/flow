import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  doublePrecision,
  smallint,
  boolean,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clientInboxes } from './client-inboxes';
import { emails } from './emails';
import { users } from './users';
import { clients } from './clients';

export const workspaceVoiceProfiles = pgTable(
  'workspace_voice_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    styleData: jsonb('style_data').notNull().default({
      toneDescriptors: ['professional', 'concise', 'helpful'],
      avgSentenceLength: 15,
      formalityScore: 7,
    }),
    exemplarEmails: text('exemplar_emails')
      .array()
      .notNull()
      .default([]),
    defaultTone: text('default_tone')
      .notNull()
      .default('professional'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  }
);

export const extractedActions = pgTable(
  'extracted_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailId: uuid('email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientInboxId: uuid('client_inbox_id')
      .notNull()
      .references(() => clientInboxes.id, { onDelete: 'cascade' }),
    actionType: text('action_type').notNull(),
    description: text('description').notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    contact: text('contact'),
    confidence: doublePrecision('confidence').notNull(),
    softDeleted: boolean('soft_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_extracted_actions_workspace_client').on(table.workspaceId, table.clientInboxId),
    index('idx_extracted_actions_email').on(table.emailId),
  ]
);

export const draftResponses = pgTable(
  'draft_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailId: uuid('email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientInboxId: uuid('client_inbox_id')
      .notNull()
      .references(() => clientInboxes.id, { onDelete: 'cascade' }),
    draftContent: text('draft_content').notNull(),
    voiceProfileId: uuid('voice_profile_id').references(() => workspaceVoiceProfiles.id),
    trustAtGeneration: smallint('trust_at_generation').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_draft_responses_workspace_client').on(table.workspaceId, table.clientInboxId),
    index('idx_draft_responses_email').on(table.emailId),
  ]
);

export const clientToneOverrides = pgTable(
  'client_tone_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    tone: text('tone').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_client_tone_overrides_unique').on(table.workspaceId, table.clientId),
  ]
);

export const inboxTrustMetrics = pgTable(
  'inbox_trust_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientInboxId: uuid('client_inbox_id')
      .notNull()
      .references(() => clientInboxes.id, { onDelete: 'cascade' }),
    metricType: text('metric_type').notNull(),
    metricValue: doublePrecision('metric_value').notNull(),
    sampleCount: integer('sample_count').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_inbox_trust_metrics_unique').on(table.workspaceId, table.clientInboxId, table.metricType),
  ]
);

export const recategorizationLog = pgTable(
  'recategorization_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailId: uuid('email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    oldCategory: text('old_category').notNull(),
    newCategory: text('new_category').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_recategorization_log_workspace').on(table.workspaceId, table.emailId),
  ]
);

export const emailProcessingState = pgTable(
  'email_processing_state',
  {
    emailId: uuid('email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    state: text('state').notNull().default('categorized'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_email_processing_state_workspace').on(table.workspaceId, table.state),
  ]
);
