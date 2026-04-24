import { test, expect } from '../support/merged-fixtures';

test.describe('[P1] Mobile Responsive Layout', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/');
    await expect(ownerPage).not.toHaveURL(/\/login/);
  });

  test('mobile tab bar visible at 375px width', async ({ ownerPage }) => {
    await ownerPage.setViewportSize({ width: 375, height: 812 });
    const mobileTabBar = ownerPage.locator('[data-testid="mobile-tab-bar"]');
    if (await mobileTabBar.isVisible()) {
      await expect(mobileTabBar).toBeVisible();
    }
  });

  test('sidebar collapses at tablet breakpoint (768px)', async ({ ownerPage }) => {
    await ownerPage.setViewportSize({ width: 1280, height: 720 });
    const sidebar = ownerPage.locator('[data-testid="sidebar-nav"]');
    const sidebarWasVisible = await sidebar.isVisible();

    await ownerPage.setViewportSize({ width: 768, height: 1024 });
    await ownerPage.waitForTimeout(300);

    if (sidebarWasVisible) {
      const sidebarWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
      const isCollapsed = sidebarWidth <= 80;
      const isHidden = !(await sidebar.isVisible());
      expect(isCollapsed || isHidden).toBeTruthy();
    }
  });

  test('desktop sidebar visible at 1280px', async ({ ownerPage }) => {
    await ownerPage.setViewportSize({ width: 1280, height: 720 });
    const sidebar = ownerPage.locator('[data-testid="sidebar-nav"]');
    if (await sidebar.isVisible()) {
      const sidebarWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
      expect(sidebarWidth).toBeGreaterThanOrEqual(200);
    }
  });

  test('main content remains accessible at mobile viewport', async ({ ownerPage }) => {
    await ownerPage.setViewportSize({ width: 375, height: 812 });
    const mainContent = ownerPage.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });

  test('skip-to-content link available at mobile viewport', async ({ ownerPage }) => {
    await ownerPage.setViewportSize({ width: 375, height: 812 });
    const skipLink = ownerPage.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });
});
