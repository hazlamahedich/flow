import { z } from 'zod';

export type AgentId =
  | 'inbox'
  | 'calendar'
  | 'ar-collection'
  | 'weekly-report'
  | 'client-health'
  | 'time-integrity';

export const agentIdSchema = z.enum([
  'inbox',
  'calendar',
  'ar-collection',
  'weekly-report',
  'client-health',
  'time-integrity',
]);

export type AgentRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'cancelled';

export const agentRunStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'timed_out',
  'cancelled',
]);

export interface AgentRun {
  id: string;
  workspaceId: string;
  agentId: AgentId;
  jobId: string;
  signalId: string | null;
  actionType: string;
  clientId: string | null;
  idempotencyKey: string | null;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  trustTierAtExecution: string | null;
  correlationId: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const agentRunSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  agentId: agentIdSchema,
  jobId: z.string(),
  signalId: z.string().uuid().nullable(),
  actionType: z.string(),
  clientId: z.string().uuid().nullable(),
  idempotencyKey: z.string().nullable(),
  status: agentRunStatusSchema,
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).nullable(),
  error: z.record(z.unknown()).nullable(),
  trustTierAtExecution: z.string().nullable(),
  correlationId: z.string().uuid(),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export interface AgentSignal {
  id: string;
  correlationId: string;
  causationId: string | null;
  agentId: AgentId;
  signalType: string;
  version: number;
  payload: Record<string, unknown>;
  targetAgent: AgentId | null;
  clientId: string | null;
  workspaceId: string;
  createdAt: string;
}

export const agentSignalSchema = z.object({
  id: z.string().uuid(),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().nullable(),
  agentId: agentIdSchema,
  signalType: z.string().regex(/^[a-z-]+\.[a-z]+\.[a-z]+$/),
  version: z.number().int().min(1),
  payload: z.record(z.unknown()),
  targetAgent: agentIdSchema.nullable(),
  clientId: z.string().uuid().nullable(),
  workspaceId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
});

export interface AgentProposal {
  title: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
}

export const agentProposalSchema = z.object({
  title: z.string().min(1),
  confidence: z.number().min(0).max(1),
  riskLevel: z.enum(['low', 'medium', 'high']),
  reasoning: z.string().min(1),
});

export interface AgentRunRequest {
  agentId: AgentId;
  actionType: string;
  input: Record<string, unknown>;
  clientId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  signalId?: string;
}

export interface AgentRunHandle {
  runId: string;
  status: AgentRunStatus;
}

export interface AgentRunResult {
  output: Record<string, unknown>;
  trustTierAtExecution?: string;
}

export interface RunListFilter {
  agentId?: AgentId;
  status?: AgentRunStatus;
  limit?: number;
  offset?: number;
}

export interface AgentRunSummary {
  id: string;
  agentId: AgentId;
  actionType: string;
  status: AgentRunStatus;
  createdAt: string;
  updatedAt: string;
}

export const VALID_RUN_TRANSITIONS = {
  queued: ['running', 'failed', 'cancelled'] as const,
  running: ['completed', 'waiting_approval', 'failed', 'timed_out', 'cancelled'] as const,
  waiting_approval: ['completed', 'failed', 'timed_out', 'cancelled'] as const,
  completed: [] as const,
  failed: [] as const,
  timed_out: [] as const,
  cancelled: [] as const,
} as const satisfies Record<AgentRunStatus, readonly AgentRunStatus[]>;

export const signalTypePattern = /^[a-z-]+\.[a-z]+\.[a-z]+$/;
