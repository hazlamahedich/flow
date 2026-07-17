import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockGenerateAuthUrl,
  mockGetToken,
  mockSetCredentials,
  mockUserinfoGet,
} = vi.hoisted(() => ({
  mockGenerateAuthUrl: vi.fn(),
  mockGetToken: vi.fn(),
  mockSetCredentials: vi.fn(),
  mockUserinfoGet: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        setCredentials: mockSetCredentials,
      })),
    },
    oauth2: vi.fn().mockReturnValue({
      userinfo: {
        get: mockUserinfoGet,
      },
    }),
  },
}));

import { GoogleCalendarProvider } from '../google-calendar-provider';

describe('GoogleCalendarProvider', () => {
  let provider: GoogleCalendarProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    provider = new GoogleCalendarProvider();
  });

  describe('getOAuthUrl', () => {
    it('returns valid URL with calendar scopes', () => {
      mockGenerateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/calendar.readonly%20https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent',
      );

      const url = provider.getOAuthUrl({
        redirectUri: 'http://localhost:3000/api/auth/calendar/callback',
        state: 'test-state',
        codeChallenge: 'test-challenge',
      });

      expect(url).toContain('accounts.google.com');
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          prompt: 'consent',
          scope: expect.arrayContaining([
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events',
          ]),
          state: 'test-state',
          code_challenge_method: 'S256',
          code_challenge: 'test-challenge',
        }),
      );
    });

    it('includes include_granted_scopes when includeGrantedScopes=true', () => {
      mockGenerateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?',
      );

      provider.getOAuthUrl({
        redirectUri: 'http://localhost:3000/api/auth/calendar/callback',
        state: 'test-state',
        codeChallenge: 'test-challenge',
        includeGrantedScopes: true,
      });

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          include_granted_scopes: true,
        }),
      );
    });

    it('does not include include_granted_scopes by default', () => {
      mockGenerateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?',
      );

      provider.getOAuthUrl({
        redirectUri: 'http://localhost:3000/api/auth/calendar/callback',
        state: 'test-state',
        codeChallenge: 'test-challenge',
      });

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.not.objectContaining({
          include_granted_scopes: expect.anything(),
        }),
      );
    });

    it('merges additionalScopes and deduplicates', () => {
      mockGenerateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?',
      );

      provider.getOAuthUrl({
        redirectUri: 'http://localhost:3000/api/auth/calendar/callback',
        state: 'test-state',
        codeChallenge: 'test-challenge',
        additionalScopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/calendar.readonly',
        ],
      });

      const callArg = mockGenerateAuthUrl.mock.calls[0][0] as {
        scope: string[];
      };
      const scopes = callArg.scope as string[];
      expect(scopes).toContain(
        'https://www.googleapis.com/auth/gmail.readonly',
      );
      const calendarReadonlyCount = scopes.filter(
        (s: string) =>
          s === 'https://www.googleapis.com/auth/calendar.readonly',
      ).length;
      expect(calendarReadonlyCount).toBe(1);
    });
  });

  describe('exchangeCode', () => {
    it('returns CalendarCodeExchangeResult with connectedEmail', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expiry_date: Date.now() + 3600000,
          token_type: 'Bearer',
        },
      });
      mockUserinfoGet.mockResolvedValue({
        data: { email: 'user@example.com' },
      });

      const result = await provider.exchangeCode(
        'auth-code',
        'http://localhost:3000/api/auth/calendar/callback',
        'test-verifier',
      );

      expect(result.connectedEmail).toBe('user@example.com');
      expect(result.tokens.accessToken).toBe('access-123');
      expect(result.tokens.refreshToken).toBe('refresh-456');
      expect(mockSetCredentials).toHaveBeenCalled();
    });

    it('throws when token response is incomplete', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'access-123',
        },
      });

      await expect(
        provider.exchangeCode(
          'code',
          'http://localhost:3000/callback',
          'verifier',
        ),
      ).rejects.toThrow();
    });
  });
});
