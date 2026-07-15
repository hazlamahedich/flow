import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (
    status: number,
    code: string,
    message: string,
    category: string,
  ) => ({
    status,
    code,
    message,
    category,
  }),
  createTimeEntry: vi.fn(),
  softDeleteTimeEntry: vi.fn(),
  createProject: vi.fn(),
  ProjectNameDuplicateError: class extends Error {
    constructor() {
      super('duplicate');
      this.name = 'ProjectNameDuplicateError';
    }
  },
  getTimerState: vi.fn(),
  startTimer: vi.fn(),
  stopTimerRpc: vi.fn(),
  listClients: vi.fn(),
}));

import { createTimeEntryAction } from '../create-time-entry';
import { softDeleteTimeEntryAction } from '../soft-delete-time-entry';
import { createProjectAction } from '../create-project';
import {
  startTimerAction,
  stopTimerAction,
  getTimerStateAction,
} from '../timer-actions';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createTimeEntry,
  softDeleteTimeEntry,
  createProject,
  getTimerState,
  startTimer,
  stopTimerRpc,
} from '@flow/db';

const clientSelectChain = {
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null }),
};
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue(clientSelectChain),
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as never);
  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws1',
    userId: 'u1',
    role: 'owner',
  } as never);
});

describe('createTimeEntryAction', () => {
  it('returns validation error for durationMinutes = 0', async () => {
    const result = await createTimeEntryAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      projectId: null,
      date: '2026-05-09',
      durationMinutes: 0,
    });
    expect(result.success).toBe(false);
  });

  it('returns validation error for durationMinutes = 1441', async () => {
    const result = await createTimeEntryAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      projectId: null,
      date: '2026-05-09',
      durationMinutes: 1441,
    });
    expect(result.success).toBe(false);
  });

  it('returns validation error for missing clientId', async () => {
    const result = await createTimeEntryAction({
      clientId: '',
      projectId: null,
      date: '2026-05-09',
      durationMinutes: 60,
    });
    expect(result.success).toBe(false);
  });

  it('returns created entry on success', async () => {
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'te1',
      workspaceId: 'ws1',
      clientId: 'c1',
      userId: 'u1',
      projectId: null,
      date: '2026-05-09',
      durationMinutes: 90,
      notes: null,
      deletedAt: null,
      createdAt: '2026-05-09',
      updatedAt: '2026-05-09',
    } as never);

    const result = await createTimeEntryAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      projectId: null,
      date: '2026-05-09',
      durationMinutes: 90,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('te1');
    }
  });
});

describe('softDeleteTimeEntryAction', () => {
  it('returns success on own entry delete', async () => {
    vi.mocked(softDeleteTimeEntry).mockResolvedValue(true as never);
    const result = await softDeleteTimeEntryAction({
      id: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('returns validation error for invalid id', async () => {
    const result = await softDeleteTimeEntryAction({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('createProjectAction', () => {
  it('returns created project on success', async () => {
    vi.mocked(createProject).mockResolvedValue({
      id: 'p1',
      workspaceId: 'ws1',
      clientId: 'c1',
      name: 'Test',
      description: null,
      status: 'active',
      archivedAt: null,
      createdAt: '2026-05-09',
      updatedAt: '2026-05-09',
    } as never);

    const result = await createProjectAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      name: 'Test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test');
    }
  });

  it('returns CONFLICT error for duplicate project name', async () => {
    const { ProjectNameDuplicateError: Err } = await import('@flow/db');
    vi.mocked(createProject).mockRejectedValue(new Err());

    const result = await createProjectAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      name: 'Duplicate',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFLICT');
    }
  });
});

const mockTimerState = {
  id: 't1',
  workspaceId: 'ws1',
  userId: 'u1',
  clientId: 'c1',
  clientName: 'Acme',
  projectId: null,
  projectName: null,
  notes: null,
  startedAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:00:00Z',
};

describe('startTimerAction', () => {
  it('returns validation error for missing clientId', async () => {
    const result = await startTimerAction({ clientId: '', projectId: null });
    expect(result.success).toBe(false);
  });

  it('returns validation error for invalid clientId', async () => {
    const result = await startTimerAction({
      clientId: 'not-a-uuid',
      projectId: null,
    });
    expect(result.success).toBe(false);
  });

  it('returns timer state on success', async () => {
    vi.mocked(startTimer).mockResolvedValue(mockTimerState as never);
    const result = await startTimerAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      projectId: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('t1');
    }
  });

  it('returns TIMER_ALREADY_RUNNING on unique constraint violation', async () => {
    const pgError = new Error('unique violation') as Error & { code: string };
    pgError.code = '23505';
    vi.mocked(startTimer).mockRejectedValue(pgError);

    const result = await startTimerAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      projectId: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('TIMER_ALREADY_RUNNING');
    }
  });

  it('returns internal error on unexpected failure', async () => {
    vi.mocked(startTimer).mockRejectedValue(new Error('db down'));

    const result = await startTimerAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      projectId: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });
});

describe('stopTimerAction', () => {
  it('returns validation error for invalid timerId', async () => {
    const result = await stopTimerAction({ timerId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('returns result on success', async () => {
    vi.mocked(stopTimerRpc).mockResolvedValue({
      timeEntryId: 'te1',
      durationMinutes: 30,
    } as never);
    const result = await stopTimerAction({
      timerId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeEntryId).toBe('te1');
      expect(result.data.durationMinutes).toBe(30);
    }
  });

  it('returns TIMER_NOT_FOUND when RPC returns not found', async () => {
    const rpcError = new Error('TIMER_NOT_FOUND') as Error & { code: string };
    rpcError.code = 'TIMER_NOT_FOUND';
    vi.mocked(stopTimerRpc).mockRejectedValue(rpcError);

    const result = await stopTimerAction({
      timerId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('TIMER_NOT_FOUND');
    }
  });
});

describe('getTimerStateAction', () => {
  it('returns timer state when active', async () => {
    vi.mocked(getTimerState).mockResolvedValue(mockTimerState as never);
    const result = await getTimerStateAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(mockTimerState);
    }
  });

  it('returns null when no active timer', async () => {
    vi.mocked(getTimerState).mockResolvedValue(null as never);
    const result = await getTimerStateAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it('returns null on error (graceful fallback)', async () => {
    vi.mocked(getTimerState).mockRejectedValue(new Error('fail'));
    const result = await getTimerStateAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });
});
