import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptCalendarTokens,
  decryptCalendarTokens,
  rotateCalendarTokens,
} from '../calendar-tokens';
import type { OAuthTokens } from '@flow/types';

const mockTokens: OAuthTokens = {
  accessToken: 'ya29.test-calendar-access-token',
  refreshToken: '1//test-calendar-refresh-token',
  expiryDate: Date.now() + 3600_000,
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
  tokenType: 'Bearer',
};

describe('calendar-tokens vault', () => {
  beforeEach(() => {
    process.env.CALENDAR_ENCRYPTION_KEY = '0'.repeat(64);
  });

  describe('encryptCalendarTokens', () => {
    it('encrypts tokens and returns encrypted state', () => {
      const result = encryptCalendarTokens(mockTokens);

      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('version', 1);
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
    });

    it('produces different ciphertext for same input (random IV)', () => {
      const a = encryptCalendarTokens(mockTokens);
      const b = encryptCalendarTokens(mockTokens);
      expect(a.encrypted).not.toBe(b.encrypted);
      expect(a.iv).not.toBe(b.iv);
    });
  });

  describe('decryptCalendarTokens', () => {
    it('round-trips encryption', () => {
      const encrypted = encryptCalendarTokens(mockTokens);
      const decrypted = decryptCalendarTokens(encrypted);
      expect(decrypted).toEqual(mockTokens);
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = encryptCalendarTokens(mockTokens);
      const tampered = {
        ...encrypted,
        encrypted: 'A'.repeat(encrypted.encrypted.length),
      };
      expect(() => decryptCalendarTokens(tampered)).toThrow(
        /decryption failed|tampered/i,
      );
    });

    it('throws on wrong key', () => {
      const encrypted = encryptCalendarTokens(mockTokens);
      process.env.CALENDAR_ENCRYPTION_KEY = 'F'.repeat(64);
      expect(() => decryptCalendarTokens(encrypted)).toThrow();
    });

    it('throws on truncated ciphertext', () => {
      expect(() =>
        decryptCalendarTokens({
          encrypted: Buffer.from('short').toString('base64'),
          iv: Buffer.alloc(12).toString('base64'),
          version: 1,
        }),
      ).toThrow();
    });
  });

  describe('rotateCalendarTokens', () => {
    it('replaces old tokens with new ones', () => {
      const encrypted = encryptCalendarTokens(mockTokens);
      const newTokens: OAuthTokens = {
        ...mockTokens,
        accessToken: 'ya29.new-calendar-token',
      };
      const rotated = rotateCalendarTokens(encrypted, newTokens);
      const decrypted = decryptCalendarTokens(rotated);
      expect(decrypted.accessToken).toBe('ya29.new-calendar-token');
    });
  });

  describe('env validation', () => {
    it('throws if CALENDAR_ENCRYPTION_KEY is missing', () => {
      delete process.env.CALENDAR_ENCRYPTION_KEY;
      expect(() => encryptCalendarTokens(mockTokens)).toThrow(
        /CALENDAR_ENCRYPTION_KEY/,
      );
    });

    it('throws if key is wrong length', () => {
      process.env.CALENDAR_ENCRYPTION_KEY = 'abc123';
      expect(() => encryptCalendarTokens(mockTokens)).toThrow(/64 hex/);
    });
  });
});
