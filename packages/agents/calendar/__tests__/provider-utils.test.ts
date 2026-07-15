import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withTimeout } from '../provider-utils';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('resolves with value when promise completes before timeout', async () => {
    const promise = Promise.resolve('result');

    const result = await withTimeout(promise, 5000);

    expect(result).toBe('result');
  });

  it('rejects with timeout error when promise takes too long', async () => {
    let resolveFn: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolveFn = resolve;
    });

    const result = withTimeout(promise, 1000);

    vi.advanceTimersByTime(1001);

    await expect(result).rejects.toThrow(
      'Provider call timed out after 1000ms',
    );

    resolveFn!('late');
  });

  it('propagates original rejection', async () => {
    const promise = Promise.reject(new Error('API error'));

    await expect(withTimeout(promise, 5000)).rejects.toThrow('API error');
  });

  it('does not timeout if promise resolves quickly', async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('fast'), 50);
    });

    const result = withTimeout(promise, 5000);

    vi.advanceTimersByTime(50);

    const value = await result;
    expect(value).toBe('fast');
  });
});
