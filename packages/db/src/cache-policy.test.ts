import { describe, it, expect } from 'vitest';
import {
  getRevalidationTags,
  invalidateAfterMutation,
} from './cache-policy';

describe('getRevalidationTags', () => {
  it('returns base tags without tenantId', () => {
    const tags = getRevalidationTags('workspace', 'create');
    expect(tags).toEqual(['workspaces']);
  });

  it('returns tenant-scoped tags with tenantId', () => {
    const tags = getRevalidationTags('workspace', 'create', 'tenant-123');
    expect(tags).toEqual(['workspaces', 'workspaces:tenant-123']);
  });

  it('adds list tags for delete mutation', () => {
    const tags = getRevalidationTags('workspace', 'delete', 'tenant-123');
    expect(tags).toContain('workspaces:list');
    expect(tags).toContain('workspaces:list:tenant-123');
  });

  it('does not add list tags for app_config delete', () => {
    const tags = getRevalidationTags('app_config', 'delete');
    expect(tags).not.toContain('app_configs:list');
  });

  it('returns correct tags for update', () => {
    const tags = getRevalidationTags('user', 'update', 't1');
    expect(tags).toEqual(['users', 'users:t1']);
  });
});

describe('invalidateAfterMutation', () => {
  it('delegates to getRevalidationTags', () => {
    const result = invalidateAfterMutation('audit_log', 'create', 'ws-1');
    expect(result).toEqual(['audit_logs', 'audit_logs:ws-1']);
  });
});
