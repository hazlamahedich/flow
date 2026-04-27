import type { z } from 'zod';
import type { createClientSchema } from '@flow/types';

type CreateClientInput = z.infer<typeof createClientSchema>;

const FAKE_UUID = '00000000-0000-0000-0000-000000000001';
const FAKE_UUID_2 = '00000000-0000-0000-0000-000000000002';

export function createTestClient(
  overrides?: Partial<CreateClientInput>,
): CreateClientInput & Record<string, unknown> {
  return {
    name: 'Test Client',
    ...overrides,
  };
}

export function createTestHourlyRetainer(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'hourly_rate',
    clientId: FAKE_UUID,
    hourlyRateCents: 7500,
    ...overrides,
  };
}

export function createTestFlatMonthlyRetainer(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'flat_monthly',
    clientId: FAKE_UUID,
    monthlyFeeCents: 150000,
    monthlyHoursThreshold: '40',
    ...overrides,
  };
}

export function createTestPackageRetainer(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'package_based',
    clientId: FAKE_UUID,
    packageHours: '20',
    packageName: 'Basic Support',
    ...overrides,
  };
}

export function createTestScopeCreepAlert(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    retainerId: FAKE_UUID,
    clientId: FAKE_UUID_2,
    clientName: 'Test Client',
    retainerType: 'hourly_rate',
    trackedMinutes: 2160,
    thresholdMinutes: 2400,
    utilizationPercent: 90,
    ...overrides,
  };
}

export { FAKE_UUID, FAKE_UUID_2 };
