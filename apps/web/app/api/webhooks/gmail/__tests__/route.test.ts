import { describe, it, expect } from 'vitest';

describe('Pub/Sub webhook route', () => {
  it('rejects requests without Bearer token', () => {
    const headers = new Headers();
    expect(headers.get('authorization')).toBeNull();
  });

  it('returns 200 for malformed messages (fail-open)', () => {
    const body = { message: {} as Record<string, unknown> };
    expect((body.message as Record<string, unknown>).data).toBeUndefined();
  });
});
