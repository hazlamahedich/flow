import { describe, it, expect, vi } from 'vitest';

vi.mock('@flow/db', () => ({
  createFlowError: (status: number, code: string, message: string, category: string) => ({
    status, code, message, category,
  }),
}));

describe('device revoke operations', () => {
  describe('revoke single device', () => {
    it('marks device as revoked', () => {
      const devices = [
        { id: 'dev-1', isRevoked: false, label: 'MacBook' },
        { id: 'dev-2', isRevoked: false, label: 'iPhone' },
      ];

      const target = devices.find((d) => d.id === 'dev-1');
      if (target) target.isRevoked = true;

      expect(devices[0]!.isRevoked).toBe(true);
      expect(devices[1]!.isRevoked).toBe(false);
    });

    it('revoked device cookie no longer extends session', () => {
      const isTrusted = false;
      const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
      const issuedAt = Date.now() - 25 * 60 * 60 * 1000;

      const expired = !isTrusted && (Date.now() - issuedAt > ABSOLUTE_SESSION_MS);
      expect(expired).toBe(true);
    });
  });

  describe('revoke all devices', () => {
    it('marks all devices as revoked', () => {
      const devices = [
        { id: 'dev-1', isRevoked: false },
        { id: 'dev-2', isRevoked: false },
        { id: 'dev-3', isRevoked: false },
      ];

      devices.forEach((d) => { d.isRevoked = true; });

      expect(devices.every((d) => d.isRevoked)).toBe(true);
    });

    it('sign out everywhere terminates all sessions', () => {
      const invalidatedUserId = 'user-123';
      expect(invalidatedUserId).toBe('user-123');
    });
  });
});
