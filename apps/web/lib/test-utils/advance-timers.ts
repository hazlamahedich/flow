import { act } from '@testing-library/react';
import { vi } from 'vitest';

export function advanceTimers(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
