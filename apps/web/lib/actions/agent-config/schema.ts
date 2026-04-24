import { z } from 'zod';
import { agentIdSchema } from '@flow/types';

export const activateAgentSchema = z.object({
  agentId: agentIdSchema,
  expectedVersion: z.number().int().min(0),
});

export const deactivateAgentSchema = z.object({
  agentId: agentIdSchema,
  expectedVersion: z.number().int().min(0),
});

export const updateAgentScheduleSchema = z.object({
  agentId: agentIdSchema,
  schedule: z.record(z.unknown()),
  expectedVersion: z.number().int().min(0),
});

export const updateAgentTriggerConfigSchema = z.object({
  agentId: agentIdSchema,
  triggerConfig: z.record(z.unknown()),
  expectedVersion: z.number().int().min(0),
});

export type ActivateAgentInput = z.infer<typeof activateAgentSchema>;
export type DeactivateAgentInput = z.infer<typeof deactivateAgentSchema>;
export type UpdateAgentScheduleInput = z.infer<typeof updateAgentScheduleSchema>;
export type UpdateAgentTriggerConfigInput = z.infer<typeof updateAgentTriggerConfigSchema>;
