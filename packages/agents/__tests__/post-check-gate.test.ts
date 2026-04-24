import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrustClient } from '@flow/trust';
import { runPostCheck } from '../orchestrator/post-check';
import { createOutputSchemaRegistry } from '../orchestrator/output-schemas';
import { z } from 'zod';

vi.mock('@flow/db', () => ({
  getRunById: vi.fn(),
}));

vi.mock('../shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

function makeTrustClient(): TrustClient {
  return {
    canAct: vi.fn(),
    recordSuccess: vi.fn(),
    recordViolation: vi.fn(),
    recordPrecheckFailure: vi.fn(),
    manualOverride: vi.fn(),
  };
}

describe('runPostCheck', () => {
  let registry: ReturnType<typeof createOutputSchemaRegistry>;
  let tc: TrustClient;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createOutputSchemaRegistry();
    tc = makeTrustClient();
  });

  it('valid output → run completes normally', async () => {
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    const result = await runPostCheck(
      'inbox', 'execute', { result: 'ok' }, registry, 'run-1', 'ws-1', tc,
    );
    expect(result.valid).toBe(true);
  });

  it('invalid output → valid false with AGENT_OUTPUT_REJECTED', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', trust_snapshot_id: 'snap-001', workspace_id: 'ws-1',
      agent_id: 'inbox', action_type: 'execute',
    });
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    const result = await runPostCheck(
      'inbox', 'execute', { wrong: 123 }, registry, 'run-1', 'ws-1', tc,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe('AGENT_OUTPUT_REJECTED');
    }
  });

  it('invalid output → recordViolation called with hard severity', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', trust_snapshot_id: 'snap-001', workspace_id: 'ws-1',
      agent_id: 'inbox', action_type: 'execute',
    });
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    await runPostCheck(
      'inbox', 'execute', { wrong: 123 }, registry, 'run-1', 'ws-1', tc,
    );
    expect(tc.recordViolation).toHaveBeenCalledWith('snap-001', 'hard');
  });

  it('unregistered schema → valid true with warn', async () => {
    const result = await runPostCheck(
      'inbox', 'execute', { anything: 'goes' }, registry, 'run-1', 'ws-1', tc,
    );
    expect(result.valid).toBe(true);
  });

  it('FlowError uses agentType: agentId (not agentId)', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', trust_snapshot_id: 'snap-001', workspace_id: 'ws-1',
      agent_id: 'inbox', action_type: 'execute',
    });
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    const result = await runPostCheck(
      'inbox', 'execute', {}, registry, 'run-1', 'ws-1', tc,
    );
    if (!result.valid && result.error.code === 'AGENT_OUTPUT_REJECTED') {
      expect(result.error.agentType).toBe('inbox');
    }
  });

  it('Zod error summary included in result', async () => {
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    const result = await runPostCheck(
      'inbox', 'execute', {}, registry, 'run-1', 'ws-1', tc,
    );
    if (!result.valid) {
      expect(result.zodErrors).toBeTruthy();
      expect(typeof result.zodErrors).toBe('string');
    }
  });

  it('all post-check violations are hard severity', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', trust_snapshot_id: 'snap-001', workspace_id: 'ws-1',
      agent_id: 'inbox', action_type: 'execute',
    });
    registry.register('inbox', 'execute', z.object({ count: z.number() }));
    await runPostCheck(
      'inbox', 'execute', { count: 'wrong' }, registry, 'run-1', 'ws-1', tc,
    );
    expect(tc.recordViolation).toHaveBeenCalledWith('snap-001', 'hard');
  });

  it('snapshotId read from run record (not in-process cache)', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', trust_snapshot_id: 'snap-from-db', workspace_id: 'ws-1',
      agent_id: 'inbox', action_type: 'execute',
    });
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    await runPostCheck(
      'inbox', 'execute', {}, registry, 'run-1', 'ws-1', tc,
    );
    expect(db.getRunById).toHaveBeenCalledWith('run-1');
    expect(tc.recordViolation).toHaveBeenCalledWith('snap-from-db', 'hard');
  });

  it('snapshotId null → skips violation recording', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', trust_snapshot_id: null, workspace_id: 'ws-1',
      agent_id: 'inbox', action_type: 'execute',
    });
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    await runPostCheck(
      'inbox', 'execute', {}, registry, 'run-1', 'ws-1', tc,
    );
    expect(tc.recordViolation).not.toHaveBeenCalled();
  });

  it('passthrough schema accepts any output', async () => {
    registry.register('inbox', 'execute', z.object({}).passthrough());
    const result = await runPostCheck(
      'inbox', 'execute', { anything: true, nested: { deep: 1 } }, registry, 'run-1', 'ws-1', tc,
    );
    expect(result.valid).toBe(true);
  });

  it('invalid output against schema returns ZodError details', async () => {
    registry.register('inbox', 'execute', z.object({ email: z.string().email() }));
    const result = await runPostCheck(
      'inbox', 'execute', { email: 'not-an-email' }, registry, 'run-1', 'ws-1', tc,
    );
    if (!result.valid) {
      expect(result.zodErrors).toContain('email');
    }
  });

  it('schema mismatch = hard severity always (verify no soft path)', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', trust_snapshot_id: 'snap-001', workspace_id: 'ws-1',
      agent_id: 'inbox', action_type: 'execute',
    });
    registry.register('inbox', 'execute', z.string());
    await runPostCheck(
      'inbox', 'execute', 12345, registry, 'run-1', 'ws-1', tc,
    );
    const calls = (tc.recordViolation as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const firstCall = calls[0];
    expect(firstCall?.[1]).toBe('hard');
  });
});
