import { z } from 'zod';

export const calendarAccessTypeEnum = z.enum([
  'owner',
  'read_write',
  'read_only',
]);
export type CalendarAccessType = z.infer<typeof calendarAccessTypeEnum>;

export const calendarProviderEnum = z.enum(['google_calendar', 'outlook']);
export type CalendarProviderName = z.infer<typeof calendarProviderEnum>;

export const calendarSyncStatusEnum = z.enum([
  'connected',
  'syncing',
  'error',
  'disconnected',
]);
export type CalendarSyncStatus = z.infer<typeof calendarSyncStatusEnum>;

export const calendarEventTypeEnum = z.enum([
  'meeting',
  'focus_block',
  'travel',
  'personal',
  'deadline',
  'unknown',
]);
export type CalendarEventType = z.infer<typeof calendarEventTypeEnum>;

export const calendarEventSourceEnum = z.enum([
  'va_created',
  'client_created',
  'third_party',
  'auto_generated',
  'unknown',
]);
export type CalendarEventSource = z.infer<typeof calendarEventSourceEnum>;

export const connectCalendarInputSchema = z.object({
  clientId: z.string().uuid().optional(),
  accessType: calendarAccessTypeEnum,
  returnTo: z.string().optional(),
});
export type ConnectCalendarInput = z.infer<typeof connectCalendarInputSchema>;

export const calendarOAuthStateCookieSchema = z.object({
  state: z.string(),
  codeVerifier: z.string(),
  clientId: z.string().nullable(),
  accessType: calendarAccessTypeEnum,
  workspaceId: z.string().uuid(),
  returnTo: z.string(),
});
export type CalendarOAuthStateCookie = z.infer<
  typeof calendarOAuthStateCookieSchema
>;

export const clientCalendarSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid().nullable(),
  provider: calendarProviderEnum,
  calendarId: z.string(),
  calendarName: z.string(),
  emailAddress: z.string().nullable(),
  accessType: calendarAccessTypeEnum,
  syncStatus: calendarSyncStatusEnum,
  syncCursor: z.string().nullable(),
  errorMessage: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  isPrimary: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ClientCalendar = z.infer<typeof clientCalendarSchema>;

export const calendarEventSchema = z.object({
  id: z.string().uuid(),
  clientCalendarId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  providerEventId: z.string(),
  eventType: calendarEventTypeEnum,
  source: calendarEventSourceEnum,
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  isAllDay: z.boolean(),
  location: z.string().nullable(),
  attendees: z.array(
    z.object({
      email: z.string(),
      name: z.string().optional(),
      responseStatus: z
        .enum(['needsAction', 'declined', 'tentative', 'accepted'])
        .optional(),
    }),
  ),
  recurrenceRule: z.string().nullable(),
  providerMetadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
