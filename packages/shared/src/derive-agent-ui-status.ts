import type { AgentBackendStatus, IntegrationHealth, AgentUIStatus, AgentContext } from '@flow/types';

export function deriveUIStatus(
  backend: AgentBackendStatus,
  ctx: AgentContext,
): AgentUIStatus {
  if (ctx.fetchError) return 'error-loading';
  if (ctx.isInitializing) return 'loading';
  if (backend === 'inactive' && !ctx.setupCompleted) return 'draft';
  if (backend === 'active' && ctx.integrationHealth === 'degraded') return 'degraded';
  if (backend === 'draining') return 'deactivating';
  return backend;
}
