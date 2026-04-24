import { describe, it, expect, vi } from 'vitest';
import { createLLMRouter, NoAvailableProviderError } from '../shared/llm-router';
import type { CircuitBreakerPort } from '@flow/shared';

function createFakeCircuitBreaker(overrides: Partial<CircuitBreakerPort> = {}): CircuitBreakerPort {
  return {
    canExecute: vi.fn().mockReturnValue(true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    getState: vi.fn().mockReturnValue('closed' as const),
    ...overrides,
  };
}

describe('createLLMRouter', () => {
  it('creates a router with complete and isHealthy methods', () => {
    const router = createLLMRouter();
    expect(typeof router.complete).toBe('function');
    expect(typeof router.isHealthy).toBe('function');
  });

  it('reports healthy when circuit breaker allows execution', () => {
    const cb = createFakeCircuitBreaker();
    const router = createLLMRouter(cb);
    expect(router.isHealthy('groq')).toBe(true);
  });

  it('reports unhealthy when circuit breaker blocks execution', () => {
    const cb = createFakeCircuitBreaker({ canExecute: vi.fn().mockReturnValue(false) });
    const router = createLLMRouter(cb);
    expect(router.isHealthy('groq')).toBe(false);
  });

  it('throws NoAvailableProviderError when all circuits are open', async () => {
    const cb = createFakeCircuitBreaker({ canExecute: vi.fn().mockReturnValue(false) });
    const router = createLLMRouter(cb);
    await expect(
      router.complete(
        [{ role: 'user', content: 'test' }],
        { workspaceId: 'ws-1', agentId: 'inbox' },
      ),
    ).rejects.toThrow(NoAvailableProviderError);
  });

  it('NoAvailableProviderError has user-friendly message', () => {
    const error = new NoAvailableProviderError();
    expect(error.message).toContain('temporarily unavailable');
  });

  it('accepts NOOP_CIRCUIT_BREAKER by default', () => {
    const router = createLLMRouter();
    expect(router.isHealthy('groq')).toBe(true);
  });

  it('uses circuit breaker to check provider health', () => {
    const cb = createFakeCircuitBreaker();
    const router = createLLMRouter(cb);
    router.isHealthy('anthropic');
    expect(cb.canExecute).toHaveBeenCalledWith('anthropic');
  });
});
