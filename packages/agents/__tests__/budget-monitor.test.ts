import { describe, it, expect, vi } from 'vitest';
import { createBudgetMonitor } from '../shared/budget-monitor';
import type { BudgetMonitorDeps } from '../shared/budget-monitor';

function makeDeps(overrides: Partial<BudgetMonitorDeps> = {}): BudgetMonitorDeps {
  return {
    getAgentBudget: vi.fn().mockResolvedValue({ monthlyBudgetCents: 10000, periodStart: new Date('2026-04-01') }),
    getSpendForPeriod: vi.fn().mockResolvedValue(5000),
    ...overrides,
  };
}

describe('createBudgetMonitor', () => {
  it('allows when under 80% budget', async () => {
    const deps = makeDeps({ getSpendForPeriod: vi.fn().mockResolvedValue(7000) });
    const monitor = createBudgetMonitor(deps);
    const result = await monitor.check('ws-1');
    expect(result.allowed).toBe(true);
    expect(result.alertLevel).toBe('none');
    expect(result.percentUsed).toBeCloseTo(0.7);
  });

  it('warns at 80% threshold', async () => {
    const deps = makeDeps({ getSpendForPeriod: vi.fn().mockResolvedValue(8000) });
    const monitor = createBudgetMonitor(deps);
    const result = await monitor.check('ws-1');
    expect(result.allowed).toBe(true);
    expect(result.alertLevel).toBe('warning');
    expect(result.percentUsed).toBeCloseTo(0.8);
  });

  it('blocks at 100% threshold', async () => {
    const deps = makeDeps({ getSpendForPeriod: vi.fn().mockResolvedValue(10000) });
    const monitor = createBudgetMonitor(deps);
    const result = await monitor.check('ws-1');
    expect(result.allowed).toBe(false);
    expect(result.alertLevel).toBe('critical');
    expect(result.percentUsed).toBeCloseTo(1.0);
  });

  it('blocks when over budget', async () => {
    const deps = makeDeps({ getSpendForPeriod: vi.fn().mockResolvedValue(12000) });
    const monitor = createBudgetMonitor(deps);
    const result = await monitor.check('ws-1');
    expect(result.allowed).toBe(false);
    expect(result.alertLevel).toBe('critical');
  });

  it('allows unlimited when budget is 0', async () => {
    const deps = makeDeps({ getAgentBudget: vi.fn().mockResolvedValue({ monthlyBudgetCents: 0, periodStart: null }) });
    const monitor = createBudgetMonitor(deps);
    const result = await monitor.check('ws-1');
    expect(result.allowed).toBe(true);
    expect(result.alertLevel).toBe('none');
  });

  it('allows unlimited when budget config is null', async () => {
    const deps = makeDeps({ getAgentBudget: vi.fn().mockResolvedValue(null) });
    const monitor = createBudgetMonitor(deps);
    const result = await monitor.check('ws-1');
    expect(result.allowed).toBe(true);
    expect(result.alertLevel).toBe('none');
  });

  it('uses rolling 30-day window when periodStart is null', async () => {
    const spendFn = vi.fn().mockResolvedValue(5000);
    const deps = makeDeps({
      getAgentBudget: vi.fn().mockResolvedValue({ monthlyBudgetCents: 10000, periodStart: null }),
      getSpendForPeriod: spendFn,
    });
    const monitor = createBudgetMonitor(deps);
    await monitor.check('ws-1');
    expect(spendFn).toHaveBeenCalled();
    const callArgs = spendFn.mock.calls[0] as [string, Date, Date];
    const start = callArgs[1];
    const end = callArgs[2];
    const diff = end.getTime() - start.getTime();
    expect(diff).toBeCloseTo(30 * 24 * 60 * 60 * 1000, -4);
  });

  it('handles jump-skip from 60% to 100%', async () => {
    const deps = makeDeps({ getSpendForPeriod: vi.fn().mockResolvedValue(10000) });
    const monitor = createBudgetMonitor(deps);
    const result = await monitor.check('ws-1');
    expect(result.allowed).toBe(false);
    expect(result.alertLevel).toBe('critical');
    expect(result.percentUsed).toBeCloseTo(1.0);
  });
});
