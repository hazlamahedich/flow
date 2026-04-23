import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { writeAuditLog } from '../shared/audit-writer';

describe('Audit Writer', () => {
  let stdoutSpy: MockInstance;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true) as unknown as MockInstance;
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true) as unknown as MockInstance;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('writes structured JSON to stdout', () => {
    writeAuditLog({
      workspaceId: 'ws-1',
      agentId: 'inbox',
      action: 'submit',
      entityType: 'agent_run',
      entityId: 'run-1',
      details: { outcome: 'created' },
    });

    expect(stdoutSpy).toHaveBeenCalled();
    const output = (stdoutSpy.mock.calls[0]?.[0] as string).trim();
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed.workspaceId).toBe('ws-1');
    expect(parsed.agentId).toBe('inbox');
    expect(parsed.actionType).toBe('submit');
    expect(parsed.outcome).toBe('created');
  });

  it('includes all required fields', () => {
    writeAuditLog({
      workspaceId: 'ws-1',
      agentId: 'inbox',
      action: 'claim',
      entityType: 'agent_run',
    });

    const output = (stdoutSpy.mock.calls[0]?.[0] as string).trim();
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('workspaceId');
    expect(parsed).toHaveProperty('agentId');
    expect(parsed).toHaveProperty('actionType');
    expect(parsed).toHaveProperty('correlationId');
    expect(parsed).toHaveProperty('outcome');
  });

  it('falls back to stderr on stdout failure', () => {
    stdoutSpy.mockImplementation(() => {
      throw new Error('stdout broken');
    });

    writeAuditLog({
      workspaceId: 'ws-1',
      agentId: 'inbox',
      action: 'test',
      entityType: 'agent_run',
    });

    expect(stderrSpy).toHaveBeenCalled();
    const output = (stderrSpy.mock.calls[0]?.[0] as string).trim();
    expect(() => JSON.parse(output)).not.toThrow();
  });
});
