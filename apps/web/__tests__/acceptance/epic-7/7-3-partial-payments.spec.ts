/**
 * Story 7.3 Acceptance Tests
 * These tests require a running server and seeded data.
 * Stubbed with `.skip()` until E2E infrastructure supports seeded auth state per test.
 */
import { describe, test, expect } from 'vitest';

describe('Story 7.3: Partial Payments & Balance Tracking', () => {
  test.skip('[P0] [7.3-ATDD-001] recordPayment action is defined', async () => {
    const recordPayment = await import('@/lib/actions/invoices/record-payment');
    expect(recordPayment.recordPaymentAction).toBeDefined();
  });

  test.skip('[P0] [7.3-ATDD-002] recordPayment updates invoice status to partially_paid', async () => {
    // Needs running server + seeded invoice
  });

  test.skip('[P0] [7.3-ATDD-003] recordPayment rejects voided invoice', async () => {
    // Needs running server + seeded voided invoice
  });

  test.skip('[P0] [7.3-ATDD-004] recordPayment rejects already-paid invoice', async () => {
    // Needs running server + seeded paid invoice
  });

  test.skip('[P0] [7.3-ATDD-005] overpayment returns warning and transitions to paid', async () => {
    // Needs running server + seeded invoice
  });

  test.skip('[P0] [7.3-ATDD-006] idempotency key prevents double recording', async () => {
    // Needs running server
  });

  test.skip('[P0] [7.3-ATDD-007] invoice detail page shows balance summary', async () => {
    // Needs running server + seeded invoice
  });

  test.skip('[P0] [7.3-ATDD-008] invoice list shows balance per invoice', async () => {
    // Needs running server
  });
});
