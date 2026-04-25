import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildApprovalQueueItem } from '@flow/test-utils';
import { ApprovalQueue } from '../approval-queue';

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(),
      })),
    })),
    removeChannel: vi.fn(),
  })),
}));

describe('ApprovalQueue', () => {
  it('renders empty state', () => {
    render(
      <ApprovalQueue
        initialItems={[]}
        agentBreakdown={{}}
        totalCount={0}
        workspaceId="ws-test-00000000-0000-0000-0000-000000000000"
      />,
    );

    expect(screen.getByText(/All clear/)).toBeDefined();
  });

  it('renders items', () => {
    const items = [
      buildApprovalQueueItem({ proposalType: 'agent_proposal' }),
      buildApprovalQueueItem({ proposalType: 'trust_blocked' }),
    ];

    render(
      <ApprovalQueue
        initialItems={items}
        agentBreakdown={{ inbox: 1, calendar: 1 }}
        totalCount={2}
        workspaceId="ws-test-00000000-0000-0000-0000-000000000000"
      />,
    );

    expect(screen.getByText('Agent Proposal')).toBeDefined();
    expect(screen.getByText('Trust Gate')).toBeDefined();
  });

  it('shows Navigate mode indicator', () => {
    const items = [buildApprovalQueueItem()];
    render(
      <ApprovalQueue
        initialItems={items}
        agentBreakdown={{ inbox: 1 }}
        totalCount={1}
        workspaceId="ws-test-00000000-0000-0000-0000-000000000000"
      />,
    );

    const indicators = screen.getAllByText('Navigate');
    expect(indicators.length).toBeGreaterThan(0);
  });
});
