import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashDeviceToken,
  generateDeviceToken,
  parseUserAgent,
} from '../device-trust';

describe('hashDeviceToken', () => {
  it('[P0] produces consistent SHA-256 hex digest', () => {
    const hash1 = hashDeviceToken('test-token');
    const hash2 = hashDeviceToken('test-token');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('[P0] produces different hashes for different tokens', () => {
    expect(hashDeviceToken('a')).not.toBe(hashDeviceToken('b'));
  });
});

describe('generateDeviceToken', () => {
  it('[P0] generates unique UUID-format tokens', () => {
    const token1 = generateDeviceToken();
    const token2 = generateDeviceToken();
    expect(token1).not.toBe(token2);
    expect(token1).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('parseUserAgent', () => {
  it('[P0] identifies Chrome on macOS', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36'))
      .toMatch(/Chrome 120 on macOS/);
  });

  it('[P0] identifies Firefox on Windows', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Firefox/119.0'))
      .toMatch(/Firefox 119 on Windows/);
  });

  it('[P0] identifies Safari on iPhone', () => {
    expect(parseUserAgent('Mozilla/5.0 (iPhone; Safari/604.1 Version/17.0'))
      .toBe('Safari on iPhone');
  });

  it('[P0] identifies Edge on macOS', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Edg/120.0'))
      .toMatch(/Edge 120 on macOS/);
  });

  it('[P0] returns Unknown Device for null', () => {
    expect(parseUserAgent(null)).toBe('Unknown Device');
  });

  it('[P0] returns Unknown Device for unrecognized UA', () => {
    expect(parseUserAgent('SomeBot/1.0')).toBe('Unknown Device');
  });
});
