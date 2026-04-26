import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HistoryEventRow } from '../history-event-row';

function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'evt-1',
    agentId: overrides.agentId ?? 'inbox',
    fromLevel: overrides.fromLevel ?? 'supervised',
    toLevel: overrides.toLevel ?? 'confirm',
    triggerReason: overrides.triggerReason ?? 'Clean run streak',
    createdAt: overrides.createdAt ?? '2026-01-15T12:00:00Z',
    ...overrides,
  } as any;
}

describe('HistoryEventRow', () => {
  afterEach(() => cleanup());

  it('renders agent label', () => {
    render(<HistoryEventRow event={buildEvent()} />);
    expect(screen.getByText('Inbox')).toBeDefined();
  });

  it('renders upgrade arrow for promotion', () => {
    render(<HistoryEventRow event={buildEvent({ fromLevel: 'supervised', toLevel: 'confirm' })} />);
    expect(screen.getByText('↑')).toBeDefined();
  });

  it('renders downgrade arrow for regression', () => {
    render(<HistoryEventRow event={buildEvent({ fromLevel: 'auto', toLevel: 'confirm' })} />);
    expect(screen.getByText('↓')).toBeDefined();
  });

  it('renders from and to levels', () => {
    render(<HistoryEventRow event={buildEvent({ fromLevel: 'supervised', toLevel: 'auto' })} />);
    expect(screen.getByText('supervised')).toBeDefined();
    expect(screen.getByText('auto')).toBeDefined();
  });

  it('renders trigger reason', () => {
    render(<HistoryEventRow event={buildEvent({ triggerReason: 'Hard violation detected' })} />);
    expect(screen.getByText('Hard violation detected')).toBeDefined();
  });

  it('renders event with data-testid', () => {
    render(<HistoryEventRow event={buildEvent({ id: 'evt-42' })} />);
    expect(screen.getByTestId('history-event-evt-42')).toBeDefined();
  });

  it('has row role', () => {
    render(<HistoryEventRow event={buildEvent()} />);
    expect(screen.getByRole('row')).toBeDefined();
  });
});
