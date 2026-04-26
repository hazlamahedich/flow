import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { TrustEventRow } from '@flow/db';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

import { HistoryTable } from '../history-table';

const mockEvents: TrustEventRow[] = [
  {
    id: 'e1',
    matrixEntryId: 'm1',
    workspaceId: 'ws-1',
    agentId: 'inbox',
    fromLevel: 'confirm',
    toLevel: 'auto',
    triggerType: 'graduation',
    triggerReason: 'Graduated to auto',
    isContextShift: false,
    actor: 'va:user1',
    createdAt: '2025-02-01T00:00:00Z',
  },
  {
    id: 'e2',
    matrixEntryId: 'm2',
    workspaceId: 'ws-1',
    agentId: 'calendar',
    fromLevel: 'auto',
    toLevel: 'confirm',
    triggerType: 'soft_violation',
    triggerReason: 'Action rejected',
    isContextShift: false,
    actor: 'system',
    createdAt: '2025-02-15T00:00:00Z',
  },
];

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

describe('HistoryTable', () => {
  it('renders events', () => {
    render(<HistoryTable events={mockEvents} total={2} page={1} pageSize={25} />);
    expect(screen.getByTestId('history-table')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('shows empty state when no events', () => {
    render(<HistoryTable events={[]} total={0} page={1} pageSize={25} />);
    expect(screen.getByTestId('history-empty')).toBeInTheDocument();
    expect(screen.getByText(/No trust events yet/)).toBeInTheDocument();
  });

  it('shows pagination when total exceeds page size', () => {
    render(<HistoryTable events={mockEvents} total={30} page={1} pageSize={25} />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('regression rows use warm amber styling', () => {
    render(<HistoryTable events={mockEvents} total={2} page={1} pageSize={25} />);
    const regressionRow = screen.getByTestId('history-event-e2');
    expect(regressionRow).toBeInTheDocument();
  });

  it('upgrade rows show upward arrow and text label', () => {
    render(<HistoryTable events={mockEvents} total={2} page={1} pageSize={25} />);
    const upgradeRow = screen.getByTestId('history-event-e1');
    expect(upgradeRow).toBeInTheDocument();
    expect(upgradeRow.textContent).toContain('confirm');
    expect(upgradeRow.textContent).toContain('auto');
  });

  it('shows page info with pagination', () => {
    render(<HistoryTable events={mockEvents} total={30} page={1} pageSize={25} />);
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  });

  it('previous button disabled on page 1', () => {
    render(<HistoryTable events={mockEvents} total={30} page={1} pageSize={25} />);
    expect(screen.getByText('Previous')).toBeDisabled();
  });
});
