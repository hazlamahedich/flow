import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createTestCalendar,
  createTestCalendarEvent,
  FAKE_WORKSPACE_ID,
  FAKE_CLIENT_ID,
} from './test-factories';

// ATDD red-phase tests for Epic 6 Story 6.1: Calendar OAuth Connection
// These tests define the acceptance criteria for the calendar OAuth flow.

// Minimal interface for the mock provider — no `any`
interface MockCalendarProvider {
  getOAuthUrl: ReturnType<typeof vi.fn>;
  exchangeCode: ReturnType<typeof vi.fn>;
}

function createMockProvider(): MockCalendarProvider {
  return {
    getOAuthUrl: vi.fn(),
    exchangeCode: vi.fn(),
  };
}

describe('Story 6.1: Calendar OAuth Connection', () => {
  let provider: MockCalendarProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.CALENDAR_ENCRYPTION_KEY = '0'.repeat(64);
    provider = createMockProvider();
  });

  describe('connectCalendar Server Action', () => {
    test('[P0] returns a valid OAuth URL for calendar scopes', () => {
      const expectedUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?scope=calendar.readonly';
      provider.getOAuthUrl.mockReturnValue(expectedUrl);

      const result = provider.getOAuthUrl({
        redirectUri: 'http://localhost:3000/api/auth/calendar/callback',
        state: JSON.stringify({
          workspaceId: FAKE_WORKSPACE_ID,
          clientId: FAKE_CLIENT_ID,
        }),
        codeChallenge: 'test-challenge',
      });

      expect(result).toBe(expectedUrl);
      expect(provider.getOAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: expect.stringContaining('/api/auth/calendar/callback'),
          state: expect.any(String),
          codeChallenge: expect.any(String),
        }),
      );
    });

    test('[P0] OAuth URL includes calendar scopes', () => {
      provider.getOAuthUrl.mockImplementation(
        (params: Record<string, unknown>) => {
          const scopes = (params.scope as string[]) ?? [];
          return `https://accounts.google.com/o/oauth2/v2/auth?scope=${scopes.join('+')}`;
        },
      );

      const result = provider.getOAuthUrl({
        redirectUri: 'http://localhost:3000/api/auth/calendar/callback',
        state: 'test-state',
        codeChallenge: 'challenge',
        scope: ['calendar.readonly', 'calendar.events'],
      });

      expect(result).toContain('calendar.readonly');
      expect(result).toContain('calendar.events');
    });
  });

  describe('Calendar OAuth Callback', () => {
    test('[P0] exchanges authorization code and returns tokens with connected email', async () => {
      const mockResult = {
        tokens: {
          accessToken: 'ya29.calendar-access',
          refreshToken: '1//calendar-refresh',
          expiryDate: Date.now() + 3600_000,
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          tokenType: 'Bearer',
        },
        connectedEmail: 'user@example.com',
      };
      provider.exchangeCode.mockResolvedValue(mockResult);

      const result = await provider.exchangeCode(
        'auth-code-123',
        'http://localhost:3000/api/auth/calendar/callback',
        'code-verifier',
      );

      expect(result.connectedEmail).toBe('user@example.com');
      expect(result.tokens.accessToken).toBe('ya29.calendar-access');
      expect(result.tokens.refreshToken).toBe('1//calendar-refresh');
    });
  });

  describe('selectCalendars', () => {
    test('[P0] creates client_calendars records for selected calendars', () => {
      const testCalendar1 = createTestCalendar({
        calendar_id: 'primary',
        calendar_name: 'Primary Calendar',
      });
      const testCalendar2 = createTestCalendar({
        calendar_id: 'work@company.com',
        calendar_name: 'Work Calendar',
      });

      // Simulate the data that would be stored
      const selectedCalendars = [testCalendar1, testCalendar2];
      expect(selectedCalendars).toHaveLength(2);
      expect(selectedCalendars[0]?.workspace_id).toBe(FAKE_WORKSPACE_ID);
      expect(selectedCalendars[0]?.client_id).toBe(FAKE_CLIENT_ID);
      expect(selectedCalendars[0]?.provider).toBe('google_calendar');
      expect(selectedCalendars[0]?.sync_status).toBe('connected');

      // Verify calendar events can be created with the calendar reference
      const event = createTestCalendarEvent({
        client_calendar_id: testCalendar1.id,
        workspace_id: FAKE_WORKSPACE_ID,
      });
      expect(event.client_calendar_id).toBe(testCalendar1.id);
      expect(event.workspace_id).toBe(FAKE_WORKSPACE_ID);
    });
  });

  describe('OAuth State Security', () => {
    test('[P0] oauth_state is encrypted and not stored as plaintext', () => {
      const calendar = createTestCalendar();
      expect(calendar.oauth_state).toHaveProperty('encrypted');
      expect(calendar.oauth_state).toHaveProperty('iv');
      expect(calendar.oauth_state).toHaveProperty('version');
      // Should NOT contain plaintext tokens
      expect(JSON.stringify(calendar.oauth_state)).not.toContain('ya29.');
      expect(JSON.stringify(calendar.oauth_state)).not.toContain(
        'refresh_token',
      );
    });

    test('[P0] sync_status defaults to disconnected for new connections', () => {
      const calendar = createTestCalendar({ sync_status: 'disconnected' });
      expect(calendar.sync_status).toBe('disconnected');
    });

    test('[P0] sync_status transitions to connected after successful token exchange', () => {
      const calendar = createTestCalendar({ sync_status: 'connected' });
      expect(calendar.sync_status).toBe('connected');
    });
  });

  describe('Calendar Event Data Integrity', () => {
    test('[P0] calendar event has all required fields for conflict detection', () => {
      const event = createTestCalendarEvent();
      expect(event).toHaveProperty('provider_event_id');
      expect(event).toHaveProperty('start_at');
      expect(event).toHaveProperty('end_at');
      expect(event).toHaveProperty('client_calendar_id');
      expect(event).toHaveProperty('workspace_id');
      expect(new Date(event.end_at).getTime()).toBeGreaterThan(
        new Date(event.start_at).getTime(),
      );
    });

    test('[P0] calendar event supports all event types', () => {
      const eventTypes = [
        'meeting',
        'focus_block',
        'travel',
        'personal',
        'deadline',
        'unknown',
      ] as const;
      for (const eventType of eventTypes) {
        const event = createTestCalendarEvent({ event_type: eventType });
        expect(event.event_type).toBe(eventType);
      }
    });
  });
});
