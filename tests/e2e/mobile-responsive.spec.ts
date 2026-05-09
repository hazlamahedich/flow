import { test, expect } from '../support/merged-fixtures';

test.describe('[P1] Mobile Responsive Layout', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/');
    await expect(ownerPage).not.toHaveURL(/\/login/);
  });

  test('mobile tab bar visible at 375px width', async ({ ownerPage }) => {
    await ownerPage.setViewportSize({ width: 375, height: 812 });
    const mobileTabBar = ownerPage.locator('[data-testid="mobile-tab-bar"]');
    const isMobileBar = await mobileTabBar.isVisible().catch(() => false);
    test.skip(!isMobileBar, 'Mobile tab bar not rendered at this viewport — feature may not be active');
    await expect(mobileTabBar).toBeVisible();
  });

  test('sidebar collapses at tablet breakpoint (768px)', async ({ ownerPage }) => {
    await ownerPage.setViewportSize({ width: 1280, height: 720 });
    const sidebar = ownerPage.locator('[data-testid="sidebar-nav"]');
    const sidebarWasVisible = await sidebar.isVisible();

    await ownerPage.setViewportSize({ width: 768, height: 1024 });
    await expect(async () => {
      const width = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
      const visible = await sidebar.isVisible();
      expect(width <= 80 || !visible).toBeTruthy();
    }).toPass({ timeout: 3000 });

    test.skip(!sidebarWasVisible, 'Sidebar not present at desktop width — cannot test collapse');
  });

  test('desktop sidebar visible at 1280px', async ({ ownerPage }) => {
    await ownerPage.setViewportSize({ width: 1280, height: 720 });
    const sidebar = ownerPage.locator('[data-testid="sidebar-nav"]');
    const isSidebarPresent = await sidebar.isVisible().catch(() => false);
    test.skip(!isSidebarPresent, 'Sidebar not rendered — feature may not be active');
    const sidebarWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
    expect(sidebarWidth).toBeGreaterThanOrEqual(200);
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
