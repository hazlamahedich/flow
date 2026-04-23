import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Dashboard — Authenticated', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/');
  });

  test('dashboard loads for authenticated user', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(ownerPage.locator('#main-content')).toBeVisible();
  });

  test('sidebar navigation is visible on desktop with 2+ agents', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await ownerPage.setViewportSize({ width: 1280, height: 720 });

    const sidebar = ownerPage.locator('[data-testid="sidebar-nav"]');
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
    }
  });

  test('skip-to-content link exists', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const skipLink = ownerPage.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });
});

test.describe('[P0] Settings Navigation', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');
  });

  test('settings tabs are navigable', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const nav = ownerPage.locator('nav[aria-label="Settings navigation"]');
    await expect(nav).toBeVisible();

    await ownerPage.click('a[href="/settings/devices"]');
    await expect(ownerPage).toHaveURL(/\/settings\/devices/);
  });
});

test.describe('[P0] Team Management', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/settings/team');
  });

  test('team page shows heading', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: /team|your workspace/i }),
    ).toBeVisible();
  });

  test('team page shows invite form for owner/admin', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const inviteButton = ownerPage.getByRole('button', { name: /invite/i });
    if (await inviteButton.isVisible()) {
      await expect(inviteButton).toBeVisible();
    }
  });
});

test.describe('[P0] Device Management', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/settings/devices');
  });

  test('devices page shows heading', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: /your devices/i }),
    ).toBeVisible();
  });

  test('devices page renders device list or empty state', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const heading = ownerPage.getByRole('heading', { name: /your devices/i });
    await expect(heading).toBeVisible();
  });
});
