export type CacheEntity =
  | 'workspace'
  | 'workspace_member'
  | 'user'
  | 'audit_log'
  | 'app_config';

export type CacheMutation = 'create' | 'update' | 'delete';

const ENTITY_TAG_MAP: Record<CacheEntity, string> = {
  workspace: 'workspaces',
  workspace_member: 'workspace_members',
  user: 'users',
  audit_log: 'audit_logs',
  app_config: 'app_config',
};

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
