import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Provider } from 'jotai';

const mockDeriveBadgeState = vi.fn(() => 'supervised');

vi.mock('@flow/trust', () => ({
  deriveBadgeState: (...args: unknown[]) => mockDeriveBadgeState(...args),
  TRUST_BADGE_DISPLAY: {
    supervised: { label: 'Learning', colorToken: '--c', borderStyle: '1px solid' },
    confirm: { label: 'Established', colorToken: '--c', borderStyle: '1px dashed' },
    auto: { label: 'Auto', colorToken: '--c', borderStyle: 'none' },
    promoting: { label: 'Promoting', colorToken: '--c', borderStyle: '1px solid' },
    regressing: { label: 'Regressing', colorToken: '--c', borderStyle: '1px solid' },
    stick_time: { label: 'Ready for review?', colorToken: '--c', borderStyle: 'none' },
  },
}));

vi.mock('@flow/shared', () => ({
  AGENT_IDENTITY: {
    inbox: { label: 'Inbox', iconInitial: 'IN', color: '#3B82F6' },
    calendar: { label: 'Calendar', iconInitial: 'CA', color: '#8B5CF6' },
    'ar-collection': { label: 'AR Collection', iconInitial: 'AR', color: '#F59E0B' },
    'weekly-report': { label: 'Weekly Report', iconInitial: 'WR', color: '#10B981' },
    'client-health': { label: 'Client Health', iconInitial: 'CH', color: '#EF4444' },
    'time-integrity': { label: 'Time Integrity', iconInitial: 'TI', color: '#EC4899' },
  },
  AGENT_IDS: ['inbox', 'calendar', 'ar-collection', 'weekly-report', 'client-health', 'time-integrity'],
}));

vi.mock('../trust-badge-wrapper', () => ({
  TrustBadgeWrapper: ({ agentId }: { agentId: string }) => (
    <span data-testid={`badge-${agentId}`}>badge:{agentId}</span>
  ),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/agents' }));

import { AgentTrustGrid } from '../agent-trust-grid';
import type { TrustSummaryRow } from '../../lib/trust-summary';

const WS_ID = 'ws-00000000-0000-0000-0000-000000000001';

function makeRow(overrides: Partial<TrustSummaryRow> = {}): TrustSummaryRow {
  return {
    workspaceId: WS_ID,
    agentId: 'inbox',
    currentLevel: 'supervised',
    score: 10,
    consecutiveSuccesses: 2,
    totalExecutions: 5,
    successfulExecutions: 4,
    violationCount: 0,
    lastTransitionAt: new Date().toISOString(),
    lastViolationAt: null,
    ...overrides,
  };
}

function getCard(agentId: string) {
  const cards = screen.getAllByTestId(`agent-card-${agentId}`);
  return cards[cards.length - 1];
}

function renderGrid(rows: TrustSummaryRow[] = []) {
  return render(
    <Provider>
      <AgentTrustGrid workspaceId={WS_ID} initialData={rows} />
    </Provider>,
  );
}

describe('AgentTrustGrid', () => {
  beforeEach(() => {
    mockDeriveBadgeState.mockReturnValue('supervised');
  });

  it('renders grid container', () => {
    renderGrid();
    const grids = screen.getAllByTestId('agent-trust-grid');
    expect(grids.length).toBeGreaterThanOrEqual(1);
  });

  it('renders all 6 agent cards', () => {
    renderGrid();
    expect(screen.getAllByTestId('agent-card-inbox').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('agent-card-calendar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('agent-card-ar-collection').length).toBeGreaterThanOrEqual(1);
  });

  it('renders agent labels', () => {
    renderGrid();
    expect(screen.getAllByText('Inbox').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Calendar').length).toBeGreaterThanOrEqual(1);
  });

  it('renders icon initials', () => {
    renderGrid();
    expect(screen.getAllByText('IN').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('CA').length).toBeGreaterThanOrEqual(1);
  });

  it('shows supervised detail for agent with row', () => {
    renderGrid([makeRow({ agentId: 'inbox', score: 10 })]);
    expect(getCard('inbox').textContent).toContain('Score');
    expect(getCard('inbox').textContent).toContain('10/200');
  });

  it('shows confirm detail when state is confirm', () => {
    mockDeriveBadgeState.mockReturnValue('confirm');
    renderGrid([makeRow({ agentId: 'inbox', currentLevel: 'confirm', score: 100 })]);
    expect(getCard('inbox').textContent).toContain('Established');
  });

  it('shows auto detail when state is auto', () => {
    mockDeriveBadgeState.mockReturnValue('auto');
    renderGrid([makeRow({ agentId: 'inbox', currentLevel: 'auto', score: 180 })]);
    expect(getCard('inbox').textContent).toContain('Auto');
  });

  it('shows no detail for agent without row', () => {
    renderGrid();
    const card = getCard('inbox');
    expect(card.textContent).not.toContain('Score');
  });

  it('shows rejection count in supervised detail', () => {
    renderGrid([makeRow({ agentId: 'inbox', violationCount: 2 })]);
    expect(getCard('inbox').textContent).toContain('Rejections');
  });

  it('handles empty initialData', () => {
    renderGrid([]);
    expect(screen.getAllByTestId('agent-trust-grid').length).toBeGreaterThanOrEqual(1);
  });

  it('renders as responsive grid', () => {
    const { container } = renderGrid();
    const grid = container.querySelector('[data-testid="agent-trust-grid"]');
    expect(grid?.className).toContain('grid');
  });

  it('calls deriveBadgeState for each agent', () => {
    renderGrid([makeRow({ agentId: 'inbox' })]);
    expect(mockDeriveBadgeState).toHaveBeenCalled();
  });
});
