import { describe, it, expect, beforeEach } from 'vitest';
import { getOAuthUrl } from '../gmail-oauth';

describe('gmail-oauth', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  });

  describe('getOAuthUrl', () => {
    it('generates a valid OAuth URL with PKCE', () => {
      const url = new URL(
        getOAuthUrl({
          redirectUri: 'http://localhost:3000/api/auth/gmail/callback',
          state: 'test-state',
          codeChallenge: 'test-challenge',
          accessType: 'direct',
        }),
      );

      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(url.searchParams.get('state')).toBe('test-state');
      expect(url.searchParams.get('code_challenge')).toBe('test-challenge');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('scope')).toContain('gmail.readonly');
      expect(url.searchParams.get('scope')).toContain('gmail.modify');
    });

    it('throws if GOOGLE_CLIENT_ID is missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      expect(() =>
        getOAuthUrl({
          redirectUri: 'http://localhost:3000/callback',
          state: 'state',
          codeChallenge: 'challenge',
          accessType: 'direct',
        }),
      ).toThrow(/GOOGLE_CLIENT_ID/);
    });
  });
});
