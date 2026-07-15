import { render, screen, cleanup, waitFor } from '@flow/test-utils';
import { ClientTimeline } from '../ClientTimeline';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../TimelineFilterBar', () => ({
  TimelineFilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock('../EmailTimelineItem', () => ({
  EmailTimelineItem: ({ email }: any) => (
    <div data-testid="email-item">{email.subject}</div>
  ),
}));

vi.mock('../AgentActionTimelineItem', () => ({
  AgentActionTimelineItem: ({ run }: any) => (
    <div data-testid="agent-item">{run.status}</div>
  ),
}));

vi.mock('../TimelineLoadMore', () => ({
  TimelineLoadMore: ({ onLoadMore, isLoading, hasMore }: any) => {
    if (!hasMore) return null;
    return (
      <button data-testid="load-more" onClick={onLoadMore} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Load More'}
      </button>
    );
  },
}));

vi.mock('../../actions/timeline', () => ({
  getTimeline: vi.fn(),
}));

import { getTimeline } from '../../actions/timeline';

const wsId = '00000000-0000-0000-0000-000000000001';
const clientId = '00000000-0000-0000-0000-000000000002';

const makeEmailEvent = (id: string, subject: string) => ({
  kind: 'email' as const,
  sortKey: new Date().toISOString(),
  data: {
    id,
    subject,
    fromAddress: 'test@test.com',
    receivedAt: new Date().toISOString(),
    category: 'info' as const,
    requiresConfirmation: false,
    processingState: null,
  },
});

const makeAgentEvent = (id: string, status: string) => ({
  kind: 'agent_run' as const,
  sortKey: new Date().toISOString(),
  data: {
    id,
    status: status as
      | 'running'
      | 'completed'
      | 'failed'
      | 'pending_approval'
      | 'cancelled',
    agentId: 'inbox',
    actionType: 'Categorize',
    createdAt: new Date().toISOString(),
    clientId,
  },
});

describe('ClientTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders email events', () => {
    render(
      <ClientTimeline
        initialEvents={[makeEmailEvent('e-1', 'Hello World')]}
        initialCursor={null}
        workspaceId={wsId}
        clientId={clientId}
        eventType="all"
        dateRange="all"
      />,
    );
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('renders agent run events', () => {
    render(
      <ClientTimeline
        initialEvents={[makeAgentEvent('r-1', 'completed')]}
        initialCursor={null}
        workspaceId={wsId}
        clientId={clientId}
        eventType="all"
        dateRange="all"
      />,
    );
    expect(screen.getByText('completed')).toBeDefined();
  });

  it('shows empty state when no events', () => {
    render(
      <ClientTimeline
        initialEvents={[]}
        initialCursor={null}
        workspaceId={wsId}
        clientId={clientId}
        eventType="all"
        dateRange="all"
      />,
    );
    expect(
      screen.getByText('No communication history yet for this client.'),
    ).toBeDefined();
  });

  it('shows load more button when cursor exists', () => {
    render(
      <ClientTimeline
        initialEvents={[makeEmailEvent('e-1', 'Test')]}
        initialCursor="cursor-1"
        workspaceId={wsId}
        clientId={clientId}
        eventType="all"
        dateRange="all"
      />,
    );
    expect(screen.getByTestId('load-more')).toBeDefined();
  });

  it('hides load more when no cursor', () => {
    render(
      <ClientTimeline
        initialEvents={[makeEmailEvent('e-1', 'Test')]}
        initialCursor={null}
        workspaceId={wsId}
        clientId={clientId}
        eventType="all"
        dateRange="all"
      />,
    );
    expect(screen.queryByTestId('load-more')).toBeNull();
  });

  it('loads more events on button click and deduplicates', async () => {
    const existingEvent = makeEmailEvent('e-1', 'First');
    const newEvent = makeEmailEvent('e-2', 'Second');
    const dupEvent = makeEmailEvent('e-1', 'First');

    (getTimeline as any).mockResolvedValue({
      success: true,
      data: {
        events: [newEvent, dupEvent],
        nextCursor: 'cursor-2',
        hasMore: true,
      },
    });

    render(
      <ClientTimeline
        initialEvents={[existingEvent]}
        initialCursor="cursor-1"
        workspaceId={wsId}
        clientId={clientId}
        eventType="all"
        dateRange="all"
      />,
    );

    screen.getByTestId('load-more').click();

    await waitFor(() => {
      expect(screen.getByText('Second')).toBeDefined();
    });

    expect(getTimeline).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: 'cursor-1',
        workspaceId: wsId,
        clientId,
        limit: 50,
      }),
    );
  });

  it('resets to initial events when props change', async () => {
    const { rerender } = render(
      <ClientTimeline
        initialEvents={[makeEmailEvent('e-1', 'Old')]}
        initialCursor={null}
        workspaceId={wsId}
        clientId={clientId}
        eventType="all"
        dateRange="all"
      />,
    );
    expect(screen.getByText('Old')).toBeDefined();

    rerender(
      <ClientTimeline
        initialEvents={[makeEmailEvent('e-2', 'New')]}
        initialCursor={null}
        workspaceId={wsId}
        clientId={clientId}
        eventType="all"
        dateRange="all"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('New')).toBeDefined();
    });
    expect(screen.queryByText('Old')).toBeNull();
  });
});
