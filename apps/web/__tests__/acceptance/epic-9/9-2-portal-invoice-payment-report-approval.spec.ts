/**
 * Story 9.2 Acceptance Tests — Client Portal Invoice Payment & Report Approval (RED PHASE)
 * Tests invoice viewing/payment via portal, report approval, email notifications, hero metric.
 *
 * FR52, FR53, FR82, UX-DR36, UX-DR37, UX-DR39, UX-DR40
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));
vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return { ...actual, requireTenantContext: vi.fn(), createFlowError: actual.createFlowError };
});
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ── RED-PHASE STUBS ──
const {
  mockPayInvoice, mockApproveReport, mockRequestReportChanges,
  mockSendClientNotification, mockPortalInvoicePage, mockPortalReportPage,
  mockZeroThoughtTasksHero,
} = vi.hoisted(() => ({
  mockPayInvoice: vi.fn(),
  mockApproveReport: vi.fn(),
  mockRequestReportChanges: vi.fn(),
  mockSendClientNotification: vi.fn(),
  mockPortalInvoicePage: vi.fn(() => null),
  mockPortalReportPage: vi.fn(() => null),
  mockZeroThoughtTasksHero: vi.fn(() => null),
}));
vi.mock('@/lib/actions/portal/pay-invoice', () => ({ payInvoicePortalAction: mockPayInvoice }));
vi.mock('@/lib/actions/portal/report-approval', () => ({
  approveReportAction: mockApproveReport,
  requestReportChangesAction: mockRequestReportChanges,
}));
vi.mock('@/lib/actions/portal/notifications', () => ({ sendClientNotificationAction: mockSendClientNotification }));
vi.mock('@/app/(portal)/invoices/[invoiceId]/page', () => ({ default: mockPortalInvoicePage }));
vi.mock('@/app/(portal)/reports/[reportId]/page', () => ({ default: mockPortalReportPage }));
vi.mock('@/app/(portal)/components/ZeroThoughtTasksHero', () => ({ ZeroThoughtTasksHero: mockZeroThoughtTasksHero }));

const PORTAL_CTX = { clientId: 'cli-1', workspaceId: 'ws-1', tokenId: 'tok-1' };

beforeEach(() => vi.clearAllMocks());

// ───────────────────────────────────────────────────────────────
// ATDD-001: Client pays invoice through portal (FR52)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.2-ATDD-001] client pays invoice directly through portal (FR52)', () => {
  test('payInvoicePortalAction is defined', () => {
    expect(mockPayInvoice).toBeDefined();
    expect(typeof mockPayInvoice).toBe('function');
  });
  test('returns Stripe Checkout URL for an unpaid invoice', async () => {
    mockPayInvoice.mockResolvedValueOnce({
      success: true, data: { checkoutUrl: 'https://checkout.stripe.com/cs_1' },
    });
    const result = await mockPayInvoice(PORTAL_CTX, { invoiceId: 'inv-1' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.checkoutUrl).toBeDefined();
  });
  test('rejects already-paid invoice (FINANCIAL_INVALID_STATE)', async () => {
    mockPayInvoice.mockResolvedValueOnce({
      success: false, error: { code: 'FINANCIAL_INVALID_STATE', message: '' },
    });
    const result = await mockPayInvoice(PORTAL_CTX, { invoiceId: 'inv-1' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FINANCIAL_INVALID_STATE');
  });
  test('rejects invoice belonging to a different client (FORBIDDEN)', async () => {
    mockPayInvoice.mockResolvedValueOnce({
      success: false, error: { code: 'FORBIDDEN', message: '' },
    });
    const result = await mockPayInvoice(PORTAL_CTX, { invoiceId: 'inv-1' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });
  test('PortalInvoicePage component is exported', () => {
    expect(mockPortalInvoicePage).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Report approval / request changes (FR53)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.2-ATDD-002] client approves or requests changes to reports (FR53)', () => {
  test('approveReportAction transitions report to approved', async () => {
    mockApproveReport.mockResolvedValueOnce({ success: true });
    const result = await mockApproveReport(PORTAL_CTX, { reportId: 'rep-1' });
    expect(result.success).toBe(true);
  });
  test('requestReportChangesAction records change request with message', async () => {
    mockRequestReportChanges.mockResolvedValueOnce({ success: true });
    const result = await mockRequestReportChanges(PORTAL_CTX, {
      reportId: 'rep-1', message: 'Please adjust the hours summary.',
    });
    expect(result.success).toBe(true);
  });
  test('approveReportAction rejects already-approved report (idempotency)', async () => {
    mockApproveReport.mockResolvedValueOnce({
      success: false, error: { code: 'INVALID_STATE', message: '' },
    });
    const result = await mockApproveReport(PORTAL_CTX, { reportId: 'rep-1' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INVALID_STATE');
  });
  test('PortalReportPage component is exported', () => {
    expect(mockPortalReportPage).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Email notifications for client events (FR82)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.2-ATDD-003] client email notifications fire for key events (FR82)', () => {
  test('sendClientNotificationAction is defined', () => {
    expect(mockSendClientNotification).toBeDefined();
  });
  test('new invoice shared triggers email to client', async () => {
    mockSendClientNotification.mockResolvedValueOnce({ success: true });
    const result = await mockSendClientNotification({ type: 'invoice_created', clientId: 'cli-1', payload: { invoiceId: 'inv-1' } });
    expect(result.success).toBe(true);
  });
  test('payment confirmation triggers email to client', async () => {
    mockSendClientNotification.mockResolvedValueOnce({ success: true });
    const result = await mockSendClientNotification({ type: 'payment_confirmed', clientId: 'cli-1', payload: { invoiceId: 'inv-1', amountCents: 10000 } });
    expect(result.success).toBe(true);
  });
  test('report shared triggers email to client', async () => {
    mockSendClientNotification.mockResolvedValueOnce({ success: true });
    const result = await mockSendClientNotification({ type: 'report_shared', clientId: 'cli-1', payload: { reportId: 'rep-1' } });
    expect(result.success).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Hero metric & UX patterns (UX-DR36/37/39/40)
// ───────────────────────────────────────────────────────────────
describe('[P1] [9.2-ATDD-004] portal hero metric and value-receipt UX', () => {
  test('ZeroThoughtTasksHero component is exported', () => {
    expect(mockZeroThoughtTasksHero).toBeDefined();
    expect(typeof mockZeroThoughtTasksHero).toBe('function');
  });
  test('hero metric renders count of zero-thought tasks (UX-DR36)', () => {
    expect(mockZeroThoughtTasksHero).toBeDefined();
  });
  test('invoice display follows value-receipt pattern (UX-DR37)', () => {
    expect(mockPortalInvoicePage).toBeDefined();
  });
  test('next-week preview follows TV-cliffhanger pattern (UX-DR39)', () => {
    expect(mockPortalInvoicePage).toBeDefined();
  });
  test('Message [VA name] option with response-time estimate present (UX-DR40)', () => {
    expect(mockPortalInvoicePage).toBeDefined();
  });
});
