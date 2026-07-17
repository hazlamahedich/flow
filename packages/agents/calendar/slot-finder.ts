import type { SupabaseClient } from '@supabase/supabase-js';
import type { OAuthStateEncrypted } from '@flow/types';
import type { CalendarProvider } from '../providers/calendar-provider.js';
import type { AvailableSlot } from './types.js';

import { DEFAULT_CALENDAR_CONFIG } from './config.js';
import { withTimeout } from './provider-utils.js';

export interface SlotFinderParams {
  workspaceId: string;
  clientId: string;
  durationMinutes: number;
  preferredWindow?: { start: string; end: string } | null;
  preferences?: Record<string, unknown>;
  calendars: Array<{
    id: string;
    calendarId: string;
    provider: CalendarProvider;
    accessToken: string;
  }>;
}

export interface SlotFinderDeps {
  supabase: SupabaseClient;
}

interface CalendarRow {
  id: string;
  client_id: string | null;
  calendar_id: string;
  provider: string;
  oauth_state: Record<string, unknown>;
  sync_status: string;
}

const PROVIDER_TIMEOUT_MS = 30_000;
const MAX_SLOTS = 3;
const SEARCH_DAYS = 14;

function isWithinWorkingHours(
  start: Date,
  end: Date,
  timezone?: string,
): boolean {
  const day = start.getDay();
  if (day === 0 || day === 6) return false;
  const workingStart = DEFAULT_CALENDAR_CONFIG.workingHours.start;
  const workingEnd = DEFAULT_CALENDAR_CONFIG.workingHours.end;
  const [wsH, wsM] = workingStart.split(':').map(Number);
  const [weH, weM] = workingEnd.split(':').map(Number);
  if (timezone && timezone !== 'UTC') {
    const fmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      timeZone: timezone,
    });
    const startParts = fmt.formatToParts(start);
    const endParts = fmt.formatToParts(end);
    const startHour = Number(
      startParts.find((p) => p.type === 'hour')?.value ?? 0,
    );
    const startMin = Number(
      startParts.find((p) => p.type === 'minute')?.value ?? 0,
    );
    const endHour = Number(endParts.find((p) => p.type === 'hour')?.value ?? 0);
    const endMin = Number(
      endParts.find((p) => p.type === 'minute')?.value ?? 0,
    );
    const tzDay = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: timezone,
    }).format(start);
    if (tzDay === 'Sat' || tzDay === 'Sun') return false;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return startMinutes >= wsH! * 60 + wsM! && endMinutes <= weH! * 60 + weM!;
  }
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  return startMinutes >= wsH! * 60 + wsM! && endMinutes <= weH! * 60 + weM!;
}

async function loadCalendars(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<CalendarRow[]> {
  const { data, error } = await supabase
    .from('client_calendars')
    .select('id, client_id, calendar_id, provider, oauth_state, sync_status')
    .eq('workspace_id', workspaceId)
    .eq('sync_status', 'connected');

  if (error) return [];
  return (data ?? []) as CalendarRow[];
}

export async function findAvailableSlots(
  params: SlotFinderParams,
  deps: SlotFinderDeps,
): Promise<AvailableSlot[]> {
  const {
    workspaceId,
    durationMinutes,
    preferredWindow,
    preferences,
    calendars,
  } = params;
  const { supabase } = deps;

  const connectedCalendars =
    calendars.length > 0
      ? calendars
      : await loadCalendarProviders(supabase, workspaceId);

  if (connectedCalendars.length === 0) return [];

  const now = new Date();
  const searchEnd = new Date(now);
  searchEnd.setDate(searchEnd.getDate() + SEARCH_DAYS);

  const rawTimeMin = preferredWindow?.start ?? now.toISOString();
  const timeMin = new Date(rawTimeMin) < now ? now.toISOString() : rawTimeMin;
  const timeMax = preferredWindow?.end ?? searchEnd.toISOString();

  const tz = (preferences?.timezone as string | undefined) ?? undefined;
  const bufferMinutes =
    (preferences?.bufferMinutes as number | undefined) ??
    DEFAULT_CALENDAR_CONFIG.bufferMinutes;

  const freeBusyResults = await Promise.allSettled(
    connectedCalendars.map(async (cal) => {
      const busySlots = await withTimeout(
        cal.provider.getFreeBusy(
          cal.accessToken,
          [cal.calendarId],
          timeMin,
          timeMax,
        ),
        PROVIDER_TIMEOUT_MS,
      );
      return {
        calendarId: cal.calendarId,
        busy: busySlots.flatMap((s) => s.busy ?? []),
      };
    }),
  );

  const allBusy: Array<{ start: string; end: string; calendarId: string }> = [];
  for (const result of freeBusyResults) {
    if (result.status === 'fulfilled') {
      for (const slot of result.value.busy) {
        allBusy.push({
          start: slot.start,
          end: slot.end,
          calendarId: result.value.calendarId,
        });
      }
    }
  }

  const { data: existingEvents } = await supabase
    .from('calendar_events')
    .select('start_at, end_at')
    .eq('workspace_id', workspaceId)
    .gte('end_at', timeMin)
    .lte('start_at', timeMax);

  const dbEvents = (existingEvents ?? []) as Array<{
    start_at: string;
    end_at: string;
  }>;

  const candidates: AvailableSlot[] = [];
  const bufferMs = bufferMinutes * 60_000;
  const durationMs = durationMinutes * 60_000;
  const slotStepMs = 30 * 60_000;

  let cursor = new Date(timeMin);
  const endDate = new Date(timeMax);

  while (cursor < endDate && candidates.length < MAX_SLOTS * 3) {
    const slotEnd = new Date(cursor.getTime() + durationMs);

    if (!isWithinWorkingHours(cursor, slotEnd, tz)) {
      cursor = new Date(cursor.getTime() + slotStepMs);
      continue;
    }

    const bufferedStart = new Date(cursor.getTime() - bufferMs);
    const bufferedEnd = new Date(slotEnd.getTime() + bufferMs);

    const hasProviderConflict = allBusy.some((busy) => {
      const busyStart = new Date(busy.start).getTime();
      const busyEnd = new Date(busy.end).getTime();
      return (
        bufferedStart.getTime() < busyEnd && bufferedEnd.getTime() > busyStart
      );
    });

    if (!hasProviderConflict) {
      const hasDbConflict = dbEvents.some((evt) => {
        const evtStart = new Date(evt.start_at).getTime();
        const evtEnd = new Date(evt.end_at).getTime();
        return (
          bufferedStart.getTime() < evtEnd && bufferedEnd.getTime() > evtStart
        );
      });

      if (!hasDbConflict) {
        const firstFreeCalendar =
          connectedCalendars.find(
            (cal) =>
              !allBusy.some(
                (b) =>
                  b.calendarId === cal.calendarId &&
                  new Date(b.start).getTime() < bufferedEnd.getTime() &&
                  new Date(b.end).getTime() > bufferedStart.getTime(),
              ),
          ) ?? connectedCalendars[0];

        candidates.push({
          startAt: cursor.toISOString(),
          endAt: slotEnd.toISOString(),
          conflicts: 0,
          calendarId: firstFreeCalendar!.calendarId,
          reasoning: `Available slot within working hours`,
        });
      }
    }

    cursor = new Date(cursor.getTime() + slotStepMs);
  }

  candidates.sort((a, b) => {
    const timeDiff =
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.conflicts - b.conflicts;
  });

  return candidates.slice(0, MAX_SLOTS);
}

async function loadCalendarProviders(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<
  Array<{
    id: string;
    calendarId: string;
    provider: CalendarProvider;
    accessToken: string;
  }>
> {
  const rows = await loadCalendars(supabase, workspaceId);
  const results: Array<{
    id: string;
    calendarId: string;
    provider: CalendarProvider;
    accessToken: string;
  }> = [];

  for (const row of rows) {
    try {
      const { getCalendarProvider } = await import('../providers/registry.js');
      const { CalendarTokenManager } =
        await import('../providers/google-calendar/token-manager.js');
      const provider = getCalendarProvider(row.provider);
      const tokenManager = new CalendarTokenManager(provider);
      const { tokens } = await tokenManager.getValidTokens(
        row.id,
        row.oauth_state as unknown as OAuthStateEncrypted,
      );
      results.push({
        id: row.id,
        calendarId: row.calendar_id,
        provider,
        accessToken: tokens.accessToken,
      });
    } catch {
      continue;
    }
  }

  return results;
}
