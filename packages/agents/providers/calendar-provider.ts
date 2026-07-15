import type { OAuthTokens } from '@flow/types';

export interface CalendarOAuthUrlParams {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  includeGrantedScopes?: boolean;
  additionalScopes?: string[];
}

export interface CalendarCodeExchangeResult {
  tokens: OAuthTokens;
  connectedEmail: string;
}

export interface CalendarEventAttendee {
  email: string;
  name?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}

export interface CalendarEvent {
  providerEventId: string;
  calendarId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location?: string;
  attendees: CalendarEventAttendee[];
  recurrenceRule?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface CalendarEventCreateInput {
  calendarId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  location?: string;
  attendees?: Array<{ email: string; name?: string }>;
  recurrenceRule?: string;
}

export interface CalendarEventUpdateInput {
  providerEventId: string;
  calendarId: string;
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
}

export interface CalendarListResult {
  calendars: Array<{
    calendarId: string;
    name: string;
    isPrimary: boolean;
    accessRole: string;
  }>;
}

export interface FreeBusySlot {
  calendarId: string;
  busy: Array<{ start: string; end: string }>;
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: Array<{
    eventId: string;
    title: string;
    startTime: string;
    endTime: string;
  }>;
}

export interface CalendarProvider {
  getOAuthUrl(params: CalendarOAuthUrlParams): string;
  exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<CalendarCodeExchangeResult>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;
  getConnectedEmail(accessToken: string): Promise<string>;

  listCalendars(accessToken: string): Promise<CalendarListResult>;
  listEvents(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
    maxResults?: number,
  ): Promise<CalendarEvent[]>;
  getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<CalendarEvent>;

  createEvent(
    accessToken: string,
    input: CalendarEventCreateInput,
  ): Promise<CalendarEvent>;
  updateEvent(
    accessToken: string,
    input: CalendarEventUpdateInput,
  ): Promise<CalendarEvent>;
  deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void>;

  getFreeBusy(
    accessToken: string,
    calendarIds: string[],
    timeMin: string,
    timeMax: string,
  ): Promise<FreeBusySlot[]>;

  detectConflicts(
    accessToken: string,
    calendarId: string,
    proposedStart: string,
    proposedEnd: string,
    excludeEventIds?: string[],
  ): Promise<ConflictDetectionResult>;

  watchChanges(
    accessToken: string,
    calendarId: string,
    topicName: string,
  ): Promise<{ channelId: string; expiration: string }>;
  stopWatch(accessToken: string, channelId: string): Promise<void>;
}

export type { OAuthTokens };
