import { describe, it, expect } from 'vitest';
import {
  hashDeviceToken,
  generateDeviceToken,
  parseUserAgent,
} from '@flow/auth';
import { MAX_TRUSTED_DEVICES } from '@flow/auth';

describe('device trust (integration via @flow/auth)', () => {
  describe('hashDeviceToken', () => {
    it('produces consistent SHA-256 hashes', () => {
      const token = crypto.randomUUID();
      const hash1 = hashDeviceToken(token);
      const hash2 = hashDeviceToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('produces different hashes for different tokens', () => {
      const hash1 = hashDeviceToken('token-a');
      const hash2 = hashDeviceToken('token-b');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateDeviceToken', () => {
    it('generates valid UUIDs', () => {
      const token = generateDeviceToken();
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('generates unique tokens', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateDeviceToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe('parseUserAgent', () => {
    it('parses Chrome on macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(parseUserAgent(ua)).toBe('Chrome 120 on macOS');
    });

    it('parses Chrome on Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(parseUserAgent(ua)).toBe('Chrome 120 on Windows');
    });

    it('parses Firefox on macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';
      expect(parseUserAgent(ua)).toBe('Firefox 121 on macOS');
    });

    it('parses Safari on iPhone', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
      expect(parseUserAgent(ua)).toBe('Safari 17 on macOS');
    });

    it('parses Edge on Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      expect(parseUserAgent(ua)).toBe('Edge 120 on Windows');
    });

    it('parses Chrome on Linux', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(parseUserAgent(ua)).toBe('Chrome 120 on Linux');
    });

    it('handles null user agent', () => {
      expect(parseUserAgent(null)).toBe('Unknown Device');
    });

    it('handles unknown browser', () => {
      expect(parseUserAgent('SomeCustomBot/1.0')).toBe('Unknown Device');
    });
  });

  describe('MAX_TRUSTED_DEVICES', () => {
    it('is imported from production constant', () => {
      expect(MAX_TRUSTED_DEVICES).toBe(5);
      expect(typeof MAX_TRUSTED_DEVICES).toBe('number');
    });
  });
});
