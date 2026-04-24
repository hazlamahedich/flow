export interface BudgetMonitorDeps {
  getAgentBudget: (workspaceId: string) => Promise<{
    monthlyBudgetCents: number;
    periodStart: Date | null;
  } | null>;
  getSpendForPeriod: (workspaceId: string, periodStart: Date, periodEnd: Date) => Promise<number>;
  writeAuditAlert?: (entry: {
    workspaceId: string;
    alertLevel: 'warning' | 'critical';
    percentUsed: number;
    monthlyBudgetCents: number;
    periodSpendCents: number;
  }) => Promise<void>;
  hasAlertedThisPeriod?: (workspaceId: string, level: 'warning' | 'critical', periodStart: Date) => Promise<boolean>;
}

export interface BudgetCheckResult {
  allowed: boolean;
  percentUsed: number;
  alertLevel: 'none' | 'warning' | 'critical';
}

export interface BudgetMonitor {
  check: (workspaceId: string) => Promise<BudgetCheckResult>;
}

export function createBudgetMonitor(deps: BudgetMonitorDeps): BudgetMonitor {
  return {
    async check(workspaceId): Promise<BudgetCheckResult> {
      const budget = await deps.getAgentBudget(workspaceId);
      if (!budget || budget.monthlyBudgetCents <= 0) {
        return { allowed: true, percentUsed: 0, alertLevel: 'none' };
      }

      let periodStart = budget.periodStart;
      if (!periodStart) {
        const now = new Date();
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const now = new Date();
      const spent = await deps.getSpendForPeriod(workspaceId, periodStart, now);
      const percentUsed = budget.monthlyBudgetCents > 0
        ? Math.round((spent / budget.monthlyBudgetCents) * 100) / 100
        : 0;

      if (percentUsed >= 1.0) {
        await fireAlertIfNew(deps, workspaceId, 'critical', percentUsed, budget.monthlyBudgetCents, spent, periodStart);
        return { allowed: false, percentUsed, alertLevel: 'critical' };
      }
      if (percentUsed >= 0.8) {
        await fireAlertIfNew(deps, workspaceId, 'warning', percentUsed, budget.monthlyBudgetCents, spent, periodStart);
        return { allowed: true, percentUsed, alertLevel: 'warning' };
      }
      return { allowed: true, percentUsed, alertLevel: 'none' };
    },
  };
}

async function fireAlertIfNew(
  deps: BudgetMonitorDeps,
  workspaceId: string,
  level: 'warning' | 'critical',
  percentUsed: number,
  monthlyBudgetCents: number,
  spent: number,
  periodStart: Date,
): Promise<void> {
  if (!deps.writeAuditAlert || !deps.hasAlertedThisPeriod) return;

  const alreadyAlerted = await deps.hasAlertedThisPeriod(workspaceId, level, periodStart);
  if (alreadyAlerted) return;

  await deps.writeAuditAlert({
    workspaceId,
    alertLevel: level,
    percentUsed,
    monthlyBudgetCents,
    periodSpendCents: spent,
  });
}
