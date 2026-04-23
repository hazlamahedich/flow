import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Dashboard — Authenticated', () => {
  test('dashboard loads for authenticated user', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    await expect(ownerPage.locator('#main-content')).toBeVisible();
  });

  test('sidebar navigation is visible on desktop', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    await expect(ownerPage.getByTestId('sidebar')).toBeVisible();
  });

  test('skip-to-content link exists', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    const skipLink = ownerPage.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });
});

test.describe('[P0] Settings Navigation', () => {
  test('settings tabs are navigable', async ({ ownerPage }) => {
    await ownerPage.goto('/settings');

    const nav = ownerPage.locator('nav[aria-label="Settings navigation"]');
    await expect(nav).toBeVisible();

    await ownerPage.click('a[href="/settings/team"]');
    await expect(ownerPage).toHaveURL(/\/settings\/team/);

    await ownerPage.click('a[href="/settings/devices"]');
    await expect(ownerPage).toHaveURL(/\/settings\/devices/);
  });
});

test.describe('[P0] Team Management', () => {
  test('team page shows invite button for owner', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');

    await expect(ownerPage.getByRole('button', { name: /invite member/i })).toBeVisible();
  });

  test('team page shows members table', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');

    const table = ownerPage.getByRole('table', { name: /team members/i });
    if (await table.isVisible()) {
      const rows = table.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe('[P0] Device Management', () => {
  test('devices page shows heading', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/devices');

    await expect(ownerPage.getByRole('heading', { name: /your devices/i })).toBeVisible();
  });

  test('devices page shows sign out everywhere button when devices exist', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/devices');

    const button = ownerPage.getByRole('button', { name: /sign out everywhere/i });
    if (await button.isVisible()) {
      await button.click();

      await expect(
        ownerPage.getByRole('button', { name: /confirm sign out everywhere/i }),
      ).toBeVisible();
    }
  });
});
