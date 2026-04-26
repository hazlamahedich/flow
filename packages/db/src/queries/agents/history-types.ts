import type { AgentId, AgentRun, AgentRunStatus } from '@flow/types';

export interface ActionHistoryFilters {
  agentId?: string | undefined;
  status?: AgentRunStatus | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  clientId?: string | undefined;
  page?: number | undefined;
}

export interface FeedbackRow {
  id: string;
  sentiment: 'positive' | 'negative';
  note: string | null;
  createdAt: string;
}

export interface ActionHistoryRow extends AgentRun {
  feedback: FeedbackRow | null;
}

export interface CoordinationGroup {
  correlationId: string;
  signalCount: number;
  runCount: number;
  agents: AgentId[];
  firstCreatedAt: string;
  lastCompletedAt: string | null;
  runs: ActionHistoryRow[];
  initiatorAgentId: string | null;
}

export interface AgentRunError {
  code: string;
  entity: string | undefined;
  resolution: string | undefined;
  retryable: boolean;
}

export interface CorrectionInfo {
  originalRunId: string;
  correctedRunId: string;
  status: string;
  depth: number;
}
