import type { AgentRun, AgentProposal, AgentRunStatus } from './agents';

export interface TrustBlockOutput {
  decision: string;
  reason: string;
}

export type ApprovalQueueItem =
  | { proposalType: 'agent_proposal'; run: AgentRun; proposal: AgentProposal }
  | { proposalType: 'trust_blocked'; run: AgentRun; block: TrustBlockOutput };

export interface ApprovalResult {
  runId: string;
  newStatus: AgentRunStatus;
  alreadyProcessed?: boolean;
}

export interface BatchActionResult {
  succeeded: Array<{ runId: string; newStatus: AgentRunStatus }>;
  failed: Array<{ runId: string; error: string }>;
}

type ParsedProposal = {
  proposalType: 'agent_proposal';
  proposal: AgentProposal;
};

type ParsedBlock = {
  proposalType: 'trust_blocked';
  block: TrustBlockOutput;
};

export type ParsedApprovalOutput = ParsedProposal | ParsedBlock | null;

export function parseApprovalOutput(output: Record<string, unknown> | null): ParsedApprovalOutput {
  if (!output) return null;
  const hasProposalFields = typeof output.confidence === 'number' && typeof output.title === 'string';
  if (hasProposalFields) {
    return {
      proposalType: 'agent_proposal',
      proposal: {
        title: output.title as string,
        confidence: output.confidence as number,
        riskLevel: (output.riskLevel as 'low' | 'medium' | 'high') ?? 'medium',
        reasoning: (output.reasoning as string) ?? '',
      },
    };
  }
  const hasBlockFields = typeof output.decision === 'string' && typeof output.reason === 'string';
  if (hasBlockFields) {
    return {
      proposalType: 'trust_blocked',
      block: { decision: output.decision as string, reason: output.reason as string },
    };
  }
  return null;
}

export function parseApprovalOutputWithRun(
  output: Record<string, unknown> | null,
  run: AgentRun,
): ApprovalQueueItem | null {
  const parsed = parseApprovalOutput(output);
  if (!parsed) return null;
  if (parsed.proposalType === 'agent_proposal') {
    return { proposalType: 'agent_proposal', run, proposal: parsed.proposal };
  }
  return { proposalType: 'trust_blocked', run, block: parsed.block };
}
