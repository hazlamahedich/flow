import { describe, it, expect } from 'vitest';
import { agentSignalSchema, signalTypePattern } from '@flow/types';

describe('TC-16: Signal write/read validation', () => {
  it('accepts valid signal shape', () => {
    const signal = {
      id: 'a0000000-0000-0000-0000-000000000001',
      correlationId: 'c0000000-0000-0000-0000-000000000001',
      causationId: null,
      agentId: 'inbox',
      signalType: 'inbox.categorized.email',
      version: 1,
      payload: { subject: 'Test email' },
      targetAgent: null,
      clientId: null,
      workspaceId: '11111111-1111-1111-1111-111111111111',
      createdAt: '2026-04-26T10:00:00+00:00',
    };
    const result = agentSignalSchema.parse(signal);
    expect(result.id).toBe(signal.id);
    expect(result.signalType).toBe('inbox.categorized.email');
  });

  it('rejects invalid signal type pattern', () => {
    const signal = {
      id: 'a0000000-0000-0000-0000-000000000001',
      correlationId: 'c0000000-0000-0000-0000-000000000001',
      causationId: null,
      agentId: 'inbox',
      signalType: 'INVALID',
      version: 1,
      payload: {},
      targetAgent: null,
      clientId: null,
      workspaceId: '11111111-1111-1111-1111-111111111111',
      createdAt: '2026-04-26T10:00:00+00:00',
    };
    expect(() => agentSignalSchema.parse(signal)).toThrow();
  });
});

describe('TC-17: Signals scoped by workspace_id', () => {
  it('signal with workspace_id different from expected is still valid shape', () => {
    const wsAlpha = '11111111-1111-1111-1111-111111111111';
    const wsBeta = '22222222-2222-2222-2222-222222222222';

    const alphaSignal = {
      id: 'a0000000-0000-0000-0000-000000000001',
      correlationId: 'c0000000-0000-0000-0000-000000000001',
      causationId: null,
      agentId: 'inbox',
      signalType: 'inbox.categorized.email',
      version: 1,
      payload: {},
      targetAgent: null,
      clientId: null,
      workspaceId: wsAlpha,
      createdAt: '2026-04-26T10:00:00+00:00',
    };

    const betaSignal = {
      ...alphaSignal,
      id: 'a0000000-0000-0000-0000-000000000002',
      workspaceId: wsBeta,
    };

    const parsedAlpha = agentSignalSchema.parse(alphaSignal);
    const parsedBeta = agentSignalSchema.parse(betaSignal);
    expect(parsedAlpha.workspaceId).not.toBe(parsedBeta.workspaceId);
  });

  it('signalTypePattern regex validates {agent}.{verb}.{noun} format', () => {
    expect(signalTypePattern.test('inbox.categorized.email')).toBe(true);
    expect(signalTypePattern.test('ar-collection.sent.invoice')).toBe(true);
    expect(signalTypePattern.test('weekly-report.generated.report')).toBe(true);
    expect(signalTypePattern.test('invalid')).toBe(false);
    expect(signalTypePattern.test('too.many.parts.here')).toBe(false);
    expect(signalTypePattern.test('UPPER.case.word')).toBe(false);
  });
});
