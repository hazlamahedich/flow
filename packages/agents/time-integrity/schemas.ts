import { z } from 'zod';

export const GAP_THRESHOLD_MINUTES = 60;
export const LOW_HOURS_TARGET = 4;

// TODO(post-MVP): read from workspace_settings once workspace settings infrastructure exists

export type AnomalyType = 'gap' | 'overlap' | 'low-hours';

export interface AnomalySignal {
  anomalyType: AnomalyType;
  affectedEntryIds: string[];
  signalKey: string;
  payload: Record<string, unknown>;
}

export const anomalySignalSchema = z.object({
  anomalyType: z.enum(['gap', 'overlap', 'low-hours']),
  affectedEntryIds: z.array(z.string().uuid()),
  signalKey: z.string().min(1),
  payload: z.record(z.unknown()),
});

export interface TimeIntegrityInput {
  workspaceId: string;
  sweepDate: string;
}

export interface SweepResult {
  signalsCreated: number;
  skippedDuplicates: number;
}

export const timeIntegrityInputSchema = z.object({
  workspaceId: z.string().uuid(),
  sweepDate: z.string().date(),
});

// Legacy proposal type — retained for backward compatibility with existing exports
export interface TimeIntegrityProposal {
  anomalyType: AnomalyType;
  confidence: number;
  reasoning: string;
}

export const timeIntegrityProposalSchema = z.object({
  anomalyType: z.enum(['gap', 'overlap', 'low-hours']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
