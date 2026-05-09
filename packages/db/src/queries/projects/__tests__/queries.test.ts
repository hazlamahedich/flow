import { describe, it, expect, vi, beforeEach } from 'vitest';

const createChain = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  return chain;
};

const mockClient = {
  from: vi.fn(() => createChain()),
};

import { createProject, ProjectNameDuplicateError } from '../create';
import { listProjects } from '../list';

describe('createProject', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a project and returns mapped result', async () => {
    const chain = createChain();
    chain.single = vi.fn(() => Promise.resolve({
      data: {
        id: 'p1', workspace_id: 'ws1', client_id: 'c1', name: 'Project A',
        description: null, status: 'active', archived_at: null,
        created_at: '2026-05-09T00:00:00Z', updated_at: '2026-05-09T00:00:00Z',
      },
      error: null,
    }));
    mockClient.from = vi.fn(() => chain);

    const result = await createProject(mockClient as never, {
      workspaceId: 'ws1', clientId: 'c1', name: 'Project A',
    });
    expect(result.id).toBe('p1');
    expect(result.name).toBe('Project A');
  });

  it('throws ProjectNameDuplicateError on unique constraint violation', async () => {
    const chain = createChain();
    chain.single = vi.fn(() => Promise.resolve({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    }));
    mockClient.from = vi.fn(() => chain);

    await expect(createProject(mockClient as never, {
      workspaceId: 'ws1', clientId: 'c1', name: 'Duplicate',
    })).rejects.toThrow(ProjectNameDuplicateError);
  });
});

describe('createProject — constraint violations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('propagates check constraint for invalid status value', async () => {
    const chain = createChain();
    chain.single = vi.fn(() => Promise.resolve({
      data: null,
      error: { message: 'new row violates check constraint "projects_status_check"', code: '23514' },
    }));
    mockClient.from = vi.fn(() => chain);

    // The app layer passes status via insert; DB rejects an invalid value
    await expect(createProject(mockClient as never, {
      workspaceId: 'ws1', clientId: 'c1', name: 'Bad Status Project',
    })).rejects.toMatchObject({ code: '23514' });
  });

  it('propagates check constraint for archived_at consistency violation', async () => {
    // status='archived' without archived_at, or status='active' with archived_at
    const chain = createChain();
    chain.single = vi.fn(() => Promise.resolve({
      data: null,
      error: {
        message: 'new row violates check constraint "projects_status_archived_at_check"',
        code: '23514',
      },
    }));
    mockClient.from = vi.fn(() => chain);

    await expect(createProject(mockClient as never, {
      workspaceId: 'ws1', clientId: 'c1', name: 'Inconsistent Archived',
    })).rejects.toMatchObject({ code: '23514' });
  });
});

describe('listProjects', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns active projects sorted by name', async () => {
    const chain = createChain();
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => Promise.resolve({
      data: [
        { id: 'p1', workspace_id: 'ws1', client_id: 'c1', name: 'Alpha', description: null, status: 'active', archived_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
        { id: 'p2', workspace_id: 'ws1', client_id: 'c1', name: 'Beta', description: null, status: 'active', archived_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
      ],
      error: null,
    }));
    mockClient.from = vi.fn(() => chain);

    const result = await listProjects(mockClient as never, {
      workspaceId: 'ws1', clientId: 'c1',
    });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alpha');
  });
});
