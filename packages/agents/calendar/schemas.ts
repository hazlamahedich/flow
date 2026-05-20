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
  requestType: z.enum(['book_new', 'reschedule', 'cancel', 'check_availability']),
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
  preferredWindow: z.object({
    start: z.string(),
    end: z.string(),
  }).optional().nullable(),
  preferences: z.record(z.unknown()).optional().default({}),
});
