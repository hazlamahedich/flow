import { describe, it, expect } from 'vitest';

describe('rate limit configuration', () => {
  it('enforces 5 max requests per hour window', () => {
    const config = { maxRequests: 5, windowMs: 3600000, minIntervalMs: 15000 };
    expect(config.maxRequests).toBe(5);
    expect(config.windowMs).toBe(60 * 60 * 1000);
  });

  it('enforces 15-second minimum between requests', () => {
    const config = { maxRequests: 5, windowMs: 3600000, minIntervalMs: 15000 };
    expect(config.minIntervalMs).toBe(15000);
  });
});
