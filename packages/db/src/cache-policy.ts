export type CacheEntity =
  | 'workspace'
  | 'workspace_member'
  | 'workspace_invitation'
  | 'workspace_session'
  | 'workspace_client'
  | 'user'
  | 'audit_log'
  | 'app_config'
  | 'dashboard'
  | 'agent_configuration'
  | 'trust_matrix'
  | 'trust_preconditions'
  | 'agent_feedback'
  | 'agent_runs_history';

export type CacheMutation = 'create' | 'update' | 'delete';

const ENTITY_TAG_MAP: Record<CacheEntity, string> = {
  workspace: 'workspaces',
  workspace_member: 'workspace-members',
  workspace_invitation: 'workspace-invitations',
  workspace_session: 'workspace-sessions',
  workspace_client: 'workspace-clients',
  user: 'users',
  audit_log: 'audit_logs',
  app_config: 'app_config',
  dashboard: 'dashboard',
  agent_configuration: 'agents',
  trust_matrix: 'trust',
  trust_preconditions: 'trust',
  agent_feedback: 'agent-activity',
  agent_runs_history: 'agent-activity',
};

export function cacheTag(
  entity: CacheEntity,
  id: string,
): string {
  const prefix = ENTITY_TAG_MAP[entity];
  return `${prefix}:${id}`;
}

export function getRevalidationTags(
  entity: CacheEntity,
  mutation: CacheMutation,
  tenantId?: string,
): string[] {
  const tag = ENTITY_TAG_MAP[entity];
  const tags: string[] = [tag];

  if (tenantId) {
    tags.push(`${tag}:${tenantId}`);
  }

  if (mutation === 'delete' && entity !== 'app_config') {
    tags.push(`${tag}:list`);
    if (tenantId) {
      tags.push(`${tag}:list:${tenantId}`);
    }
  }

  return tags;
}

export function invalidateAfterMutation(
  entity: CacheEntity,
  mutation: CacheMutation,
  tenantId?: string,
): string[] {
  return getRevalidationTags(entity, mutation, tenantId);
}
