import { z } from 'zod';

export interface CalendarInput {
  workspaceId: string;
  signalId: string;
}

export interface CalendarProposal {
  eventType: string;
  confidence: number;
  reasoning: string;
}

export const calendarInputSchema = z.object({
  workspaceId: z.string().uuid(),
  signalId: z.string().uuid(),
});

export const calendarProposalSchema = z.object({
  eventType: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const SchedulingRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  sourceEmailId: z.string().uuid().nullable().optional(),
  sourceType: z.enum(['email_extraction', 'va_manual', 'client_portal']),
  requestType: z.enum([
    'book_new',
    'reschedule',
    'cancel',
    'check_availability',
  ]),
  requestedBy: z.record(z.unknown()),
  requestedSlots: z.array(z.record(z.unknown())).optional().nullable(),
  durationMinutes: z.number().int().positive().optional().nullable(),
  preferences: z.record(z.unknown()).optional().default({}),
});

export const BookingProposalInputSchema = z.object({
  workspaceId: z.string().uuid(),
  schedulingRequestId: z.string().uuid(),
});

export const CreateEventInputSchema = z.object({
  workspaceId: z.string().uuid(),
  schedulingRequestId: z.string().uuid(),
  selectedOptionIndex: z.number().int().min(0),
});

export const SlotFindingInputSchema = z.object({
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  durationMinutes: z.number().int().positive(),
  preferredWindow: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional()
    .nullable(),
  preferences: z.record(z.unknown()).optional().default({}),
});

export const BypassMetricsRowSchema = z.object({
  id: z.string(),
  total_events: z.number().int().nonnegative(),
  bypass_count: z.number().int().nonnegative(),
  bypass_rate: z.string(),
  window_start: z.string(),
  window_end: z.string(),
});

export const BypassMetricsSummarySchema = z.object({
  id: z.string(),
  total_events: z.number().int().nonnegative(),
  bypass_count: z.number().int().nonnegative(),
  bypass_rate: z.string(),
});

export const EventRelationRowSchema = z.object({
  id: z.string(),
  parent_event_id: z.string(),
  child_event_id: z.string(),
  relation_type: z.string(),
});

export const CalendarEventRowSchema = z.object({
  id: z.string(),
  client_calendar_id: z.string(),
  provider_event_id: z.string(),
  title: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  source: z.string(),
  created_via: z.string().nullable(),
});

export const ClientCalendarRowSchema = z.object({
  id: z.string(),
  calendar_id: z.string(),
  provider: z.string(),
  oauth_state: z.record(z.unknown()),
});

export const BypassMetricsForAlertSchema = z.object({
  client_id: z.string(),
  bypass_rate: z.string(),
  total_events: z.number().int().nonnegative(),
  bypass_count: z.number().int().nonnegative(),
});

export const ClientRowSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const ConflictSignalRowSchema = z.object({
  payload: z.record(z.unknown()),
});

export const EventPreviewRowSchema = z.object({
  title: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  source: z.string(),
  client_id: z.string().nullable(),
});

export const WorkspaceRowSchema = z.object({
  timezone: z.string().optional().nullable(),
});
