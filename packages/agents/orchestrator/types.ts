import type {
  AgentId,
  AgentRunRequest,
  AgentRunHandle,
  AgentRunStatus,
  AgentRunSummary,
  RunListFilter,
  AgentRunResult,
  AgentProposal,
  FlowError,
} from '@flow/types';

export interface AgentRunProducer {
  submit(request: AgentRunRequest): Promise<AgentRunHandle>;
  cancel(runId: string, reason: string): Promise<void>;
  getStatus(runId: string): Promise<AgentRunStatus>;
  listRuns(filter: RunListFilter): Promise<AgentRunSummary[]>;
}

export interface AgentRunWorker {
  claim(agentType: AgentId): Promise<AgentRunHandle | null>;
  complete(runId: string, result: AgentRunResult): Promise<void>;
  fail(runId: string, error: FlowError): Promise<void>;
  propose(runId: string, proposal: AgentProposal): Promise<void>;
}
