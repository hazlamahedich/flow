import { describe, test, expect, vi, beforeEach } from 'vitest';
import { execute } from '../src/executor';
import type { ClientHealthInput } from '../src/schemas';

const { mockCreateServiceClient, mockInsertSignal } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockInsertSignal: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  createServiceClient: mockCreateServiceClient,
  insertSignal: mockInsertSignal,
}));

const validInput: ClientHealthInput = {
  workspaceId: 'ba0e897a-391f-4739-b86a-e243cc05d4c8',
  clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
  snapshotDate: '2026-05-25',
  agentRunId: 'ba0e897a-391f-4739-b86a-e243cc05d4c7',
  trigger: 'cron',
};

function makeAutoResolvingChain(result: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(result);
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    [Symbol.toStringTag]: 'Promise',
  };
  return chain;
}

describe('Client Health Agent — execute Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('computes health snapshot with healthy scores for active client', async () => {
    const from = vi.fn((table: string) => {
      const mocks: Record<string, { data: unknown; error: unknown }> = {
        time_entries: { data: [{ duration_minutes: 600 }], error: null },
        inbox_emails: {
          data: [
            { id: 'e1' },
            { id: 'e2' },
            { id: 'e3' },
            { id: 'e4' },
            { id: 'e5' },
          ],
          error: null,
        },
        invoices: { data: [], error: null },
        clients: {
          data: { id: 'cli-1', created_at: '2025-01-01T00:00:00Z' },
          error: null,
        },
        client_health_snapshots: { data: null, error: null },
      };
      return makeAutoResolvingChain(mocks[table] ?? { data: [], error: null });
    });

    const rpc = vi.fn().mockResolvedValue({ data: 'snap-1', error: null });
    mockCreateServiceClient.mockReturnValue({ from, rpc });
    mockInsertSignal.mockResolvedValue({ id: 'sig-1' });

    const result = await execute(validInput);
    expect(result.snapshotId).toBe('snap-1');
    expect(result.overallHealth).toBe('healthy');
    expect(result.engagementScore).toBeGreaterThanOrEqual(60);
    expect(result.engagementScore).toBeLessThanOrEqual(100);
  });

  test('returns payment 100 for client with zero invoices', async () => {
    const from = vi.fn((table: string) => {
      const mocks: Record<string, { data: unknown; error: unknown }> = {
        time_entries: { data: [], error: null },
        inbox_emails: { data: [], error: null },
        invoices: { data: [], error: null },
        clients: {
          data: { id: 'cli-1', created_at: '2025-01-01T00:00:00Z' },
          error: null,
        },
        client_health_snapshots: { data: null, error: null },
      };
      return makeAutoResolvingChain(mocks[table] ?? { data: [], error: null });
    });

    const rpc = vi.fn().mockResolvedValue({ data: 'snap-2', error: null });
    mockCreateServiceClient.mockReturnValue({ from, rpc });

    const result = await execute(validInput);
    expect(result.paymentScore).toBe(100);
  });

  test('emits signal when health status changes from previous snapshot', async () => {
    const from = vi.fn((table: string) => {
      const mocks: Record<string, { data: unknown; error: unknown }> = {
        time_entries: { data: [{ duration_minutes: 120 }], error: null },
        inbox_emails: { data: [{ id: 'e1' }], error: null },
        invoices: {
          data: [{ status: 'overdue', due_date: '2026-01-01', paid_at: null }],
          error: null,
        },
        clients: {
          data: { id: 'cli-1', created_at: '2025-01-01T00:00:00Z' },
          error: null,
        },
        client_health_snapshots: {
          data: { overall_health: 'healthy' },
          error: null,
        },
      };
      return makeAutoResolvingChain(mocks[table] ?? { data: [], error: null });
    });

    const rpc = vi.fn().mockResolvedValue({ data: 'snap-3', error: null });
    mockCreateServiceClient.mockReturnValue({ from, rpc });
    mockInsertSignal.mockResolvedValue({ id: 'sig-1' });

    const result = await execute(validInput);
    expect(result.signalEmitted).toBe(true);
    expect(mockInsertSignal).toHaveBeenCalledTimes(1);
  });

  test('no signal emitted when health is unchanged', async () => {
    const from = vi.fn((table: string) => {
      const mocks: Record<string, { data: unknown; error: unknown }> = {
        time_entries: { data: [{ duration_minutes: 600 }], error: null },
        inbox_emails: {
          data: [
            { id: 'e1' },
            { id: 'e2' },
            { id: 'e3' },
            { id: 'e4' },
            { id: 'e5' },
          ],
          error: null,
        },
        invoices: { data: [], error: null },
        clients: {
          data: { id: 'cli-1', created_at: '2025-01-01T00:00:00Z' },
          error: null,
        },
        client_health_snapshots: {
          data: { overall_health: 'healthy' },
          error: null,
        },
      };
      return makeAutoResolvingChain(mocks[table] ?? { data: [], error: null });
    });

    const rpc = vi.fn().mockResolvedValue({ data: 'snap-4', error: null });
    mockCreateServiceClient.mockReturnValue({ from, rpc });

    const result = await execute(validInput);
    expect(result.signalEmitted).toBe(false);
    expect(mockInsertSignal).not.toHaveBeenCalled();
  });

  test('skips client gracefully on DB query error', async () => {
    const from = vi.fn(() => {
      throw new Error('DB connection failed');
    });
    const rpc = vi.fn();
    mockCreateServiceClient.mockReturnValue({ from, rpc });

    await expect(execute(validInput)).rejects.toThrow('DB connection failed');
  });
});
