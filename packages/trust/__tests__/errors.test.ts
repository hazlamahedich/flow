import { describe, it, expect } from 'vitest';
import { TrustTransitionError } from '../src/errors';
import type { TrustTransitionErrorCode } from '../src/errors';

describe('TrustTransitionError', () => {
  it('stores code and message', () => {
    const err = new TrustTransitionError('CONCURRENT_MODIFICATION', 'conflict');
    expect(err.code).toBe<TrustTransitionErrorCode>('CONCURRENT_MODIFICATION');
    expect(err.message).toBe('conflict');
    expect(err).toBeInstanceOf(Error);
  });

  it('is retryable only for QUERY_FAILED', () => {
    const retryable = new TrustTransitionError('QUERY_FAILED', 'q');
    const notRetryable = new TrustTransitionError('CONCURRENT_MODIFICATION', 'c');
    expect(retryable.retryable).toBe(true);
    expect(notRetryable.retryable).toBe(false);
  });

  it('covers all known codes', () => {
    const codes: TrustTransitionErrorCode[] = [
      'CONCURRENT_MODIFICATION',
      'INVALID_TRANSITION',
      'PRECONDITION_FAILED',
      'QUERY_FAILED',
    ];
    for (const code of codes) {
      const err = new TrustTransitionError(code, 'msg');
      expect(err.code).toBe(code);
    }
  });
});
