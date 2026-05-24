import { describe, test, expect, vi } from 'vitest';

const mockGetAgentConfiguration = vi.fn();

vi.mock('@flow/db', () => ({
  createServiceClient: () => ({ from: vi.fn() }),
  getAgentConfiguration: mockGetAgentConfiguration,
}));

describe('preCheck', () => {
  test('passes for valid UUID workspaceId and ISO sweepDate', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    const { preCheck } = await import('../pre-check');

    const result = await preCheck({
      workspaceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sweepDate: '2026-05-12',
    });

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('fails for non-UUID workspaceId', async () => {
    const { preCheck } = await import('../pre-check');

    const result = await preCheck({ workspaceId: 'not-a-uuid', sweepDate: '2026-05-12' });

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('workspaceId'))).toBe(true);
  });

  test('fails for invalid sweepDate format', async () => {
    const { preCheck } = await import('../pre-check');

    const result = await preCheck({
      workspaceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sweepDate: 'not-a-date',
    });

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('sweepDate'))).toBe(true);
  });

  test('fails when agent configuration is unreadable', async () => {
    mockGetAgentConfiguration.mockRejectedValue(new Error('connection timeout'));
    const { preCheck } = await import('../pre-check');

    const result = await preCheck({
      workspaceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sweepDate: '2026-05-12',
    });

    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('connection timeout');
  });

  test('passes when agent config is null (not yet configured)', async () => {
    mockGetAgentConfiguration.mockResolvedValue(null);
    const { preCheck } = await import('../pre-check');

    const result = await preCheck({
      workspaceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sweepDate: '2026-05-12',
    });

    expect(result.passed).toBe(true);
  });
});
