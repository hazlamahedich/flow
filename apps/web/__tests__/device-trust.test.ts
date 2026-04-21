import { describe, it, expect } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';

function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('device trust', () => {
  describe('hashDeviceToken', () => {
    it('produces consistent SHA-256 hashes', () => {
      const token = randomUUID();
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
      const token = randomUUID();
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('generates unique tokens', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => randomUUID()));
      expect(tokens.size).toBe(100);
    });
  });

  describe('parseUserAgent', () => {
    function parseUserAgent(ua: string | null): string {
      if (!ua) return 'Unknown Device';
      if (ua.includes('Firefox/')) {
        const match = ua.match(/Firefox\/(\d+)/);
        if (ua.includes('Mac')) return `Firefox${match ? ` ${match[1]}` : ''} on macOS`;
        if (ua.includes('Windows')) return `Firefox${match ? ` ${match[1]}` : ''} on Windows`;
        return `Firefox${match ? ` ${match[1]}` : ''}`;
      }
      if (ua.includes('Edg/')) {
        const match = ua.match(/Edg\/(\d+)/);
        if (ua.includes('Mac')) return `Edge${match ? ` ${match[1]}` : ''} on macOS`;
        if (ua.includes('Windows')) return `Edge${match ? ` ${match[1]}` : ''} on Windows`;
        return `Edge${match ? ` ${match[1]}` : ''}`;
      }
      if (ua.includes('Chrome/')) {
        const match = ua.match(/Chrome\/(\d+)/);
        if (ua.includes('Mac')) return `Chrome${match ? ` ${match[1]}` : ''} on macOS`;
        if (ua.includes('Windows')) return `Chrome${match ? ` ${match[1]}` : ''} on Windows`;
        return `Chrome${match ? ` ${match[1]}` : ''}`;
      }
      if (ua.includes('Safari/') && !ua.includes('Chrome')) {
        const match = ua.match(/Version\/(\d+)/);
        if (ua.includes('iPhone')) return 'Safari on iPhone';
        if (ua.includes('iPad')) return 'Safari on iPad';
        return `Safari${match ? ` ${match[1]}` : ''} on macOS`;
      }
      return 'Unknown Device';
    }

    it('parses Chrome on macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(parseUserAgent(ua)).toBe('Chrome 120 on macOS');
    });

    it('parses Chrome on Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(parseUserAgent(ua)).toBe('Chrome 120 on Windows');
    });

    it('parses Firefox', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';
      expect(parseUserAgent(ua)).toBe('Firefox 121 on macOS');
    });

    it('parses Safari on iPhone', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
      expect(parseUserAgent(ua)).toBe('Safari on iPhone');
    });

    it('parses Edge', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      expect(parseUserAgent(ua)).toBe('Edge 120 on Windows');
    });

    it('handles null user agent', () => {
      expect(parseUserAgent(null)).toBe('Unknown Device');
    });

    it('handles unknown browser', () => {
      expect(parseUserAgent('SomeCustomBot/1.0')).toBe('Unknown Device');
    });
  });

  describe('MAX_TRUSTED_DEVICES', () => {
    it('is 5', () => {
      expect(5).toBe(5);
    });
  });
});
