import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildApprovalQueueItem } from '@flow/test-utils';
import { ProposalCard } from '../proposal-card';

function renderTimeoutCard(expanded = false) {
  const item = buildApprovalQueueItem({
    proposalType: 'agent_proposal',
    runOverrides: { status: 'timed_out' },
  });
  const title = item.proposalType === 'agent_proposal' ? item.proposal.title : '';
  render(
    <ProposalCard
      item={item}
      isFocused={false}
      isExpanded={expanded}
      isTimedOut={true}
      trustStale={false}
      itemTitle={title}
      onFocus={() => {}}
      onToggleExpand={() => {}}
    />,
  );
}

describe('Timeout UI', () => {
  it('displays timed-out indicator', () => {
    renderTimeoutCard();
    expect(screen.getByText(/Execution paused/)).toBeDefined();
  });

  it('shows expanded state with reasoning', () => {
    renderTimeoutCard(true);
    expect(screen.getByText('Reasoning')).toBeDefined();
  });
});
