import { describe, it, expect } from 'vitest';
import { formatDuration } from '../format-duration';

describe('formatDuration', () => {
  it('formats 90 minutes as "1h 30m"', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('formats 45 minutes as "0h 45m"', () => {
    expect(formatDuration(45)).toBe('0h 45m');
  });

  it('formats 60 minutes as "1h 0m"', () => {
    expect(formatDuration(60)).toBe('1h 0m');
  });

  it('formats 1 minute as "0h 1m"', () => {
    expect(formatDuration(1)).toBe('0h 1m');
  });

  it('formats 1440 minutes as "24h 0m"', () => {
    expect(formatDuration(1440)).toBe('24h 0m');
  });
});
