import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('pg-boss', () => ({
  PgBoss: vi.fn().mockImplementation(() => ({
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    on: vi.fn(),
    send: vi.fn(),
    fetch: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    cancel: vi.fn(),
    getJobById: vi.fn(),
  })),
}));

vi.mock('@flow/db', () => ({
  findStaleRuns: vi.fn(async () => []),
  updateRunStatus: vi.fn(),
}));

vi.mock('../shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

import { createOrchestrator } from '../orchestrator/factory';

describe('Orchestrator Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, DATABASE_URL: 'postgresql://test:test@localhost/test' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates orchestrator with producer and worker', () => {
    const orch = createOrchestrator();
    expect(orch.producer).toBeDefined();
    expect(orch.worker).toBeDefined();
    expect(typeof orch.start).toBe('function');
    expect(typeof orch.stop).toBe('function');
  });

  it('start succeeds and registers event handlers', async () => {
    const orch = createOrchestrator();
    await orch.start();
    const { PgBoss } = await import('pg-boss');
    const instance = (PgBoss as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (instance) {
      expect(instance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(instance.on).toHaveBeenCalledWith('warning', expect.any(Function));
    }
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => createOrchestrator()).toThrow('DATABASE_URL');
  });

  it('stop calls boss.stop with graceful options', async () => {
    const orch = createOrchestrator();
    await orch.start();
    await orch.stop();
    const { PgBoss } = await import('pg-boss');
    const instance = (PgBoss as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (instance) {
      expect(instance.stop).toHaveBeenCalledWith({ graceful: true, timeout: 30_000 });
    }
  });

  it('start registers SIGTERM handler', async () => {
    const orch = createOrchestrator();
    const spy = vi.spyOn(process, 'on');
    await orch.start();
    expect(spy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    spy.mockRestore();
  });

  it('start registers SIGINT handler', async () => {
    const orch = createOrchestrator();
    const spy = vi.spyOn(process, 'on');
    await orch.start();
    expect(spy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    spy.mockRestore();
  });
});
