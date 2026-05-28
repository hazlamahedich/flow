import { pgTable, uuid, text, integer, date, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { clients } from './clients';
import { users } from './users';

export const reportTemplates = pgTable(
  'report_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sectionsConfig: jsonb('sections_config').notNull().default({}),
    branding: jsonb('branding').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_report_templates_workspace_default').on(table.workspaceId).where(sql`client_id IS NULL`),
    index('idx_report_templates_workspace_client').on(table.workspaceId, table.clientId),
  ],
);

export const weeklyReports = pgTable(
  'weekly_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    status: text('status').notNull().default('draft'),
    templateId: uuid('template_id').references(() => reportTemplates.id, { onDelete: 'set null' }),
    generatedBy: uuid('generated_by')
      .notNull()
      .references(() => users.id),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    parentReportId: uuid('parent_report_id'),
    templateSnapshot: jsonb('template_snapshot').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_weekly_reports_workspace_client_generated').on(table.workspaceId, table.clientId, table.generatedAt),
    index('idx_weekly_reports_workspace_draft').on(table.workspaceId).where(sql`status = 'draft'`),
    index('idx_weekly_reports_parent_id').on(table.parentReportId).where(sql`parent_report_id IS NOT NULL`),
    sql`CONSTRAINT period_start_before_end CHECK (${table.periodStart} <= ${table.periodEnd})`,
  ],
);

export const weeklyReportSections = pgTable(
  'weekly_report_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => weeklyReports.id, { onDelete: 'cascade' }),
    sectionType: text('section_type').notNull(),
    title: text('title').notNull(),
    content: jsonb('content').notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_weekly_report_sections_report_sort').on(table.reportId, table.sortOrder),
    sql`UNIQUE (report_id, section_type)`,
  ],
);

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type NewReportTemplate = typeof reportTemplates.$inferInsert;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type NewWeeklyReport = typeof weeklyReports.$inferInsert;
export type WeeklyReportSection = typeof weeklyReportSections.$inferSelect;
export type NewWeeklyReportSection = typeof weeklyReportSections.$inferInsert;
