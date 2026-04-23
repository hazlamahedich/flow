import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from '../shared/circuit-breaker';

vi.mock('../shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

describe('Circuit Breaker Integration', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    vi.clearAllMocks();
    cb = new CircuitBreaker();
  });

  it('starts closed', () => {
    expect(cb.state.state).toBe('closed');
    expect(cb.isOpen()).toBe(false);
  });

  it('opens after threshold failures', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure();
    expect(cb.state.state).toBe('open');
    expect(cb.isOpen()).toBe(true);
  });

  it('transitions to halfOpen after openDurationMs', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure();
    expect(cb.isOpen()).toBe(true);

    const originalDateNow = Date.now;
    Date.now = () => originalDateNow() + 61_000;
    expect(cb.isOpen()).toBe(false);
    expect(cb.state.state).toBe('halfOpen');
    Date.now = originalDateNow;
  });

  it('allows one probe in halfOpen', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure();
    const originalDateNow = Date.now;
    Date.now = () => originalDateNow() + 61_000;
    cb.isOpen();
    Date.now = originalDateNow;

    expect(cb.allowRequest()).toBe(true);
    expect(cb.allowRequest()).toBe(false);
  });

  it('probe success closes circuit', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure();
    const originalDateNow = Date.now;
    Date.now = () => originalDateNow() + 61_000;
    cb.isOpen();
    Date.now = originalDateNow;

    cb.recordSuccess();
    expect(cb.state.state).toBe('closed');
    expect(cb.state.failures).toBe(0);
  });

  it('probe failure re-opens circuit', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure();
    const originalDateNow = Date.now;
    Date.now = () => originalDateNow() + 61_000;
    cb.isOpen();
    Date.now = originalDateNow;

    cb.recordFailure();
    expect(cb.state.state).toBe('open');
  });

  it('in-flight requests can complete when circuit opens', () => {
    cb.recordSuccess();
    expect(cb.state.state).toBe('closed');

    for (let i = 0; i < 5; i++) cb.recordFailure();
    expect(cb.state.state).toBe('open');

    cb.recordSuccess();
    expect(cb.state.state).toBe('closed');
  });
});
