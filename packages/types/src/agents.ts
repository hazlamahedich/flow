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

export const agentRunSourceValues = ['agent', 'human_correction'] as const;
export type AgentRunSource = typeof agentRunSourceValues[number];

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
  trustSnapshotId: string | null;
  correlationId: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  correctedRunId: string | null; correctionDepth: number;
  correctionIssued: boolean; source: AgentRunSource;
}

export const agentRunSchema = z.object({
  id: z.string().uuid(), workspaceId: z.string().uuid(), agentId: agentIdSchema,
  jobId: z.string(), signalId: z.string().uuid().nullable(), actionType: z.string(),
  clientId: z.string().uuid().nullable(), idempotencyKey: z.string().nullable(),
  status: agentRunStatusSchema, input: z.record(z.unknown()),
  output: z.record(z.unknown()).nullable(), error: z.record(z.unknown()).nullable(),
  trustTierAtExecution: z.string().nullable(), trustSnapshotId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(), startedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }),
  correctedRunId: z.string().uuid().nullable(), correctionDepth: z.number().int().min(0).max(5),
  correctionIssued: z.boolean(), source: z.enum(agentRunSourceValues),
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
  waiting_approval: ['completed', 'running', 'failed', 'timed_out', 'cancelled'] as const,
  completed: [] as const,
  failed: [] as const,
  timed_out: [] as const,
  cancelled: [] as const,
} as const satisfies Record<AgentRunStatus, readonly AgentRunStatus[]>;

export const signalTypePattern = /^[a-z-]+\.[a-z]+\.[a-z]+$/;

export type AgentScheduleConfig =
  | { type: 'always'; timezone: string }
  | { type: 'business_hours'; timezone: string; days: number[]; startHour: number; endHour: number }
  | { type: 'custom'; cron: string; timezone: string }
  | { type: 'manual' };

export const agentScheduleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('always'), timezone: z.string() }),
  z.object({
    type: z.literal('business_hours'),
    timezone: z.string(),
    days: z.array(z.number().int().min(0).max(6)),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
  }),
  z.object({ type: z.literal('custom'), cron: z.string(), timezone: z.string() }),
  z.object({ type: z.literal('manual') }),
]);

export interface AgentTriggerConfig {
  onNewEmail?: boolean;
  onScheduleConflict?: boolean;
  onInvoiceOverdue?: { daysOverdue: number };
  onRetainerThreshold?: { percentage: number };
}

export const agentTriggerConfigSchema = z.object({
  onNewEmail: z.boolean().optional(),
  onScheduleConflict: z.boolean().optional(),
  onInvoiceOverdue: z.object({ daysOverdue: z.number().int().min(1) }).optional(),
  onRetainerThreshold: z.object({ percentage: z.number().min(0).max(100) }).optional(),
});

export interface AgentLLMPreferences {
  preferredProvider?: 'groq' | 'anthropic' | 'gemini';
  qualityMode?: 'fast' | 'quality';
}

export const agentLLMPreferencesSchema = z.object({
  preferredProvider: z.enum(['groq', 'anthropic', 'gemini']).optional(),
  qualityMode: z.enum(['fast', 'quality']).optional(),
});

export type { TrustBlockOutput, ApprovalQueueItem, ApprovalResult, BatchActionResult, parseApprovalOutput, parseApprovalOutputWithRun } from './approval-types';
