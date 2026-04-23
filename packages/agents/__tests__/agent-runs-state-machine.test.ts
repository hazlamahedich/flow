import { describe, it, expect } from 'vitest';
import { isValidTransition, VALID_RUN_TRANSITIONS } from '../orchestrator/transition-map';
import type { AgentRunStatus } from '@flow/types';

describe('TC-01: Valid forward transitions accepted', () => {
  it.each([
    { from: 'queued', to: 'running' },
    { from: 'queued', to: 'failed' },
    { from: 'queued', to: 'cancelled' },
    { from: 'running', to: 'completed' },
    { from: 'running', to: 'failed' },
    { from: 'running', to: 'timed_out' },
    { from: 'running', to: 'cancelled' },
  ] as Array<{ from: AgentRunStatus; to: AgentRunStatus }>)(
    'allows $from → $to',
    ({ from, to }) => {
      expect(isValidTransition(from, to)).toBe(true);
    },
  );
});

describe('TC-02: waiting_approval transitions', () => {
  it.each([
    { from: 'running', to: 'waiting_approval' },
    { from: 'waiting_approval', to: 'completed' },
    { from: 'waiting_approval', to: 'failed' },
    { from: 'waiting_approval', to: 'timed_out' },
    { from: 'waiting_approval', to: 'cancelled' },
  ] as Array<{ from: AgentRunStatus; to: AgentRunStatus }>)(
    'allows $from → $to',
    ({ from, to }) => {
      expect(isValidTransition(from, to)).toBe(true);
    },
  );
});

describe('TC-03: Failure transitions', () => {
  it('queued → failed is valid', () => {
    expect(isValidTransition('queued', 'failed')).toBe(true);
  });

  it('running → failed is valid', () => {
    expect(isValidTransition('running', 'failed')).toBe(true);
  });

  it('waiting_approval → failed is valid', () => {
    expect(isValidTransition('waiting_approval', 'failed')).toBe(true);
  });
});

describe('TC-04: Timeout transitions', () => {
  it('running → timed_out is valid', () => {
    expect(isValidTransition('running', 'timed_out')).toBe(true);
  });

  it('waiting_approval → timed_out is valid', () => {
    expect(isValidTransition('waiting_approval', 'timed_out')).toBe(true);
  });
});

describe('TC-05: Invalid backward transitions rejected', () => {
  const terminalStates: AgentRunStatus[] = ['completed', 'failed', 'timed_out', 'cancelled'];
  const allStatuses: AgentRunStatus[] = [
    'queued', 'running', 'waiting_approval', 'completed', 'failed', 'timed_out', 'cancelled',
  ];

  it.each(
    terminalStates.flatMap((from) =>
      allStatuses.map((to) => ({ from, to })),
    ),
  )('rejects terminal state transition $from → $to', ({ from, to }) => {
    expect(isValidTransition(from, to)).toBe(false);
  });

  it('rejects completed → running', () => {
    expect(isValidTransition('completed', 'running')).toBe(false);
  });

  it('rejects running → queued', () => {
    expect(isValidTransition('running', 'queued')).toBe(false);
  });

  it('rejects waiting_approval → running', () => {
    expect(isValidTransition('waiting_approval', 'running')).toBe(false);
  });

  it('rejects failed → running', () => {
    expect(isValidTransition('failed', 'running')).toBe(false);
  });

  it('rejects queued → completed (skip-state)', () => {
    expect(isValidTransition('queued', 'completed')).toBe(false);
  });

  it('rejects queued → timed_out', () => {
    expect(isValidTransition('queued', 'timed_out')).toBe(false);
  });

  it('rejects queued → waiting_approval', () => {
    expect(isValidTransition('queued', 'waiting_approval')).toBe(false);
  });
});

describe('VALID_RUN_TRANSITIONS: all terminal states have empty arrays', () => {
  it.each([
    { status: 'completed' as const },
    { status: 'failed' as const },
    { status: 'timed_out' as const },
    { status: 'cancelled' as const },
  ])('$status has no allowed transitions', ({ status }) => {
    expect(VALID_RUN_TRANSITIONS[status]).toEqual([]);
  });
});
