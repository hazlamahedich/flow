import { vi } from 'vitest';

export function mockTrustActions(overrides?: {
  upgradeTrustLevel?: ReturnType<typeof vi.fn>;
  undoRegression?: ReturnType<typeof vi.fn>;
}) {
  const defaults = {
    upgradeTrustLevel: vi.fn().mockResolvedValue({
      success: true,
      data: { matrixEntryId: 'm1', fromLevel: 'supervised', toLevel: 'confirm', version: 2 },
    }),
    undoRegression: vi.fn().mockResolvedValue({
      success: true,
      data: { matrixEntryId: 'm1', fromLevel: 'confirm', toLevel: 'auto', version: 3 },
    }),
    ...overrides,
  };

  vi.mock('../../actions/trust-actions', () => ({
    upgradeTrustLevel: defaults.upgradeTrustLevel,
    undoRegression: defaults.undoRegression,
  }));

  return defaults;
}
