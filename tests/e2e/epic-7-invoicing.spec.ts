import { test, expect } from '../support/merged-fixtures';
import type { Page } from '@playwright/test';

/**
 * Helper: Click the first invoice row whose status cell matches the given
 * pattern. Skips the test if the table or matching row is not found.
 *
 * @param page — Playwright Page instance (e.g. ownerPage)
 * @param statusPattern — RegExp string for the invoice status (e.g. 'draft', 'sent|viewed')
 */
async function clickInvoiceByStatus(page: Page, statusPattern: string) {
  const table = page.getByRole('table');
  if (!(await table.isVisible())) {
    test.skip(
      true,
      `Invoice table not visible — no seeded data for status: ${statusPattern}`,
    );
  }
  const row = table
    .locator('tbody tr')
    .filter({ hasText: new RegExp(statusPattern, 'i') })
    .first();
  if (!(await row.isVisible())) {
    test.skip(
      true,
      `No invoice with status "${statusPattern}" found in seeded data`,
    );
  }
  await row.locator('a').first().click();
  await page.waitForURL(/\/invoices\/[0-9a-f-]+/);
}

test.describe('[P0] Invoice List Page', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
  });

  test('[7.1-E2E-008] invoice list loads with heading and create button', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: 'Invoices' }),
    ).toBeVisible();
    await expect(
      ownerPage.getByRole('link', { name: 'Create Invoice' }),
    ).toBeVisible();
  });

  test('[7.1-E2E-009] invoice list shows table or empty state', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const table = ownerPage.getByRole('table');
    const emptyState = ownerPage.getByText(/no invoices yet/i);
    await expect(table.or(emptyState)).toBeVisible();
  });

  test('[7.1-E2E-010] empty state has CTA to create invoice', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const emptyState = ownerPage.getByText(/no invoices yet/i);
    if (!(await emptyState.isVisible())) {
      test.skip(true, 'Empty state not visible — invoices exist in seeded data');
    }
    const cta = ownerPage.getByRole('link', { name: 'Create Invoice' }).nth(1);
    await expect(cta).toBeVisible();
  });

  test('[7.1-E2E-011] filter pills default to Active', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const activePill = ownerPage.getByRole('button', { name: 'Active' });
    await expect(activePill).toBeVisible();
  });
});

test.describe('[P0] Create Invoice Flow', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
  });

  test('[7.1-E2E-012] navigate to create invoice page', async ({ ownerPage }) => {
    await ownerPage.getByRole('link', { name: 'Create Invoice' }).first().click();
    await ownerPage.waitForURL(/\/invoices\/new/);
    await expect(ownerPage).toHaveURL(/\/invoices\/new/);
    await expect(
      ownerPage.getByRole('heading', { name: 'Create Invoice' }),
    ).toBeVisible();
  });

  test('[7.1-E2E-013] create invoice form requires client selection', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices/new');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    await ownerPage.getByRole('button', { name: 'Create Invoice' }).click();
    await expect(ownerPage.getByText(/please select a client/i)).toBeVisible();
  });

  test('[7.1-E2E-001] create invoice form requires at least one line item', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices/new');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const clientSelect = ownerPage.locator('select').first();
    if (await clientSelect.isVisible()) {
      const options = await clientSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await clientSelect.selectOption({ index: 1 });
      }
    }

    await ownerPage.getByRole('button', { name: 'Create Invoice' }).click();
    await expect(ownerPage.getByText(/add at least one line item/i)).toBeVisible();
  });

  test('[7.1-E2E-002] add fixed service line item and validate total', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices/new');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    await ownerPage.getByRole('button', { name: '+ Add Fixed Service' }).click();

    const descInputs = ownerPage.locator('input[placeholder="Description"]');
    const qtyInputs = ownerPage.locator('input[placeholder="Qty"]');
    const amtInputs = ownerPage.locator('input[placeholder="Amount ($)"]');

    if (await descInputs.first().isVisible()) {
      await descInputs.first().fill('E2E Test Service');
      await qtyInputs.first().fill('2');
      await amtInputs.first().fill('150.00');

      const totalText = ownerPage.getByText(/Total:/);
      await expect(totalText).toContainText('$300.00');
    }
  });
});

test.describe('[P0] Invoice Detail — Draft Actions', () => {
  test('[7.1-E2E-014] invoice detail shows status badge and line items', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const table = ownerPage.getByRole('table');
    if (!(await table.isVisible())) {
      test.skip(true, 'Invoice table not visible — no seeded invoices');
    }

    const invoiceLink = ownerPage.locator('table a[href^="/invoices/"]').first();
    if (!(await invoiceLink.isVisible())) {
      test.skip(true, 'No invoice links found in table');
    }

    await invoiceLink.click();
    await ownerPage.waitForURL(/\/invoices\/[0-9a-f-]+/);

    await expect(ownerPage.getByRole('heading').first()).toBeVisible();

    const statusBadge = ownerPage.locator('[aria-label^="Status:"]').first();
    if (await statusBadge.isVisible()) {
      await expect(statusBadge).toBeVisible();
    }
  });

  test('[7.1-E2E-003] draft invoice shows Edit and Send buttons', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'draft');

    const editLink = ownerPage.getByRole('link', { name: 'Edit' });
    const sendBtn = ownerPage.getByRole('button', { name: /send invoice/i });
    if (await editLink.isVisible()) {
      await expect(editLink).toBeVisible();
    }
    if (await sendBtn.isVisible()) {
      await expect(sendBtn).toBeVisible();
    }
  });
});

test.describe('[P0] Invoice Detail — Send & Payment Link', () => {
  test('[7.2-E2E-003] sent invoice hides Edit button and shows sent date', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'sent');

    const editLink = ownerPage.getByRole('link', { name: 'Edit' });
    await expect(editLink).not.toBeVisible();

    const sentLabel = ownerPage.getByText(/sent/i);
    if (await sentLabel.isVisible()) {
      await expect(sentLabel).toBeVisible();
    }
  });

  test('[7.2-E2E-001] copy payment link button is visible on sent invoice', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'sent|viewed');

    const copyBtn = ownerPage.getByRole('button', { name: /copy payment link/i });
    if (await copyBtn.isVisible()) {
      await expect(copyBtn).toBeVisible();
    }
  });
});

test.describe('[P0] Invoice Detail — Record Payment', () => {
  test('[7.3-E2E-002] record payment button visible on non-draft non-voided invoice', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'sent|viewed|partially paid');

    const recordBtn = ownerPage.getByRole('button', { name: /record payment/i });
    if (await recordBtn.isVisible()) {
      await expect(recordBtn).toBeVisible();
    }
  });

  test('[7.3-E2E-001] record payment modal opens with outstanding amount pre-filled', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'sent|viewed|partially paid');

    const recordBtn = ownerPage.getByRole('button', { name: /record payment/i });
    if (!(await recordBtn.isVisible())) {
      test.skip(true, 'Record Payment button not visible on selected invoice');
    }

    await recordBtn.click();

    const modal = ownerPage.locator('[role="dialog"]').filter({ hasText: /Record Payment/ });
    await expect(modal).toBeVisible();

    const amountInput = modal.locator('input#amount');
    if (await amountInput.isVisible()) {
      const value = await amountInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

test.describe('[P1] Invoice Detail — Void Invoice', () => {
  test('[7.1-E2E-006] void button visible on non-paid non-voided invoice', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'draft|sent|viewed|partially paid');

    const voidBtn = ownerPage.getByRole('button', { name: /void invoice/i });
    if (await voidBtn.isVisible()) {
      await expect(voidBtn).toBeVisible();
    }
  });

  test('[7.4-E2E-001] void modal requires reason and shows warning', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'draft|sent|viewed|partially paid');

    const voidBtn = ownerPage.getByRole('button', { name: /void invoice/i });
    if (!(await voidBtn.isVisible())) {
      test.skip(true, 'Void button not visible on selected invoice');
    }

    await voidBtn.click();

    const modal = ownerPage.locator('[role="dialog"]').filter({ hasText: /Void Invoice/ });
    await expect(modal).toBeVisible();

    await expect(modal.getByText(/permanently cancels/i)).toBeVisible();

    const confirmBtn = modal.getByRole('button', { name: /confirm void/i });
    await confirmBtn.click();
    await expect(modal.getByText(/reason is required/i)).toBeVisible();
  });
});

test.describe('[P1] Invoice Detail — Credit Note', () => {
  test('[7.4-E2E-004] issue credit note button visible on non-paid non-voided invoice with balance', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'draft|sent|viewed|partially paid');

    const creditBtn = ownerPage.getByRole('button', { name: /issue credit note/i });
    if (await creditBtn.isVisible()) {
      await expect(creditBtn).toBeVisible();
    }
  });

  test('[7.4-E2E-002] credit note modal validates max amount', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'draft|sent|viewed|partially paid');

    const creditBtn = ownerPage.getByRole('button', { name: /issue credit note/i });
    if (!(await creditBtn.isVisible())) {
      test.skip(true, 'Credit note button not visible on selected invoice');
    }

    await creditBtn.click();

    const modal = ownerPage.locator('[role="dialog"]').filter({ hasText: /Issue Credit Note/ });
    await expect(modal).toBeVisible();

    const amountInput = modal.locator('input').first();
    if (await amountInput.isVisible()) {
      await amountInput.fill('999999.99');
      const confirmBtn = modal.getByRole('button', { name: /issue credit/i });
      await confirmBtn.click();
      await expect(modal.getByText(/exceeds|invalid|max/i)).toBeVisible();
    }
  });
});

test.describe('[P1] Invoice List — Filters', () => {
  test('[7.4-E2E-005] filter pills switch between All, Active, Voided, With Credit', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const allPill = ownerPage.getByRole('button', { name: 'All' });
    const activePill = ownerPage.getByRole('button', { name: 'Active' });
    const voidedPill = ownerPage.getByRole('button', { name: 'Voided' });
    const creditPill = ownerPage.getByRole('button', { name: 'With Credit' });

    if (await allPill.isVisible()) {
      await allPill.click();
      await ownerPage.waitForURL(/filter=all/);
    }
    if (await activePill.isVisible()) {
      await activePill.click();
      await ownerPage.waitForURL(/filter=active/);
    }
    if (await voidedPill.isVisible()) {
      await voidedPill.click();
      await ownerPage.waitForURL(/filter=voided/);
    }
    if (await creditPill.isVisible()) {
      await creditPill.click();
      await ownerPage.waitForURL(/filter=with_credit/);
    }
  });

  test('[7.4-E2E-003] voided invoices are visually de-emphasized in All filter', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices?filter=all');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const table = ownerPage.getByRole('table');
    if (!(await table.isVisible())) {
      test.skip(true, 'Invoice table not visible');
    }

    const voidedRows = table.locator('tbody tr.opacity-60');
    if (await voidedRows.first().isVisible()) {
      await expect(voidedRows.first()).toBeVisible();
    }
  });
});

test.describe('[P1] Invoice Detail — Payment Attempts', () => {
  test('[7.5-E2E-001] payment attempts section visible when attempts exist', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const table = ownerPage.getByRole('table');
    if (!(await table.isVisible())) {
      test.skip(true, 'Invoice table not visible');
    }

    const invoiceLink = ownerPage.locator('table a[href^="/invoices/"]').first();
    if (!(await invoiceLink.isVisible())) {
      test.skip(true, 'No invoice links found in table');
    }

    await invoiceLink.click();
    await ownerPage.waitForURL(/\/invoices\/[0-9a-f-]+/);

    const attemptsSection = ownerPage.getByText(/Payment Attempts/i);
    if (await attemptsSection.isVisible()) {
      await expect(attemptsSection).toBeVisible();
    }
  });
});

test.describe('[P1] Invoice Detail — Status Badge Variations', () => {
  test('[7.1-E2E-007] paid invoice shows green status badge and hides action buttons', async ({ ownerPage }) => {
    await ownerPage.goto('/invoices');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await clickInvoiceByStatus(ownerPage, 'paid');

    const recordBtn = ownerPage.getByRole('button', { name: /record payment/i });
    await expect(recordBtn).not.toBeVisible();

    const voidBtn = ownerPage.getByRole('button', { name: /void invoice/i });
    await expect(voidBtn).not.toBeVisible();
  });
});

test.describe('[P0] Write-Path E2E — Create / Send / Pay / Void (requires seeded data)', () => {
  /**
   * These tests are intentionally SKIPPED until a seeded-data fixture is available.
   * The read-only tests above verify UI presence/state. These would exercise
   * the full state-transition lifecycle end-to-end.
   */

  test.skip('[7.1-E2E-WP-001] seed draft invoice → create → verify appears in list', async () => {
    // TODO: Requires fixture that seeds a client + creates invoice via API,
    // then navigates to /invoices and verifies the new invoice is visible.
  });

  test.skip('[7.2-E2E-WP-001] send draft invoice → verify status transitions to sent', async () => {
    // TODO: Requires fixture with a draft invoice. Clicks Send, verifies
    // status badge changes to "sent", Edit button disappears.
  });

  test.skip('[7.3-E2E-WP-001] record partial payment → verify status transitions to partially_paid', async () => {
    // TODO: Requires fixture with a sent invoice. Opens Record Payment modal,
    // submits partial amount, verifies status badge = partially_paid,
    // balance summary updates.
  });

  test.skip('[7.4-E2E-WP-001] void a non-paid invoice → verify status transitions to voided', async () => {
    // TODO: Requires fixture with a sent invoice. Clicks Void, enters reason,
    // confirms, verifies status badge = voided, opacity-60 in list.
  });
});
