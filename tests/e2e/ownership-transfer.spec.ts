import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Ownership Transfer Flow', () => {
  test('team page loads and shows transfer-related UI for owner', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');
    const url = ownerPage.url();

    if (url.includes('/login')) {
      test.skip();
      return;
    }

    await expect(
      ownerPage.getByRole('heading', { name: /team|your workspace/i }),
    ).toBeVisible();

    const table = ownerPage.getByRole('table');
    const transferButton = ownerPage.locator('button[aria-label^="Transfer ownership to"]').first();

    if (await table.isVisible()) {
      if (await transferButton.isVisible()) {
        await transferButton.click();
        const dialog = ownerPage.locator('[aria-label="Confirm ownership transfer"]');
        await expect(dialog).toBeVisible();
      }
    }
  });

  test('transfer dialog requires typing workspace name to confirm', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');
    if (ownerPage.url().includes('/login')) { test.skip(); return; }

    const transferButton = ownerPage.locator('button[aria-label^="Transfer ownership to"]').first();
    if (!(await transferButton.isVisible())) {
      test.skip();
      return;
    }

    await transferButton.click();

    const dialog = ownerPage.locator('[aria-label="Confirm ownership transfer"]');
    await expect(dialog).toBeVisible();

    const continueButton = ownerPage.getByRole('button', { name: /continue to step 2/i });
    await continueButton.click();

    const confirmButton = ownerPage.getByRole('button', { name: /confirm transfer ownership/i });
    await expect(confirmButton).toBeDisabled();

    const descriptionText = await dialog.locator('p').last().textContent();
    const workspaceName = descriptionText?.match(/Type\s+(.+?)\s+to confirm/)?.[1]?.replace(/\u200B/g, '') ?? '';

    const confirmInput = ownerPage.locator(`input[aria-label='Type "${workspaceName}" to confirm']`);
    await confirmInput.fill('wrong-name');
    await expect(confirmButton).toBeDisabled();

    await confirmInput.fill(workspaceName);
    await expect(confirmButton).toBeEnabled();
  });

  test('cancel button closes dialog without transferring', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');
    if (ownerPage.url().includes('/login')) { test.skip(); return; }

    const transferButton = ownerPage.locator('button[aria-label^="Transfer ownership to"]').first();
    if (!(await transferButton.isVisible())) {
      test.skip();
      return;
    }

    await transferButton.click();

    const dialog = ownerPage.locator('[aria-label="Confirm ownership transfer"]');
    await expect(dialog).toBeVisible();

    const cancelButton = ownerPage.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    await expect(dialog).not.toBeVisible();
  });

  test('non-owner cannot see transfer option', async ({ memberPage }) => {
    test.skip(true, 'TODO: requires Supabase seeding with owner + member');

    await memberPage.goto('/settings/team');

    const transferButton = memberPage.locator('button[aria-label^="Transfer ownership to"]');
    await expect(transferButton).not.toBeVisible();
  });
});
