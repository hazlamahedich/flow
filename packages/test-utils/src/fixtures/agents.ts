import type { AgentId, AgentRun, AgentProposal, ApprovalQueueItem } from '@flow/types';

interface AgentRunOverrides {
  id?: string;
  workspaceId?: string;
  agentId?: AgentId;
  status?: AgentRun['status'];
  output?: Record<string, unknown> | null;
  trustSnapshotId?: string | null;
}

export function buildAgentRun(overrides: AgentRunOverrides = {}): AgentRun {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    workspaceId: overrides.workspaceId ?? crypto.randomUUID(),
    agentId: overrides.agentId ?? 'inbox',
    jobId: `job-${id.slice(0, 8)}`,
    signalId: null,
    actionType: 'test-action',
    clientId: null,
    idempotencyKey: null,
    status: overrides.status ?? 'waiting_approval',
    input: {},
    output: overrides.output ?? null,
    error: null,
    trustTierAtExecution: null,
    trustSnapshotId: overrides.trustSnapshotId ?? null,
    correlationId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildAgentProposal(overrides: Partial<AgentProposal> = {}): AgentProposal {
  return {
    title: overrides.title ?? 'Test Proposal',
    confidence: overrides.confidence ?? 0.85,
    riskLevel: overrides.riskLevel ?? 'low',
    reasoning: overrides.reasoning ?? 'Test reasoning for the proposal',
  };
}

export function buildApprovalQueueItem(
  overrides: {
    proposalType?: 'agent_proposal' | 'trust_blocked';
    runOverrides?: AgentRunOverrides;
    proposalOverrides?: Partial<AgentProposal>;
    blockOverrides?: { decision?: string; reason?: string };
  } = {},
): ApprovalQueueItem {
  const proposalType = overrides.proposalType ?? 'agent_proposal';
  const run = buildAgentRun({
    status: 'waiting_approval',
    ...overrides.runOverrides,
  });

  if (proposalType === 'agent_proposal') {
    const proposal = buildAgentProposal(overrides.proposalOverrides);
    return {
      proposalType: 'agent_proposal',
      run: { ...run, output: { ...proposal } },
      proposal,
    };
  }

  const block = {
    decision: overrides.blockOverrides?.decision ?? 'blocked',
    reason: overrides.blockOverrides?.reason ?? 'Agent trust level too low for autonomous execution',
  };
  return {
    proposalType: 'trust_blocked',
    run: { ...run, output: { ...block } },
    block,
  };
}

export function buildBatchApprovalItems(
  count: number,
  overrides: {
    proposalType?: 'agent_proposal' | 'trust_blocked';
    runOverrides?: AgentRunOverrides;
  } = {},
): ApprovalQueueItem[] {
  return Array.from({ length: count }, () =>
    buildApprovalQueueItem({
      ...(overrides.proposalType != null ? { proposalType: overrides.proposalType } : {}),
      ...(overrides.runOverrides != null ? { runOverrides: overrides.runOverrides } : {}),
    }),
  );
}

export function buildTimedOutItem(
  overrides: AgentRunOverrides = {},
): ApprovalQueueItem {
  return buildApprovalQueueItem({
    proposalType: 'agent_proposal',
    runOverrides: { status: 'timed_out', ...overrides },
  });
}
