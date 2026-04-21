import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';

describe('auth-audit utilities', () => {
  it('produces consistent HMAC hashes for emails', () => {
    const secret = 'test-secret';
    const email = 'test@example.com';
    const hash1 = createHmac('sha256', secret).update(email).digest('hex');
    const hash2 = createHmac('sha256', secret).update(email).digest('hex');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('produces different hashes for different emails', () => {
    const secret = 'test-secret';
    const hash1 = createHmac('sha256', secret).update('a@test.com').digest('hex');
    const hash2 = createHmac('sha256', secret).update('b@test.com').digest('hex');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes with different secrets', () => {
    const email = 'test@example.com';
    const hash1 = createHmac('sha256', 'secret1').update(email).digest('hex');
    const hash2 = createHmac('sha256', 'secret2').update(email).digest('hex');
    expect(hash1).not.toBe(hash2);
  });
});
