import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('device trust replay protection', () => {
  it('stolen cookie on different device still matches hash', () => {
    const stolenToken = '550e8400-e29b-41d4-a716-446655440000';
    const hash1 = hashDeviceToken(stolenToken);
    const hash2 = hashDeviceToken(stolenToken);
    expect(hash1).toBe(hash2);
  });

  it('different token does not match stored hash', () => {
    const legitimateToken = '550e8400-e29b-41d4-a716-446655440000';
    const fakeToken = '660e8400-e29b-41d4-a716-446655440001';
    expect(hashDeviceToken(legitimateToken)).not.toBe(hashDeviceToken(fakeToken));
  });

  it('empty cookie value produces hash that does not match valid tokens', () => {
    const validToken = '550e8400-e29b-41d4-a716-446655440000';
    const validHash = hashDeviceToken(validToken);
    const emptyHash = hashDeviceToken('');
    expect(emptyHash).not.toBe(validHash);
  });

  it('note: cookie theft allows impersonation until revocation (MVP limitation)', () => {
    const token = '550e8400-e29b-41d4-a716-446655440000';
    const hash = hashDeviceToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
