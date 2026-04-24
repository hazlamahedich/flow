import { describe, it, expect } from 'vitest';
import { deriveUIStatus } from '../src/derive-agent-ui-status';
import type { AgentContext } from '@flow/types';

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    setupCompleted: false,
    integrationHealth: null,
    isInitializing: false,
    fetchError: null,
    ...overrides,
  };
}

describe('deriveUIStatus', () => {
  it('returns error-loading when fetchError is set', () => {
    const ctx = makeContext({ fetchError: new Error('network fail') });
    expect(deriveUIStatus('active', ctx)).toBe('error-loading');
  });

  it('returns error-loading regardless of backend state when fetchError is set', () => {
    const ctx = makeContext({ fetchError: new Error('fail') });
    expect(deriveUIStatus('inactive', ctx)).toBe('error-loading');
    expect(deriveUIStatus('activating', ctx)).toBe('error-loading');
  });

  it('returns loading when isInitializing is true', () => {
    const ctx = makeContext({ isInitializing: true });
    expect(deriveUIStatus('inactive', ctx)).toBe('loading');
  });

  it('returns loading regardless of backend state when isInitializing is true', () => {
    const ctx = makeContext({ isInitializing: true });
    expect(deriveUIStatus('active', ctx)).toBe('loading');
  });

  it('prioritizes error-loading over loading', () => {
    const ctx = makeContext({ isInitializing: true, fetchError: new Error('fail') });
    expect(deriveUIStatus('inactive', ctx)).toBe('error-loading');
  });

  it('returns draft when inactive and setup not completed', () => {
    const ctx = makeContext({ setupCompleted: false });
    expect(deriveUIStatus('inactive', ctx)).toBe('draft');
  });

  it('returns inactive when inactive and setup completed', () => {
    const ctx = makeContext({ setupCompleted: true });
    expect(deriveUIStatus('inactive', ctx)).toBe('inactive');
  });

  it('returns degraded when active and integration health is degraded', () => {
    const ctx = makeContext({ integrationHealth: 'degraded' });
    expect(deriveUIStatus('active', ctx)).toBe('degraded');
  });

  it('returns active when active and integration health is healthy', () => {
    const ctx = makeContext({ integrationHealth: 'healthy' });
    expect(deriveUIStatus('active', ctx)).toBe('active');
  });

  it('returns active when active and integration health is null', () => {
    const ctx = makeContext({ integrationHealth: null });
    expect(deriveUIStatus('active', ctx)).toBe('active');
  });

  it('returns deactivating when draining', () => {
    const ctx = makeContext();
    expect(deriveUIStatus('draining', ctx)).toBe('deactivating');
  });

  it('returns activating when activating', () => {
    const ctx = makeContext();
    expect(deriveUIStatus('activating', ctx)).toBe('activating');
  });

  it('returns suspended when suspended', () => {
    const ctx = makeContext();
    expect(deriveUIStatus('suspended', ctx)).toBe('suspended');
  });

  it('returns degraded when active and integration health is disconnected', () => {
    const ctx = makeContext({ integrationHealth: 'disconnected' });
    expect(deriveUIStatus('active', ctx)).toBe('active');
  });
});
