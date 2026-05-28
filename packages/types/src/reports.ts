import { z } from 'zod';

export const reportStatusEnum = z.enum([
  'draft',
  'sent',
  'viewed',
  'approved',
]);
export type ReportStatus = z.infer<typeof reportStatusEnum>;

export const sectionTypeEnum = z.enum([
  'time_summary',
  'task_log',
  'agent_activity',
  'invoice_summary',
]);
export type SectionType = z.infer<typeof sectionTypeEnum>;

function isValidDate(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(dateStr);
}

export const generateWeeklyReportSchema = z.object({
  clientId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').refine(
    isValidDate,
    { message: 'periodStart is not a valid calendar date' },
  ),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').refine(
    isValidDate,
    { message: 'periodEnd is not a valid calendar date' },
  ),
  templateId: z.string().uuid().optional(),
}).refine(
  (data) => data.periodStart <= data.periodEnd,
  { message: 'periodStart must be <= periodEnd', path: ['periodStart'] },
).refine(
  (data) => {
    const start = new Date(`${data.periodStart}T00:00:00Z`);
    const end = new Date(`${data.periodEnd}T00:00:00Z`);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 31;
  },
  { message: 'Date range must not exceed 31 days', path: ['periodEnd'] },
);
export type GenerateWeeklyReportInput = z.infer<typeof generateWeeklyReportSchema>;

export const weeklyReportSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  status: reportStatusEnum,
  templateId: z.string().uuid().nullable(),
  generatedBy: z.string().uuid(),
  generatedAt: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
  version: z.number(),
  parentReportId: z.string().uuid().nullable(),
  templateSnapshot: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WeeklyReport = z.infer<typeof weeklyReportSchema>;

export const weeklyReportSectionSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  sectionType: sectionTypeEnum,
  title: z.string(),
  content: z.record(z.unknown()),
  sortOrder: z.number(),
  createdAt: z.string().datetime(),
});
export type WeeklyReportSection = z.infer<typeof weeklyReportSectionSchema>;

export const reportTemplateSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid().nullable(),
  name: z.string(),
  sectionsConfig: z.record(z.unknown()),
  branding: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReportTemplate = z.infer<typeof reportTemplateSchema>;

export const reportListItemSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  status: reportStatusEnum,
  generatedAt: z.string().datetime(),
  version: z.number(),
});
export type ReportListItem = z.infer<typeof reportListItemSchema>;
