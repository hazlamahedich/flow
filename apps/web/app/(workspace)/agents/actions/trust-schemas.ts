import { z } from 'zod';

export const UpgradeTrustSchema = z.object({
  matrixEntryId: z.string().uuid(),
  fromLevel: z.enum(['supervised', 'confirm', 'auto']),
  toLevel: z.enum(['supervised', 'confirm', 'auto']),
  expectedVersion: z.number().int().min(1),
});

export const DowngradeTrustSchema = z.object({
  matrixEntryId: z.string().uuid(),
  fromLevel: z.enum(['supervised', 'confirm', 'auto']),
  toLevel: z.enum(['supervised', 'confirm', 'auto']),
  expectedVersion: z.number().int().min(1),
  triggerType: z.enum(['soft_violation', 'hard_violation', 'manual_override']),
  triggerReason: z.string().min(1),
});

export const UndoRegressionSchema = z.object({
  transitionId: z.string().uuid(),
  matrixEntryId: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
});

export const AcknowledgeRegressionSchema = z.object({
  transitionId: z.string().uuid(),
});

export type UpgradeTrustInput = z.infer<typeof UpgradeTrustSchema>;
export type DowngradeTrustInput = z.infer<typeof DowngradeTrustSchema>;
export type UndoRegressionInput = z.infer<typeof UndoRegressionSchema>;
export type AcknowledgeRegressionInput = z.infer<typeof AcknowledgeRegressionSchema>;
