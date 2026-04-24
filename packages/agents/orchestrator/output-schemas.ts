import type { AgentId } from '@flow/types';
import { z } from 'zod';
import { writeAuditLog } from '../shared/audit-writer';

export interface OutputSchemaRegistry {
  register(agentId: AgentId, actionType: string, schema: z.ZodType): void;
  get(agentId: AgentId, actionType: string): z.ZodType | null;
  validateActiveAgents(activeAgentIds: AgentId[]): void;
}

export function createOutputSchemaRegistry(): OutputSchemaRegistry {
  const schemas = new Map<string, z.ZodType>();
  const registeredActions = new Map<string, Set<string>>();

  const key = (agentId: AgentId, actionType: string) => `${agentId}:${actionType}`;

  return {
    register(agentId: AgentId, actionType: string, schema: z.ZodType): void {
      const k = key(agentId, actionType);
      schemas.set(k, schema);
      let actions = registeredActions.get(agentId);
      if (!actions) {
        actions = new Set();
        registeredActions.set(agentId, actions);
      }
      actions.add(actionType);
    },

    get(agentId: AgentId, actionType: string): z.ZodType | null {
      return schemas.get(key(agentId, actionType)) ?? null;
    },

    validateActiveAgents(activeAgentIds: AgentId[]): void {
      for (const agentId of activeAgentIds) {
        const actions = registeredActions.get(agentId);
        if (!actions || actions.size === 0) {
          writeAuditLog({
            workspaceId: '',
            agentId,
            action: 'gate_schema_missing_total',
            entityType: 'orchestrator',
            details: {
              metric: `gate_schema_missing_total{agentId="${agentId}"}`,
              message: `No output schemas registered for active agent`,
              agentId,
            },
          });
        }
      }
    },
  };
}

export function registerMvpSchemas(registry: OutputSchemaRegistry): void {
  const mvpAgents: AgentId[] = [
    'inbox',
    'calendar',
    'ar-collection',
    'weekly-report',
    'client-health',
    'time-integrity',
  ];
  const mvpActions = ['execute'];
  const passthrough = z.object({}).passthrough();

  for (const agentId of mvpAgents) {
    for (const actionType of mvpActions) {
      registry.register(agentId, actionType, passthrough);
    }
  }
}
