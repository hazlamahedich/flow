import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { users } from './users';

export const fridayFeelingSummaries = pgTable(
  'friday_feeling_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    weekEnd: date('week_end', { mode: 'string' }).notNull(),
    headline: text('headline').notNull(),
    tasksHandled: integer('tasks_handled').notNull(),
    timeSavedMinutes: integer('time_saved_minutes').notNull(),
    trustMilestones: jsonb('trust_milestones').notNull().default([]),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  },
  (table) => [
    sql`CONSTRAINT ff_summaries_week_start CHECK (tasks_handled >= 0 AND time_saved_minutes >= 0)`,
    index('idx_ff_summaries_workspace').on(table.workspaceId),
    index('idx_ff_summaries_active').on(table.workspaceId, table.generatedAt),
  ],
);

export type FridayFeelingSummary = typeof fridayFeelingSummaries.$inferSelect;
export type NewFridayFeelingSummary = typeof fridayFeelingSummaries.$inferInsert;

export const wednesdayAffirmations = pgTable(
  'wednesday_affirmations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    teamMemberId: uuid('team_member_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    story: text('story').notNull(),
    milestone: jsonb('milestone').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_wa_workspace').on(table.workspaceId),
    index('idx_wa_active').on(table.workspaceId, table.generatedAt),
  ],
);

export type WednesdayAffirmation = typeof wednesdayAffirmations.$inferSelect;
export type NewWednesdayAffirmation = typeof wednesdayAffirmations.$inferInsert;
