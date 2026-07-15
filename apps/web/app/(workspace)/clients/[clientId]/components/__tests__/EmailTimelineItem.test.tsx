import { render, screen, fireEvent, waitFor, cleanup } from '@flow/test-utils';
import { EmailTimelineItem } from '../EmailTimelineItem';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildEmailTimelineEntry } from '@flow/test-utils';
import { recategorizeTimelineEmail } from '../../actions/timeline';

vi.mock('../../actions/timeline', () => ({
  recategorizeTimelineEmail: vi.fn(),
}));

describe('EmailTimelineItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('badge variants (AC2)', () => {
    it('renders Urgent badge for urgent category', () => {
      const email = buildEmailTimelineEntry({
        category: 'urgent',
        subject: 'Urgent email',
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );
      expect(screen.getByText('Urgent')).toBeDefined();
      expect(screen.getByText('Urgent email')).toBeDefined();
    });

    it('renders Action badge for action category', () => {
      const email = buildEmailTimelineEntry({
        category: 'action',
        subject: 'Action email',
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );
      expect(screen.getByText('Action')).toBeDefined();
    });

    it('renders Info badge for info category', () => {
      const email = buildEmailTimelineEntry({
        category: 'info',
        subject: 'Info email',
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );
      expect(screen.getByText('Info')).toBeDefined();
    });

    it('renders Noise badge for noise category', () => {
      const email = buildEmailTimelineEntry({
        category: 'noise',
        subject: 'Noise email',
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );
      expect(screen.getByText('Noise')).toBeDefined();
    });

    it('renders Pending badge when category is null', () => {
      const email = buildEmailTimelineEntry({
        category: null,
        subject: 'Pending email',
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );
      expect(screen.getByText('Pending')).toBeDefined();
    });
  });

  describe('triage controls (AC5)', () => {
    it('shows Approve/Reject/Recategorize when requiresConfirmation=true', () => {
      const email = buildEmailTimelineEntry({
        category: null,
        requiresConfirmation: true,
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );
      expect(screen.getByText(/Approve/)).toBeDefined();
      expect(screen.getByText('Reject')).toBeDefined();
      expect(screen.getByText('Recategorize')).toBeDefined();
    });

    it('shows triage controls when agent has categorized and requires confirmation', () => {
      const email = buildEmailTimelineEntry({
        category: 'action',
        requiresConfirmation: true,
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );
      expect(screen.getByText('Approve')).toBeDefined();
    });

    it('does NOT show triage controls when requiresConfirmation=false', () => {
      const email = buildEmailTimelineEntry({
        category: 'action',
        requiresConfirmation: false,
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );
      expect(screen.queryByText('Approve')).toBeNull();
      expect(screen.queryByText('Reject')).toBeNull();
      expect(screen.queryByText('Recategorize')).toBeNull();
    });

    it('calls recategorizeTimelineEmail with existing category on Approve', async () => {
      (recategorizeTimelineEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
        { success: true },
      );
      const email = buildEmailTimelineEntry({
        category: 'urgent',
        requiresConfirmation: true,
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );

      fireEvent.click(screen.getByText('Approve'));

      await waitFor(() => {
        expect(recategorizeTimelineEmail).toHaveBeenCalledWith({
          emailId: email.id,
          category: 'urgent',
          workspaceId: 'ws1',
          clientId: 'c1',
        });
      });
    });

    it('calls recategorizeTimelineEmail with action fallback on Approve when no category', async () => {
      (recategorizeTimelineEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
        { success: true },
      );
      const email = buildEmailTimelineEntry({
        category: null,
        requiresConfirmation: true,
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );

      fireEvent.click(screen.getByText(/Approve/));

      await waitFor(() => {
        expect(recategorizeTimelineEmail).toHaveBeenCalledWith({
          emailId: email.id,
          category: 'action',
          workspaceId: 'ws1',
          clientId: 'c1',
        });
      });
    });

    it('shows category picker on Recategorize click', () => {
      const email = buildEmailTimelineEntry({
        category: null,
        requiresConfirmation: true,
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );

      fireEvent.click(screen.getByText('Recategorize'));

      const allUrgent = screen.getAllByText('Urgent');
      const allAction = screen.getAllByText('Action');
      const allInfo = screen.getAllByText('Info');
      const allNoise = screen.getAllByText('Noise');
      expect(allUrgent.length).toBeGreaterThanOrEqual(1);
      expect(allAction.length).toBeGreaterThanOrEqual(1);
      expect(allInfo.length).toBeGreaterThanOrEqual(1);
      expect(allNoise.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('optimistic update (AC5)', () => {
    it('optimistically hides triage controls and changes badge on Approve click', async () => {
      (
        recategorizeTimelineEmail as ReturnType<typeof vi.fn>
      ).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 50),
          ),
      );
      const email = buildEmailTimelineEntry({
        category: 'urgent',
        subject: 'Test',
        requiresConfirmation: true,
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );

      expect(screen.getByText('Approve')).toBeDefined();

      fireEvent.click(screen.getByText('Approve'));

      expect(screen.queryByText('Approve')).toBeNull();

      await waitFor(() => {
        expect(recategorizeTimelineEmail).toHaveBeenCalled();
      });
    });

    it('reverts triage controls and badge on server error', async () => {
      (recategorizeTimelineEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
        { success: false },
      );
      const email = buildEmailTimelineEntry({
        category: null,
        subject: 'Test',
        requiresConfirmation: true,
      });
      render(
        <EmailTimelineItem email={email} workspaceId="ws1" clientId="c1" />,
      );

      fireEvent.click(screen.getByText(/Approve/));

      await waitFor(() => {
        expect(screen.getByText(/Approve/)).toBeDefined();
      });
    });
  });
});
