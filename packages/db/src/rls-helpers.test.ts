import { describe, it, expect, vi } from 'vitest';
import {
  requireTenantContext,
  createFlowError,
} from './rls-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

function mockClient(userResponse: {
  data: { user: unknown } | null;
  error: unknown;
}): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(userResponse),
    },
  } as unknown as SupabaseClient;
}

describe('requireTenantContext', () => {
  it('returns context from valid JWT with workspace_id', async () => {
    const userId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const client = mockClient({
      data: {
        user: {
          id: userId,
          app_metadata: {
            workspace_id: workspaceId,
            role: 'owner',
          },
        },
      },
      error: null,
    });

    const ctx = await requireTenantContext(client);
    expect(ctx.workspaceId).toBe(workspaceId);
    expect(ctx.userId).toBe(userId);
    expect(ctx.role).toBe('owner');
  });

  it('throws FlowError 401 when no user', async () => {
    const client = mockClient({ data: { user: null }, error: new Error('no') });
    await expect(requireTenantContext(client)).rejects.toMatchObject({
      status: 401,
      code: 'AUTH_REQUIRED',
    });
  });

  it('throws FlowError 403 when workspace_id missing', async () => {
    const client = mockClient({
      data: { user: { id: crypto.randomUUID(), app_metadata: {} } },
      error: null,
    });
    await expect(requireTenantContext(client)).rejects.toMatchObject({
      status: 403,
      code: 'TENANT_CONTEXT_MISSING',
    });
  });

  it('throws FlowError 403 when workspace_id is malformed', async () => {
    const client = mockClient({
      data: {
        user: { id: crypto.randomUUID(), app_metadata: { workspace_id: 'not-a-uuid' } },
      },
      error: null,
    });
    await expect(requireTenantContext(client)).rejects.toMatchObject({
      status: 403,
      code: 'TENANT_CONTEXT_MISSING',
    });
  });

  it('throws FlowError 403 when role is missing', async () => {
    const client = mockClient({
      data: {
        user: {
          id: crypto.randomUUID(),
          app_metadata: { workspace_id: crypto.randomUUID() },
        },
      },
      error: null,
    });
    await expect(requireTenantContext(client)).rejects.toMatchObject({
      status: 403,
      code: 'TENANT_CONTEXT_MISSING',
    });
  });
});

describe('createFlowError', () => {
  it('creates error without details', () => {
    const err = createFlowError(403, 'TENANT_CONTEXT_MISSING', 'msg', 'auth');
    expect(err.status).toBe(403);
    expect(err.code).toBe('TENANT_CONTEXT_MISSING');
    expect(err.details).toBeUndefined();
  });

  it('creates error with details', () => {
    const err = createFlowError(400, 'VALIDATION_ERROR', 'bad', 'validation', {
      field: 'email',
    });
    expect(err.details).toEqual({ field: 'email' });
  });
});
