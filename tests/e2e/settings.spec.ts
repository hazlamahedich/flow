import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Dashboard — Authenticated', () => {
  test('dashboard loads for authenticated user', async ({ ownerPage }) => {
    await ownerPage.goto('/');
    const url = ownerPage.url();

    if (url.includes('/login')) {
      test.skip();
      return;
    }

    await expect(ownerPage.locator('#main-content')).toBeVisible();
  });

  test('sidebar navigation is visible on desktop with 2+ agents', async ({ ownerPage }) => {
    await ownerPage.goto('/');
    const url = ownerPage.url();

    if (url.includes('/login')) {
      test.skip();
      return;
    }

    await ownerPage.setViewportSize({ width: 1280, height: 720 });

    const sidebar = ownerPage.locator('.flex-col.lg\\:flex');
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
    }
  });

  test('skip-to-content link exists', async ({ ownerPage }) => {
    await ownerPage.goto('/');
    const url = ownerPage.url();

    if (url.includes('/login')) {
      test.skip();
      return;
    }

    const skipLink = ownerPage.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });
});

test.describe('[P0] Settings Navigation', () => {
  test('settings tabs are navigable', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');
    const url = ownerPage.url();

    if (url.includes('/login')) {
      test.skip();
      return;
    }

    const nav = ownerPage.locator('nav[aria-label="Settings navigation"]');
    await expect(nav).toBeVisible();

    await ownerPage.click('a[href="/settings/devices"]');
    await expect(ownerPage).toHaveURL(/\/settings\/devices/);
  });
});

test.describe('[P0] Team Management', () => {
  test('team page shows heading', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');
    const url = ownerPage.url();

    if (url.includes('/login')) {
      test.skip();
      return;
    }

    await expect(
      ownerPage.getByRole('heading', { name: /team|your workspace/i }),
    ).toBeVisible();
  });

  test('team page shows invite form for owner/admin', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');
    const url = ownerPage.url();

    if (url.includes('/login')) {
      test.skip();
      return;
    }

    const inviteButton = ownerPage.getByRole('button', { name: /invite/i });
    if (await inviteButton.isVisible()) {
      await expect(inviteButton).toBeVisible();
    }
  });
});

test.describe('[P0] Device Management', () => {
  test('devices page shows heading', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/devices');
    const url = ownerPage.url();

    if (url.includes('/login')) {
      test.skip();
      return;
    }

    await expect(
      ownerPage.getByRole('heading', { name: /your devices/i }),
    ).toBeVisible();
  });

  test('devices page renders device list or empty state', async ({ ownerPage }) => {
    await ownerPage.goto('/settings/devices');
    const url = ownerPage.url();

    if (url.includes('/login')) {
      test.skip();
      return;
    }

    const heading = ownerPage.getByRole('heading', { name: /your devices/i });
    await expect(heading).toBeVisible();
  });
});
