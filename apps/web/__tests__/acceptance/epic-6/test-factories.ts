import { faker } from '@faker-js/faker';

const FAKE_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const FAKE_CLIENT_ID = '00000000-0000-4000-8000-000000000002';
const FAKE_CALENDAR_ID = '00000000-0000-4000-8000-000000000003';
const FAKE_USER_ID = '00000000-0000-4000-8000-000000000004';

type CalendarSyncStatus = 'connected' | 'syncing' | 'error' | 'disconnected';
type CalendarAccessType = 'owner' | 'read_write' | 'read_only';
type CalendarProvider = 'google_calendar' | 'outlook';
type EventType =
  | 'meeting'
  | 'focus_block'
  | 'travel'
  | 'personal'
  | 'deadline'
  | 'unknown';
type EventSource =
  | 'va_created'
  | 'client_created'
  | 'third_party'
  | 'auto_generated'
  | 'unknown';

interface TestCalendar {
  id: string;
  workspace_id: string;
  client_id: string;
  provider: CalendarProvider;
  calendar_id: string;
  calendar_name: string;
  access_type: CalendarAccessType;
  oauth_state: Record<string, unknown>;
  sync_cursor: string | null;
  sync_status: CalendarSyncStatus;
  consecutive_refresh_failures: number;
  color_tag: string | null;
  email_address: string | null;
  is_primary: boolean;
  error_message: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TestCalendarEvent {
  id: string;
  workspace_id: string;
  client_calendar_id: string;
  client_id: string;
  provider_event_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  attendees: unknown[];
  event_type: EventType;
  source: EventSource;
  is_recurring: boolean;
  recurring_rule: string | null;
  created_via: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function createTestCalendar(
  overrides?: Partial<TestCalendar>,
): TestCalendar {
  return {
    id: faker.string.uuid(),
    workspace_id: FAKE_WORKSPACE_ID,
    client_id: FAKE_CLIENT_ID,
    provider: 'google_calendar' as const,
    calendar_id: faker.internet.email(),
    calendar_name: faker.company.name() + ' Calendar',
    access_type: 'read_only' as const,
    oauth_state: { encrypted: 'enc', iv: 'iv', version: 1 },
    sync_cursor: null,
    sync_status: 'connected' as const,
    consecutive_refresh_failures: 0,
    color_tag: null,
    email_address: faker.internet.email(),
    is_primary: true,
    error_message: null,
    last_sync_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestCalendarEvent(
  overrides?: Partial<TestCalendarEvent>,
): TestCalendarEvent {
  const startTime = faker.date.future();
  const endTime = new Date(startTime.getTime() + 3600_000);
  return {
    id: faker.string.uuid(),
    workspace_id: FAKE_WORKSPACE_ID,
    client_calendar_id: FAKE_CALENDAR_ID,
    client_id: FAKE_CLIENT_ID,
    provider_event_id: `evt-${faker.string.alphanumeric(16)}`,
    title: faker.lorem.sentence(3),
    description: faker.lorem.paragraph(),
    location: faker.location.streetAddress(),
    start_at: startTime.toISOString(),
    end_at: endTime.toISOString(),
    is_all_day: false,
    attendees: [
      { email: faker.internet.email(), name: faker.person.fullName() },
    ],
    event_type: 'meeting' as const,
    source: 'client_created' as const,
    is_recurring: false,
    recurring_rule: null,
    created_via: null,
    raw_data: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export { FAKE_WORKSPACE_ID, FAKE_CLIENT_ID, FAKE_CALENDAR_ID, FAKE_USER_ID };
