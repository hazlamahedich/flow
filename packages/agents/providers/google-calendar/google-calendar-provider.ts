import type {
  CalendarProvider,
  CalendarOAuthUrlParams,
  CalendarCodeExchangeResult,
  OAuthTokens,
  CalendarListResult,
  CalendarEvent,
  CalendarEventCreateInput,
  CalendarEventUpdateInput,
  FreeBusySlot,
  ConflictDetectionResult,
} from '../calendar-provider.js';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { CodeChallengeMethod } from 'google-auth-library';

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
];

function createOAuth2Client(redirectUri: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw Object.assign(
      new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required'),
      { code: 'OAUTH_CONFIG_ERROR' as const, statusCode: 500 },
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return promise.finally(() => clearTimeout(timeout));
}

function createAuthedCalendar(accessToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error('Missing Google OAuth config');
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2 });
}

export class GoogleCalendarProvider implements CalendarProvider {
  getOAuthUrl(params: CalendarOAuthUrlParams): string {
    const client = createOAuth2Client(params.redirectUri);
    const mergedScopes = params.additionalScopes
      ? [...new Set([...CALENDAR_SCOPES, ...params.additionalScopes])]
      : CALENDAR_SCOPES;
    const urlOptions: Parameters<OAuth2Client['generateAuthUrl']>[0] = {
      access_type: 'offline',
      prompt: 'consent',
      scope: mergedScopes,
      state: params.state,
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: params.codeChallenge,
    };
    if (params.includeGrantedScopes) {
      urlOptions.include_granted_scopes = true;
    }
    return client.generateAuthUrl(urlOptions);
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<CalendarCodeExchangeResult> {
    const client = createOAuth2Client(redirectUri);
    const { tokens } = await withTimeout(
      client.getToken({ code, codeVerifier }),
      30_000,
    );
    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new Error('Incomplete token response from Google');
    }
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    return {
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        scope: tokens.scope ?? CALENDAR_SCOPES.join(' '),
        tokenType: 'Bearer',
      },
      connectedEmail: data.email ?? '',
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new Error('Missing Google OAuth config');
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2.refreshAccessToken();
    return {
      accessToken: credentials.access_token ?? '',
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiryDate: credentials.expiry_date ?? Date.now() + 3600_000,
      scope: credentials.scope ?? CALENDAR_SCOPES.join(' '),
      tokenType: 'Bearer',
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new Error('Missing Google OAuth config');
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    await oauth2.revokeToken(accessToken);
  }

  async getConnectedEmail(accessToken: string): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new Error('Missing Google OAuth config');
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ access_token: accessToken });
    const { data } = await google
      .oauth2({ version: 'v2', auth: oauth2 })
      .userinfo.get();
    return data.email ?? '';
  }

  async listCalendars(accessToken: string): Promise<CalendarListResult> {
    const calendar = createAuthedCalendar(accessToken);
    const res = await calendar.calendarList.list({});
    const calendars = (res.data.items ?? []).map((cal) => ({
      calendarId: cal.id ?? '',
      name: cal.summary ?? '',
      isPrimary: cal.primary ?? false,
      accessRole: cal.accessRole ?? 'reader',
    }));
    return { calendars };
  }

  async listEvents(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
    maxResults = 250,
  ): Promise<CalendarEvent[]> {
    const calendar = createAuthedCalendar(accessToken);
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return (res.data.items ?? []).map((ev) => this.mapEvent(ev, calendarId));
  }

  async getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<CalendarEvent> {
    const calendar = createAuthedCalendar(accessToken);
    const res = await calendar.events.get({ calendarId, eventId });
    return this.mapEvent(res.data, calendarId);
  }

  async createEvent(
    accessToken: string,
    input: CalendarEventCreateInput,
  ): Promise<CalendarEvent> {
    const calendar = createAuthedCalendar(accessToken);
    const requestBody: calendar_v3.Schema$Event = {
      summary: input.title,
      start: this.toGoogleTime(input.startTime, input.isAllDay),
      end: this.toGoogleTime(input.endTime, input.isAllDay),
    };
    if (input.description) requestBody.description = input.description;
    if (input.location) requestBody.location = input.location;
    if (input.attendees) {
      requestBody.attendees = input.attendees.map(
        (a): calendar_v3.Schema$EventAttendee => {
          const mapped: calendar_v3.Schema$EventAttendee = { email: a.email };
          if (a.name) mapped.displayName = a.name;
          return mapped;
        },
      );
    }
    if (input.recurrenceRule) requestBody.recurrence = [input.recurrenceRule];
    const res = await calendar.events.insert({
      calendarId: input.calendarId,
      requestBody,
    });
    return this.mapEvent(res.data, input.calendarId);
  }

  async updateEvent(
    accessToken: string,
    input: CalendarEventUpdateInput,
  ): Promise<CalendarEvent> {
    const calendar = createAuthedCalendar(accessToken);
    const existingRes = await calendar.events.get({
      calendarId: input.calendarId,
      eventId: input.providerEventId,
    });
    const existing = existingRes.data;
    const requestBody: calendar_v3.Schema$Event = {
      ...existing,
      summary: input.title ?? existing.summary ?? '',
      start: input.startTime
        ? this.toGoogleTime(input.startTime)
        : (existing.start ?? this.toGoogleTime(new Date().toISOString())),
      end: input.endTime
        ? this.toGoogleTime(input.endTime)
        : (existing.end ?? this.toGoogleTime(new Date().toISOString())),
    };
    if (input.description !== undefined)
      requestBody.description = input.description;
    else if (existing.description)
      requestBody.description = existing.description;
    if (input.location !== undefined) requestBody.location = input.location;
    else if (existing.location) requestBody.location = existing.location;
    const res = await calendar.events.update({
      calendarId: input.calendarId,
      eventId: input.providerEventId,
      requestBody,
    });
    return this.mapEvent(res.data, input.calendarId);
  }

  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    const calendar = createAuthedCalendar(accessToken);
    await calendar.events.delete({ calendarId, eventId });
  }

  async getFreeBusy(
    accessToken: string,
    calendarIds: string[],
    timeMin: string,
    timeMax: string,
  ): Promise<FreeBusySlot[]> {
    const calendar = createAuthedCalendar(accessToken);
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: calendarIds.map((id) => ({ id })),
      },
    });
    return Object.entries(res.data.calendars ?? {}).map(([calId, info]) => ({
      calendarId: calId,
      busy: (info.busy ?? []).map((b) => ({
        start: b.start ?? '',
        end: b.end ?? '',
      })),
    }));
  }

  async detectConflicts(
    accessToken: string,
    calendarId: string,
    proposedStart: string,
    proposedEnd: string,
    excludeEventIds: string[] = [],
  ): Promise<ConflictDetectionResult> {
    const events = await this.listEvents(
      accessToken,
      calendarId,
      proposedStart,
      proposedEnd,
    );
    const conflicts = events
      .filter((ev) => !excludeEventIds.includes(ev.providerEventId))
      .filter((ev) => ev.startTime < proposedEnd && ev.endTime > proposedStart)
      .map((ev) => ({
        eventId: ev.providerEventId,
        title: ev.title,
        startTime: ev.startTime,
        endTime: ev.endTime,
      }));
    return { hasConflicts: conflicts.length > 0, conflicts };
  }

  async watchChanges(
    accessToken: string,
    calendarId: string,
    topicName: string,
  ): Promise<{ channelId: string; expiration: string }> {
    const calendar = createAuthedCalendar(accessToken);
    const res = await calendar.events.watch({
      calendarId,
      requestBody: {
        id: `cal-watch-${calendarId.slice(0, 8)}`,
        type: 'web_hook',
        address: topicName,
      },
    });
    return {
      channelId: res.data.id ?? '',
      expiration:
        res.data.expiration ??
        new Date(Date.now() + 7 * 86400_000).toISOString(),
    };
  }

  async stopWatch(accessToken: string, channelId: string): Promise<void> {
    const calendar = createAuthedCalendar(accessToken);
    await calendar.channels.stop({
      requestBody: { id: channelId, resourceId: channelId },
    });
  }

  private mapEvent(
    ev: calendar_v3.Schema$Event,
    calendarId: string,
  ): CalendarEvent {
    const isAllDay = !!ev.start?.date;
    const rawAttendees = ev.attendees;
    const attendees: CalendarEvent['attendees'] = (rawAttendees ?? []).map(
      (a) => {
        const mapped: CalendarEvent['attendees'][number] = {
          email: a.email ?? '',
        };
        if (a.displayName) mapped.name = a.displayName;
        if (
          a.responseStatus === 'needsAction' ||
          a.responseStatus === 'declined' ||
          a.responseStatus === 'tentative' ||
          a.responseStatus === 'accepted'
        ) {
          mapped.responseStatus = a.responseStatus;
        }
        return mapped;
      },
    );
    const rawRecurrence = ev.recurrence;
    const result: CalendarEvent = {
      providerEventId: ev.id ?? '',
      calendarId,
      title: ev.summary ?? '',
      startTime: ev.start?.dateTime ?? ev.start?.date ?? '',
      endTime: ev.end?.dateTime ?? ev.end?.date ?? '',
      isAllDay,
      attendees,
      providerMetadata: { etag: ev.etag, htmlLink: ev.htmlLink },
    };
    if (ev.description) result.description = ev.description;
    if (ev.location) result.location = ev.location;
    if (rawRecurrence?.[0]) result.recurrenceRule = rawRecurrence[0];
    return result;
  }

  private toGoogleTime(iso: string, isAllDay?: boolean) {
    if (isAllDay) {
      const d = iso.slice(0, 10);
      return { date: d };
    }
    return { dateTime: iso };
  }
}
