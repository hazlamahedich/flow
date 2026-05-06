import { describe, it, expect } from 'vitest';
import {
  inboxAccessTypeEnum,
  syncStatusEnum,
  oauthTokensSchema,
  connectInboxInputSchema,
  gmailPubSubMessageSchema,
} from '../inbox';

describe('inbox types and schemas', () => {
  describe('inboxAccessTypeEnum', () => {
    it('accepts valid access types', () => {
      expect(inboxAccessTypeEnum.parse('direct')).toBe('direct');
      expect(inboxAccessTypeEnum.parse('delegated')).toBe('delegated');
      expect(inboxAccessTypeEnum.parse('service_account')).toBe('service_account');
    });

    it('rejects invalid access type', () => {
      expect(() => inboxAccessTypeEnum.parse('invalid')).toThrow();
    });
  });

  describe('syncStatusEnum', () => {
    it('accepts valid sync statuses', () => {
      for (const status of ['connected', 'syncing', 'error', 'disconnected'] as const) {
        expect(syncStatusEnum.parse(status)).toBe(status);
      }
    });

    it('rejects invalid status', () => {
      expect(() => syncStatusEnum.parse('pending')).toThrow();
    });
  });

  describe('oauthTokensSchema', () => {
    it('parses valid tokens', () => {
      const result = oauthTokensSchema.parse({
        accessToken: 'ya29.token',
        refreshToken: '1//refresh',
        expiryDate: 1234567890,
        scope: 'openid',
        tokenType: 'Bearer',
      });
      expect(result.accessToken).toBe('ya29.token');
    });

    it('applies default tokenType', () => {
      const result = oauthTokensSchema.parse({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiryDate: 0,
        scope: 'openid',
      });
      expect(result.tokenType).toBe('Bearer');
    });

    it('rejects missing required fields', () => {
      expect(() => oauthTokensSchema.parse({ accessToken: 'token' })).toThrow();
    });
  });

  describe('connectInboxInputSchema', () => {
    it('accepts valid direct input', () => {
      const result = connectInboxInputSchema.parse({
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        accessType: 'direct',
      });
      expect(result.accessType).toBe('direct');
    });

    it('accepts delegated with returnTo', () => {
      const result = connectInboxInputSchema.parse({
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        accessType: 'delegated',
        returnTo: '/clients/123',
      });
      expect(result.returnTo).toBe('/clients/123');
    });

    it('rejects service_account', () => {
      expect(() =>
        connectInboxInputSchema.parse({
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          accessType: 'service_account',
        }),
      ).toThrow();
    });
  });

  describe('gmailPubSubMessageSchema', () => {
    it('parses valid message', () => {
      const result = gmailPubSubMessageSchema.parse({
        emailAddress: 'test@gmail.com',
        historyId: '12345',
      });
      expect(result.emailAddress).toBe('test@gmail.com');
    });

    it('rejects invalid email', () => {
      expect(() =>
        gmailPubSubMessageSchema.parse({ emailAddress: 'not-email', historyId: '1' }),
      ).toThrow();
    });
  });
});
