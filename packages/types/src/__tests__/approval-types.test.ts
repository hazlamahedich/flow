import { describe, it, expect } from 'vitest';
import { parseApprovalOutput, parseApprovalOutputWithRun } from '../approval-types';

const mockRun = {
  id: 'r1',
  workspaceId: 'ws1',
  agentId: 'inbox' as const,
  jobId: 'j1',
  signalId: null,
  actionType: 'test',
  clientId: null,
  idempotencyKey: null,
  status: 'waiting_approval' as const,
  input: {},
  output: null,
  error: null,
  trustTierAtExecution: null,
  trustSnapshotId: null,
  correlationId: 'c1',
  startedAt: null,
  completedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('parseApprovalOutput', () => {
  it('returns null for null output', () => {
    expect(parseApprovalOutput(null)).toBeNull();
  });

  it('parses agent proposal', () => {
    const result = parseApprovalOutput({
      title: 'Follow up with client',
      confidence: 0.9,
      riskLevel: 'low',
      reasoning: 'Client responded to email',
    });

    expect(result).not.toBeNull();
    expect(result!.proposalType).toBe('agent_proposal');
    if (result!.proposalType === 'agent_proposal') {
      expect(result!.proposal.title).toBe('Follow up with client');
      expect(result!.proposal.confidence).toBe(0.9);
    }
  });

  it('parses trust blocked', () => {
    const result = parseApprovalOutput({
      decision: 'blocked',
      reason: 'Agent trust level too low',
    });

    expect(result).not.toBeNull();
    expect(result!.proposalType).toBe('trust_blocked');
    if (result!.proposalType === 'trust_blocked') {
      expect(result!.block.decision).toBe('blocked');
      expect(result!.block.reason).toBe('Agent trust level too low');
    }
  });

  it('returns null for unrecognized shape', () => {
    expect(parseApprovalOutput({ foo: 'bar' })).toBeNull();
  });

  it('agent proposal takes precedence over trust block when both fields present', () => {
    const result = parseApprovalOutput({
      title: 'Test',
      confidence: 0.5,
      decision: 'blocked',
      reason: 'Low trust',
    });

    expect(result!.proposalType).toBe('agent_proposal');
  });
});

describe('parseApprovalOutputWithRun', () => {
  it('returns item with run attached', () => {
    const result = parseApprovalOutputWithRun(
      { title: 'Test', confidence: 0.9, riskLevel: 'low', reasoning: 'R' },
      mockRun,
    );

    expect(result).not.toBeNull();
    expect(result!.run.id).toBe('r1');
    if (result!.proposalType === 'agent_proposal') {
      expect(result!.proposal.title).toBe('Test');
    }
  });

  it('returns null for null output', () => {
    expect(parseApprovalOutputWithRun(null, mockRun)).toBeNull();
  });
});
