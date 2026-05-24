import type { SupabaseClient } from '@supabase/supabase-js';

export type EventSource = 'va_created' | 'client_created' | 'third_party' | 'auto_generated';

interface CalendarEventInput {
  organizerEmail?: string | null;
  title: string;
  isRecurring: boolean;
  createdVia?: string | null;
  source?: string | null;
}

interface CalendarInfo {
  emailAddress: string | null;
}

const THIRD_PARTY_DOMAINS = [
  'calendly.com', 'acuityscheduling.com', 'zoom.us',
  'scheduleonce.com', 'youcanbook.me', 'doodle.com',
  'harmonizely.com', 'cal.com',
];

const HOLIDAY_PATTERNS = [
  /\bholiday\b/i, /\booo\b/i, /\bout of office\b/i,
  /\bvacation\b/i, /\btime off\b/i, /\bbleeding day\b/i,
  /\bbank holiday\b/i, /\bpublic holiday\b/i,
];

export function classifyEventSource(
  event: CalendarEventInput,
  calendars: CalendarInfo[],
  vaEmail: string,
): EventSource {
  if (event.createdVia === 'flow_os' || event.createdVia?.startsWith('agent:')) {
    return 'va_created';
  }

  if (event.source && event.source !== 'unknown') {
    return event.source as EventSource;
  }

  const organizerEmail = (event.organizerEmail ?? '').toLowerCase();
  const vaEmailLower = vaEmail.toLowerCase();

  if (organizerEmail === vaEmailLower) {
    return 'va_created';
  }

  if (organizerEmail) {
    const domain = organizerEmail.split('@')[1] ?? '';
    if (THIRD_PARTY_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return 'third_party';
    }

    const isClientCalendar = calendars.some(
      (cal) => cal.emailAddress?.toLowerCase() === organizerEmail,
    );
    if (isClientCalendar) {
      return 'client_created';
    }
  }

  if (event.isRecurring && HOLIDAY_PATTERNS.some((p) => p.test(event.title))) {
    return 'auto_generated';
  }

  return 'client_created';
}

export async function classifyAndUpdateEvent(
  supabase: SupabaseClient,
  eventId: string,
  workspaceId: string,
  calendars: CalendarInfo[],
  vaEmail: string,
  event: CalendarEventInput,
): Promise<EventSource> {
  const source = classifyEventSource(event, calendars, vaEmail);

  const { error } = await supabase
    .from('calendar_events')
    .update({ source })
    .eq('id', eventId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw Object.assign(
      new Error(`Failed to update event source: ${error.message}`),
      { code: 'SOURCE_UPDATE_FAILED' as const, statusCode: 500 },
    );
  }

  return source;
}
