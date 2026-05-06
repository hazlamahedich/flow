import { describe, it, expect } from 'vitest';

describe('OAuth callback route', () => {
  it('redirects on access_denied error', async () => {
    const url = new URL('http://localhost:3000/api/auth/gmail/callback?error=access_denied&state=test');
    expect(url.searchParams.get('error')).toBe('access_denied');
  });

  it('requires code and state for POST', () => {
    const formData = new FormData();
    expect(formData.get('code')).toBeNull();
    expect(formData.get('state')).toBeNull();
  });
});
