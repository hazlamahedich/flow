import { describe, it, expect } from 'vitest';
import type { FlowError } from '@flow/types';
import type { AgentId } from '@flow/types';

describe('FlowError agent variant boundaries', () => {
  const agentId: AgentId = 'inbox';

  it('FlowError agent variant discriminant is "agent"', () => {
    const err: FlowError = {
      status: 422,
      code: 'AGENT_PRECHECK_FAILED',
      message: 'test',
      category: 'agent',
      agentType: agentId,
    };
    expect(err.category).toBe('agent');
  });

  it('FlowError includes agentType: AgentId (typed correctly)', () => {
    const err: FlowError = {
      status: 422,
      code: 'AGENT_PRECHECK_FAILED',
      message: 'test',
      category: 'agent',
      agentType: agentId,
    };
    expect(err.agentType).toBe('inbox');
  });

  it('FlowError includes AGENT_PRECHECK_FAILED or AGENT_OUTPUT_REJECTED', () => {
    const err1: FlowError = {
      status: 422, code: 'AGENT_PRECHECK_FAILED', message: 'test',
      category: 'agent', agentType: agentId,
    };
    const err2: FlowError = {
      status: 422, code: 'AGENT_OUTPUT_REJECTED', message: 'test',
      category: 'agent', agentType: agentId,
    };
    expect(err1.code).toBe('AGENT_PRECHECK_FAILED');
    expect(err2.code).toBe('AGENT_OUTPUT_REJECTED');
  });

  it('FlowError AGENT_ERROR includes retryable boolean field', () => {
    const err: FlowError = {
      status: 500, code: 'AGENT_ERROR', message: 'test',
      category: 'agent', agentType: agentId, retryable: true,
    };
    expect(err.retryable).toBe(true);
  });

  it('FlowError serializes to JSON and back (roundtrip)', () => {
    const err: FlowError = {
      status: 422, code: 'AGENT_OUTPUT_REJECTED', message: 'test',
      category: 'agent', agentType: agentId,
    };
    const json = JSON.stringify(err);
    const parsed = JSON.parse(json);
    expect(parsed.code).toBe('AGENT_OUTPUT_REJECTED');
    expect(parsed.agentType).toBe('inbox');
    expect(parsed.category).toBe('agent');
  });

  it('agent variant codes are known set', () => {
    const validCodes: Set<string> = new Set([
      'AGENT_ERROR', 'AGENT_TIMEOUT', 'AGENT_PRECHECK_FAILED', 'AGENT_OUTPUT_REJECTED',
    ]);
    const testCode: string = 'AGENT_PRECHECK_FAILED';
    expect(validCodes.has(testCode)).toBe(true);
    expect(validCodes.has('INVALID')).toBe(false);
  });
});
