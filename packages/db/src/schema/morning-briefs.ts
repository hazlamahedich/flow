import { pgTable, uuid, text, timestamp, jsonb, date, integer, index, unique, boolean } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const morningBriefs = pgTable(
  'morning_briefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    briefDate: date('brief_date').notNull().defaultNow(),
    content: jsonb('content').notNull(),
    generationStatus: text('generation_status', {
      enum: ['pending', 'generating', 'completed', 'failed'],
    })
      .notNull()
      .default('pending'),
    errorMessage: text('error_message'),
    emailCountHandled: integer('email_count_handled').notNull().default(0),
    emailCountAttention: integer('email_count_attention').notNull().default(0),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    floodState: boolean('flood_state').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_morning_briefs_workspace_date').on(table.workspaceId, table.briefDate),
    index('idx_morning_briefs_workspace_generated').on(table.workspaceId, table.generatedAt),
    unique('morning_briefs_workspace_brief_date_unique').on(table.workspaceId, table.briefDate),
  ]
);
