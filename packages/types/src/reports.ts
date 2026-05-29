import { z } from 'zod';

function isValidDate(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(dateStr);
}

const DESIGN_SYSTEM_PALETTE = [
  '#6366f1', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#64748b', '#18181b',
] as const;

export const accentColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').refine(
  (val) => DESIGN_SYSTEM_PALETTE.includes(val as typeof DESIGN_SYSTEM_PALETTE[number]),
  { message: 'Accent color must be from the design system palette' },
);

export const brandingSchema = z.object({
  accentColor: accentColorSchema,
  logoUrl: z.string().url().optional(),
});
export type Branding = z.infer<typeof brandingSchema>;

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

const sectionConfigEntrySchema = z.object({
  enabled: z.boolean(),
  sort_order: z.number().int().min(1).max(4),
});

function buildSectionsConfigSchema() {
  const keys: [string, string, string, string] = ['time_summary', 'task_log', 'agent_activity', 'invoice_summary'];
  const shape: Record<string, z.ZodType<unknown>> = {};
  for (const k of keys) {
    shape[k] = sectionConfigEntrySchema;
  }
  return z.object(shape as Record<string, typeof sectionConfigEntrySchema>).strict().superRefine((val, ctx) => {
    const enabledCount = Object.values(val).filter((v) => v.enabled).length;
    if (enabledCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one section must be enabled',
        path: ['SECTION_COUNT_MIN'],
      });
    }
  });
}

export const templateSectionsConfigSchema = buildSectionsConfigSchema();
export type TemplateSectionsConfig = z.infer<typeof templateSectionsConfigSchema>;

export const saveReportTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  sectionsConfig: templateSectionsConfigSchema,
  branding: z.object({
    accentColor: accentColorSchema,
    logoUrl: z.string().url().max(2048).optional(),
  }),
});
export type SaveReportTemplateInput = z.infer<typeof saveReportTemplateSchema>;

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

export const deleteReportTemplateSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteReportTemplateInput = z.infer<typeof deleteReportTemplateSchema>;

export const templateListItemSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
  name: z.string(),
  sectionsConfig: z.record(z.unknown()),
  branding: z.record(z.unknown()),
  updatedAt: z.string().datetime(),
});
export type TemplateListItem = z.infer<typeof templateListItemSchema>;

export type ReportTemplateDetail = z.infer<typeof reportTemplateSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
