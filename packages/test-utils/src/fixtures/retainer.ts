type RetainerType = 'hourly_rate' | 'flat_monthly' | 'package_based';

interface BaseRetainerOverrides {
  id?: string;
  workspaceId?: string;
  clientId?: string;
  billingPeriodDays?: number;
  startDate?: string;
  endDate?: string | null;
  status?: 'active' | 'cancelled' | 'expired';
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

type HourlyRateOverrides = BaseRetainerOverrides & {
  type?: 'hourly_rate';
  hourlyRateCents?: number;
  monthlyFeeCents?: never;
  monthlyHoursThreshold?: never;
  packageHours?: never;
  packageName?: never;
};

type FlatMonthlyOverrides = BaseRetainerOverrides & {
  type?: 'flat_monthly';
  hourlyRateCents?: never;
  monthlyFeeCents?: number;
  monthlyHoursThreshold?: string;
  packageHours?: never;
  packageName?: never;
};

type PackageBasedOverrides = BaseRetainerOverrides & {
  type?: 'package_based';
  hourlyRateCents?: number | null;
  monthlyFeeCents?: never;
  monthlyHoursThreshold?: never;
  packageHours?: string;
  packageName?: string;
};

type RetainerOverrides = HourlyRateOverrides | FlatMonthlyOverrides | PackageBasedOverrides;

export function buildRetainer(overrides: RetainerOverrides = {}) {
  const id = overrides.id ?? crypto.randomUUID();
  const type = (overrides as Record<string, unknown>).type as RetainerType | undefined ?? 'hourly_rate';
  const workspaceId = overrides.workspaceId ?? crypto.randomUUID();
  const clientId = overrides.clientId ?? crypto.randomUUID();

  const base = {
    id,
    workspaceId,
    clientId,
    billingPeriodDays: overrides.billingPeriodDays ?? 30,
    startDate: overrides.startDate ?? '2026-01-01',
    endDate: overrides.endDate ?? null,
    status: overrides.status ?? 'active',
    cancelledAt: overrides.cancelledAt ?? null,
    cancellationReason: overrides.cancellationReason ?? null,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };

  if (type === 'hourly_rate') {
    return {
      ...base,
      type: 'hourly_rate' as const,
      hourlyRateCents: (overrides as HourlyRateOverrides).hourlyRateCents ?? 5000,
      monthlyFeeCents: null,
      monthlyHoursThreshold: null,
      packageHours: null,
      packageName: null,
    };
  }

  if (type === 'flat_monthly') {
    return {
      ...base,
      type: 'flat_monthly' as const,
      hourlyRateCents: null,
      monthlyFeeCents: (overrides as FlatMonthlyOverrides).monthlyFeeCents ?? 200000,
      monthlyHoursThreshold: (overrides as FlatMonthlyOverrides).monthlyHoursThreshold ?? '30.00',
      packageHours: null,
      packageName: null,
    };
  }

  return {
    ...base,
    type: 'package_based' as const,
    hourlyRateCents: (overrides as PackageBasedOverrides).hourlyRateCents ?? null,
    monthlyFeeCents: null,
    monthlyHoursThreshold: null,
    packageHours: (overrides as PackageBasedOverrides).packageHours ?? '40.00',
    packageName: (overrides as PackageBasedOverrides).packageName ?? 'Social Media Management',
  };
}
