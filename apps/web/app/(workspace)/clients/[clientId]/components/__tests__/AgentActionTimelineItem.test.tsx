import { render, screen, cleanup } from '@flow/test-utils';
import { AgentActionTimelineItem } from '../AgentActionTimelineItem';
import { describe, it, expect, afterEach } from 'vitest';
import { buildAgentRunTimelineEntry } from '@flow/test-utils';

describe('AgentActionTimelineItem', () => {
  afterEach(() => {
    cleanup();
  });

  describe('status rendering (AC2)', () => {
    it('renders completed action with success styling', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'completed',
        agentId: 'inbox',
        actionType: 'Categorize',
      });
      render(<AgentActionTimelineItem run={run} />);
      expect(screen.getByText('Completed')).toBeDefined();
      expect(screen.getByText('Inbox Agent')).toBeDefined();
    });

    it('renders failed action with error styling', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'failed',
        agentId: 'inbox',
        actionType: 'Categorize',
      });
      render(<AgentActionTimelineItem run={run} />);
      expect(screen.getByText('Failed')).toBeDefined();
    });

    it('renders running action with warning styling', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'running',
        agentId: 'inbox',
        actionType: 'Categorize',
      });
      render(<AgentActionTimelineItem run={run} />);
      expect(screen.getByText('Running')).toBeDefined();
    });

    it('renders cancelled action with secondary styling', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'cancelled',
        agentId: 'inbox',
        actionType: 'Categorize',
      });
      render(<AgentActionTimelineItem run={run} />);
      expect(screen.getByText('Cancelled')).toBeDefined();
    });
  });

  describe('proposal card (AC4)', () => {
    it('renders pending_approval with expandable reasoning and View in Approvals link', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'pending_approval',
        agentId: 'inbox',
        actionType: 'Categorize',
        proposal: {
          reasoning: 'This email appears urgent based on content analysis',
          content: 'Proposed categorization: urgent',
        },
      });
      render(<AgentActionTimelineItem run={run} />);

      expect(screen.getByText('Pending Approval')).toBeDefined();
      expect(screen.getByText('Proposed categorization: urgent')).toBeDefined();
      expect(screen.getByText('View in Approvals')).toBeDefined();
    });

    it('does NOT render proposal content for completed status', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'completed',
        agentId: 'inbox',
        proposal: { reasoning: 'test', content: 'test' },
      });
      render(<AgentActionTimelineItem run={run} />);

      expect(screen.queryByText('View in Approvals')).toBeNull();
    });

    it('does NOT render proposal content for failed status', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'failed',
        agentId: 'inbox',
        proposal: { reasoning: 'test', content: 'test' },
      });
      render(<AgentActionTimelineItem run={run} />);

      expect(screen.queryByText('View in Approvals')).toBeNull();
    });

    it('does NOT render proposal content for running status', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'running',
        agentId: 'inbox',
        proposal: { reasoning: 'test', content: 'test' },
      });
      render(<AgentActionTimelineItem run={run} />);

      expect(screen.queryByText('View in Approvals')).toBeNull();
    });

    it('does NOT render proposal content for cancelled status', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'cancelled',
        agentId: 'inbox',
        proposal: { reasoning: 'test', content: 'test' },
      });
      render(<AgentActionTimelineItem run={run} />);

      expect(screen.queryByText('View in Approvals')).toBeNull();
    });

    it('renders Why button for expandable reasoning', () => {
      const run = buildAgentRunTimelineEntry({
        status: 'pending_approval',
        agentId: 'inbox',
        actionType: 'Categorize',
        proposal: {
          reasoning: 'The content analysis suggests urgency.',
          content: 'Categorize as urgent',
        },
      });
      render(<AgentActionTimelineItem run={run} />);

      expect(screen.getByText('Why?')).toBeDefined();
    });
  });

  describe('agent identity (AC2)', () => {
    it('displays agent label from AGENT_IDENTITY', () => {
      const run = buildAgentRunTimelineEntry({
        agentId: 'ar-collection',
        status: 'completed',
      });
      render(<AgentActionTimelineItem run={run} />);
      expect(screen.getByText('AR Collection Agent')).toBeDefined();
    });

    it('falls back to agentId for unknown agents', () => {
      const run = buildAgentRunTimelineEntry({
        agentId: 'unknown-agent',
        status: 'completed',
      });
      render(<AgentActionTimelineItem run={run} />);
      expect(screen.getByText('unknown-agent Agent')).toBeDefined();
    });
  });
});
