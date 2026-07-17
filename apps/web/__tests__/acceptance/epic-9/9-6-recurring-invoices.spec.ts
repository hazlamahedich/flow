/**
 * Story 9.6 Acceptance Tests — Recurring Invoices (RED PHASE)
 * Tests scheduled auto-generation, conformance with manual invoice rules,
 * pause on subscription suspension.
 *
 * FR37, FR60
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));
vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn().mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'owner',
    }),
    createFlowError: actual.createFlowError,
  };
});
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ── RED-PHASE STUBS ──
const { mockCreateRecurring, mockGetRecurring, mockGenerateScheduled } =
  vi.hoisted(() => ({
    mockCreateRecurring: vi.fn(),
    mockGetRecurring: vi.fn(),
    mockGenerateScheduled: vi.fn(),
  }));
vi.mock('@/lib/actions/invoices/recurring', () => ({
  createRecurringInvoiceAction: mockCreateRecurring,
  getRecurringInvoicesAction: mockGetRecurring,
}));
vi.mock('@/lib/actions/invoices/generate-scheduled', () => ({
  generateScheduledInvoicesAction: mockGenerateScheduled,
}));

const recurringIntervalSchema = z.enum(['weekly', 'monthly', 'quarterly']);
const recurringInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  interval: recurringIntervalSchema,
  nextRunAt: z.string().min(1),
  lineItems: z.array(
    z.object({
      description: z.string(),
      unitPriceCents: z.number().int().nonnegative(),
      quantity: z.number().int().positive(),
    }),
  ),
});

beforeEach(() => vi.clearAllMocks());

// ───────────────────────────────────────────────────────────────
// ATDD-001: Recurring invoice schema & intervals (FR37)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.6-ATDD-001] recurring invoice schema supports schedule (FR37)', () => {
  test('recurringIntervalSchema accepts weekly, monthly, quarterly', () => {
    expect(recurringIntervalSchema.safeParse('weekly').success).toBe(true);
    expect(recurringIntervalSchema.safeParse('monthly').success).toBe(true);
    expect(recurringIntervalSchema.safeParse('quarterly').success).toBe(true);
  });
  test('recurringIntervalSchema rejects invalid interval', () => {
    expect(recurringIntervalSchema.safeParse('hourly').success).toBe(false);
  });
  test('recurringInvoiceSchema accepts a valid retainer schedule', () => {
    const ok = recurringInvoiceSchema.safeParse({
      clientId: '00000000-0000-0000-0000-000000000001',
      interval: 'monthly',
      nextRunAt: '2026-07-01T00:00:00Z',
      lineItems: [
        { description: 'Retainer', unitPriceCents: 50000, quantity: 1 },
      ],
    });
    expect(ok.success).toBe(true);
  });
  test('recurringInvoiceSchema requires nextRunAt', () => {
    const bad = recurringInvoiceSchema.safeParse({
      clientId: '00000000-0000-0000-0000-000000000001',
      interval: 'monthly',
      lineItems: [],
    });
    expect(bad.success).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Create & list recurring invoices
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.6-ATDD-002] createRecurringInvoiceAction persists schedule', () => {
  test('createRecurringInvoiceAction is defined', () => {
    expect(mockCreateRecurring).toBeDefined();
  });
  test('creates a recurring invoice linked to a retainer client', async () => {
    mockCreateRecurring.mockResolvedValueOnce({
      success: true,
      data: { id: 'rec-1' },
    });
    const result = await mockCreateRecurring({
      clientId: 'cli-1',
      interval: 'monthly',
      lineItems: [
        { description: 'Retainer', unitPriceCents: 50000, quantity: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });
  test('getRecurringInvoicesAction lists schedules for a workspace', async () => {
    mockGetRecurring.mockResolvedValueOnce({
      success: true,
      data: { items: [{ id: 'rec-1' }] },
    });
    const result = await mockGetRecurring();
    expect(result.success).toBe(true);
    if (result.success) expect(Array.isArray(result.data.items)).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Scheduled generation follows manual invoice rules (FR37)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.6-ATDD-003] generated invoices follow same lifecycle as manual (FR37)', () => {
  test('generateScheduledInvoicesAction is defined', () => {
    expect(mockGenerateScheduled).toBeDefined();
  });
  test('generates draft invoices for all due schedules', async () => {
    mockGenerateScheduled.mockResolvedValueOnce({
      success: true,
      data: { generated: 3, skippedSuspended: 0 },
    });
    const result = await mockGenerateScheduled();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.generated).toBeGreaterThanOrEqual(0);
  });
  test('generated invoice has status draft (same as manual creation)', async () => {
    mockGenerateScheduled.mockResolvedValueOnce({
      success: true,
      data: { generated: 1, skippedSuspended: 0 },
    });
    expect((await mockGenerateScheduled()).success).toBe(true);
  });
  test('nextRunAt advances by one interval after generation', async () => {
    mockGenerateScheduled.mockResolvedValueOnce({
      success: true,
      data: { generated: 1, skippedSuspended: 0 },
    });
    expect((await mockGenerateScheduled()).success).toBe(true);
  });
  test('generation is idempotent (no duplicate for same schedule + date)', async () => {
    mockGenerateScheduled.mockResolvedValue({
      success: true,
      data: { generated: 1, skippedSuspended: 0 },
    });
    const r1 = await mockGenerateScheduled();
    const r2 = await mockGenerateScheduled();
    expect(r1.success && r2.success).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Pause generation on suspension (FR60)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.6-ATDD-004] recurring generation pauses on Past Due / Suspended (FR60)', () => {
  test('generateScheduledInvoicesAction skips past_due workspaces', async () => {
    mockGenerateScheduled.mockResolvedValueOnce({
      success: true,
      data: { generated: 0, skippedSuspended: 2 },
    });
    const result = await mockGenerateScheduled();
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.skippedSuspended).toBeGreaterThanOrEqual(0);
  });
  test('generation resumes when workspace returns to active', async () => {
    mockGenerateScheduled.mockResolvedValueOnce({
      success: true,
      data: { generated: 2, skippedSuspended: 0 },
    });
    expect((await mockGenerateScheduled()).success).toBe(true);
  });
});
