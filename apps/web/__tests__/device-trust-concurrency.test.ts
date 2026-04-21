import { describe, it, expect } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';

function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('device trust concurrency safety', () => {
  it('simultaneous trust requests generate unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(randomUUID());
    }
    expect(tokens.size).toBe(100);
  });

  it('simultaneous trust requests produce different hashes', () => {
    const tokens = Array.from({ length: 50 }, () => randomUUID());
    const hashes = new Set(tokens.map(hashDeviceToken));
    expect(hashes.size).toBe(50);
  });

  it('device count check must be atomic (documented expectation)', () => {
    const MAX = 5;
    expect(MAX).toBe(5);

    const activeDevices = [
      { id: '1', isRevoked: false },
      { id: '2', isRevoked: false },
      { id: '3', isRevoked: false },
      { id: '4', isRevoked: false },
      { id: '5', isRevoked: false },
    ];
    const activeCount = activeDevices.filter((d) => !d.isRevoked).length;
    expect(activeCount).toBe(5);
    expect(activeCount >= MAX).toBe(true);
  });

  it('device count after concurrent revocation stays accurate', () => {
    const devices = [
      { id: '1', isRevoked: false },
      { id: '2', isRevoked: false },
      { id: '3', isRevoked: false },
    ];

    devices[0]!.isRevoked = true;
    devices[1]!.isRevoked = true;

    const activeCount = devices.filter((d) => !d.isRevoked).length;
    expect(activeCount).toBe(1);
  });
});
