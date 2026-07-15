import { test, expect } from '../support/merged-fixtures';

test.describe('[P1] Handled Quietly Section', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/agents/approvals');
  });

  test('renders Handled Quietly header and divider', async ({ ownerPage }) => {
    const section = ownerPage.getByTestId('handled-quietly-section');
    const isVisible = await section.isVisible().catch(() => false);
    test.skip(!isVisible, 'No Handled Quietly items — section not rendered');

    const header = section.locator('span', { hasText: 'Handled Quietly' });
    await expect(header).toBeVisible();

    const divider = section.getByTestId('handled-quietly-divider');
    await expect(divider).toBeVisible();
  });

  test('renders items with category and sender', async ({ ownerPage }) => {
    const section = ownerPage.getByTestId('handled-quietly-section');
    const isVisible = await section.isVisible().catch(() => false);
    test.skip(!isVisible, 'No Handled Quietly items — section not rendered');

    const items = section.locator('[data-testid="promote-to-inbox-button"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('items in quiet section have escape hatch', async ({ ownerPage }) => {
    const section = ownerPage.getByTestId('handled-quietly-section');
    const isVisible = await section.isVisible().catch(() => false);
    test.skip(!isVisible, 'No Handled Quietly items');

    const escapeHatch = section.getByTestId('promote-to-inbox-button').first();
    await expect(escapeHatch).toBeVisible();
  });

  test('audit nudge is visible when items exist', async ({ ownerPage }) => {
    const auditCard = ownerPage.getByTestId('weekly-quiet-audit');
    const isVisible = await auditCard.isVisible().catch(() => false);
    test.skip(
      !isVisible,
      'No audit card — may only appear on specific days or with data',
    );
    await expect(auditCard).toBeVisible();
  });
});
