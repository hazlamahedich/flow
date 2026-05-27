import { describe, test, expect } from 'vitest';

describe('Story 7.4: Void, Credit Note & Time Reconciliation', () => {
  test.skip('[P0] [7.4-ATDD-001] voidInvoice action transitions invoice to voided', async () => {
    // Needs running server + seeded draft invoice
  });

  test.skip('[P0] [7.4-ATDD-002] voidInvoice rejects paid invoice with INVOICE_PAID_CANNOT_VOID', async () => {
    // Needs running server + seeded paid invoice
  });

  test.skip('[P0] [7.4-ATDD-003] voidInvoice is idempotent on already-voided invoice', async () => {
    // Needs running server + seeded voided invoice
  });

  test.skip('[P0] [7.4-ATDD-004] voidInvoice clears time_entries.invoiced_at for linked entries', async () => {
    // Needs running server + seeded sent invoice with time_entry line items
  });

  test.skip('[P0] [7.4-ATDD-005] issueCreditNote creates credit note and updates credit_balance_cents', async () => {
    // Needs running server + seeded sent invoice
  });

  test.skip('[P0] [7.4-ATDD-006] issueCreditNote rejects amount exceeding balance', async () => {
    // Needs running server + seeded invoice
  });

  test.skip('[P0] [7.4-ATDD-007] issueCreditNote rejects paid invoice', async () => {
    // Needs running server + seeded paid invoice
  });

  test.skip('[P0] [7.4-ATDD-008] invoice list filter excludes voided by default', async () => {
    // Needs running server
  });

  test.skip('[P0] [7.4-ATDD-009] time entry reconciliation shows Ready to re-bill for voided invoices', async () => {
    // Needs running server + seeded voided invoice with time entries
  });

  test.skip('[P0] [7.4-ATDD-010] RLS prevents cross-workspace credit note access', async () => {
    // Needs running server + seeded data in multiple workspaces
  });
});
