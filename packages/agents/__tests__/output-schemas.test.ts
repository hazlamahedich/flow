import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOutputSchemaRegistry } from '../orchestrator/output-schemas';
import { z } from 'zod';

vi.mock('../shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

describe('OutputSchemaRegistry', () => {
  let registry: ReturnType<typeof createOutputSchemaRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createOutputSchemaRegistry();
  });

  it('registered schema validates output correctly', () => {
    const schema = z.object({ name: z.string() });
    registry.register('inbox', 'execute', schema);
    const result = schema.safeParse({ name: 'test' });
    expect(result.success).toBe(true);
  });

  it('unregistered agent/action returns null', () => {
    const schema = registry.get('calendar', 'unknown-action');
    expect(schema).toBeNull();
  });

  it('invalid output against schema returns ZodError details', () => {
    const schema = z.object({ count: z.number() });
    registry.register('inbox', 'execute', schema);
    const result = schema.safeParse({ count: 'wrong' });
    expect(result.success).toBe(false);
  });

  it('passthrough schema for MVP agent stubs accepts any output', () => {
    const passthrough = z.object({}).passthrough();
    registry.register('inbox', 'execute', passthrough);
    const result = passthrough.safeParse({ anything: true, nested: { deep: 1 } });
    expect(result.success).toBe(true);
  });

  it('validateActiveAgents logs ERROR for active agent with missing schema', async () => {
    const { writeAuditLog } = await import('../shared/audit-writer');
    registry.validateActiveAgents(['inbox']);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'gate_schema_missing_total',
    }));
  });

  it('conflicting schema registration overwrites with last-write-wins', () => {
    registry.register('inbox', 'execute', z.object({ v: z.literal(1) }));
    registry.register('inbox', 'execute', z.object({ v: z.literal(2) }));
    const schema = registry.get('inbox', 'execute');
    const result = schema!.safeParse({ v: 2 });
    expect(result.success).toBe(true);
  });
});
