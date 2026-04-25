import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildApprovalQueueItem } from '@flow/test-utils';
import { ProposalCard } from '../proposal-card';

const BASE_PROPS = {
  isFocused: false,
  isExpanded: false,
  isTimedOut: false,
  trustStale: false,
  onFocus: () => {},
  onToggleExpand: () => {},
};

function renderItem(
  proposalType: 'agent_proposal' | 'trust_blocked' = 'agent_proposal',
  overrides: Partial<typeof BASE_PROPS> = {},
) {
  const item = buildApprovalQueueItem({ proposalType });
  const itemTitle = item.proposalType === 'agent_proposal' ? item.proposal.title : `Trust gate: ${item.block.reason}`;
  const result = render(
    <ProposalCard
      item={item}
      itemTitle={itemTitle}
      {...BASE_PROPS}
      {...overrides}
    />,
  );
  return { item, ...result };
}

describe('ProposalCard', () => {
  it('renders agent proposal type', () => {
    renderItem('agent_proposal');
    expect(screen.getByText('Agent Proposal')).toBeDefined();
  });

  it('renders trust blocked type', () => {
    renderItem('trust_blocked');
    expect(screen.getByText('Trust Gate')).toBeDefined();
  });

  it('shows trust staleness warning', () => {
    renderItem('agent_proposal', { trustStale: true });
    expect(screen.getByText(/Trust changed/)).toBeDefined();
  });

  it('shows timed out indicator', () => {
    renderItem('agent_proposal', { isTimedOut: true });
    expect(screen.getByText(/Execution paused/)).toBeDefined();
  });

  it('applies focused styles when focused', () => {
    const { container } = renderItem('agent_proposal', { isFocused: true });
    const card = container.firstChild as HTMLElement;
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  it('shows keyboard hints in collapsed state', () => {
    renderItem('agent_proposal');
    expect(screen.getAllByText('[A]pprove').length).toBeGreaterThan(0);
  });
});
