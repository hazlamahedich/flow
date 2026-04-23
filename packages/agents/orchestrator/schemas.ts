import { z } from 'zod';
import { agentIdSchema } from '@flow/types';

export const AgentJobPayloadSchema = z.object({
  runId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  agentId: agentIdSchema,
  actionType: z.string().min(1),
  input: z.record(z.unknown()),
  clientId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
});

export type AgentJobPayload = z.infer<typeof AgentJobPayloadSchema>;
