import { describe, it, expect, beforeEach } from 'vitest';
import { encryptInboxTokens, decryptInboxTokens, rotateInboxTokens } from '../inbox-tokens';
import type { OAuthTokens } from '@flow/types';

const mockTokens: OAuthTokens = {
  accessToken: 'ya29.test-access-token',
  refreshToken: '1//test-refresh-token',
  expiryDate: Date.now() + 3600_000,
  scope: 'https://www.googleapis.com/auth/gmail.readonly',
  tokenType: 'Bearer',
};

describe('inbox-tokens vault', () => {
  beforeEach(() => {
    process.env.GMAIL_ENCRYPTION_KEY = '0'.repeat(64);
  });

  describe('encryptInboxTokens', () => {
    it('encrypts tokens and returns encrypted state', () => {
      const result = encryptInboxTokens(mockTokens);

      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('version', 1);
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
    });

    it('produces different ciphertext for same input (random IV)', () => {
      const a = encryptInboxTokens(mockTokens);
      const b = encryptInboxTokens(mockTokens);
      expect(a.encrypted).not.toBe(b.encrypted);
      expect(a.iv).not.toBe(b.iv);
    });
  });

  describe('decryptInboxTokens', () => {
    it('round-trips encryption', () => {
      const encrypted = encryptInboxTokens(mockTokens);
      const decrypted = decryptInboxTokens(encrypted);
      expect(decrypted).toEqual(mockTokens);
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = encryptInboxTokens(mockTokens);
      const tampered = {
        ...encrypted,
        encrypted: 'A'.repeat(encrypted.encrypted.length),
      };
      expect(() => decryptInboxTokens(tampered)).toThrow(/decryption failed|tampered/i);
    });

    it('throws on wrong key', () => {
      const encrypted = encryptInboxTokens(mockTokens);
      process.env.GMAIL_ENCRYPTION_KEY = 'F'.repeat(64);
      expect(() => decryptInboxTokens(encrypted)).toThrow();
    });

    it('throws on truncated ciphertext', () => {
      expect(() =>
        decryptInboxTokens({ encrypted: Buffer.from('short').toString('base64'), iv: Buffer.alloc(12).toString('base64'), version: 1 }),
      ).toThrow();
    });
  });

  describe('rotateInboxTokens', () => {
    it('replaces old tokens with new ones', () => {
      const encrypted = encryptInboxTokens(mockTokens);
      const newTokens: OAuthTokens = { ...mockTokens, accessToken: 'ya29.new-token' };
      const rotated = rotateInboxTokens(encrypted, newTokens);
      const decrypted = decryptInboxTokens(rotated);
      expect(decrypted.accessToken).toBe('ya29.new-token');
    });
  });

  describe('env validation', () => {
    it('throws if GMAIL_ENCRYPTION_KEY is missing', () => {
      delete process.env.GMAIL_ENCRYPTION_KEY;
      expect(() => encryptInboxTokens(mockTokens)).toThrow(/GMAIL_ENCRYPTION_KEY/);
    });

    it('throws if key is wrong length', () => {
      process.env.GMAIL_ENCRYPTION_KEY = 'abc123';
      expect(() => encryptInboxTokens(mockTokens)).toThrow(/64 hex/);
    });
  });
});
