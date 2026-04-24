export type AgentBackendStatus = 'inactive' | 'activating' | 'active' | 'draining' | 'suspended';

export type IntegrationHealth = 'healthy' | 'degraded' | 'disconnected';

export type AgentUIStatus =
  | 'loading'
  | 'error-loading'
  | 'draft'
  | 'inactive'
  | 'activating'
  | 'active'
  | 'degraded'
  | 'deactivating'
  | 'suspended';

export interface AgentContext {
  setupCompleted: boolean;
  integrationHealth: IntegrationHealth | null;
  isInitializing: boolean;
  fetchError: unknown;
}
