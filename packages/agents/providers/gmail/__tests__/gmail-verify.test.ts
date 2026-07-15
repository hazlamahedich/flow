import { describe, it, expect, vi } from 'vitest';

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn(),
  })),
}));

import { verifyGoogleOidcToken } from '../gmail-verify';
import { OAuth2Client } from 'google-auth-library';

describe('verifyGoogleOidcToken', () => {
  it('returns true for valid token', async () => {
    const mockVerify = vi.fn().mockResolvedValue({});
    (OAuth2Client as any).mockImplementation(() => ({
      verifyIdToken: mockVerify,
    }));

    const result = await verifyGoogleOidcToken(
      'valid-token',
      'expected-audience',
    );

    expect(result).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith({
      idToken: 'valid-token',
      audience: 'expected-audience',
    });
  });

  it('returns false for invalid token', async () => {
    (OAuth2Client as any).mockImplementation(() => ({
      verifyIdToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
    }));

    const result = await verifyGoogleOidcToken('bad-token', 'audience');

    expect(result).toBe(false);
  });

  it('returns false for wrong audience', async () => {
    (OAuth2Client as any).mockImplementation(() => ({
      verifyIdToken: vi.fn().mockRejectedValue(new Error('Audience mismatch')),
    }));

    const result = await verifyGoogleOidcToken('token', 'wrong-audience');

    expect(result).toBe(false);
  });

  it('returns false when google-auth-library throws unexpectedly', async () => {
    (OAuth2Client as any).mockImplementation(() => ({
      verifyIdToken: vi.fn().mockRejectedValue(new Error('Network error')),
    }));

    const result = await verifyGoogleOidcToken('token', 'aud');

    expect(result).toBe(false);
  });
});
