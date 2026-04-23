import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Login Flow', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/');

    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });

  test('login page renders magic link form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#trustDevice')).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('not-an-email');
    await page.getByRole('button', { name: /send magic link/i }).click();

    await expect(page.locator('#email-error')).toBeVisible();
  });

  test('accepts valid email and shows confirmation', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('test@example.com');
    await page.getByRole('button', { name: /send magic link/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('[P0] Auth Callback Error Handling', () => {
  test('shows error page for invalid auth callback', async ({ page }) => {
    await page.goto('/auth/callback?error=access_denied');

    await page.waitForURL('**/auth/callback/error**');
    await expect(page.getByText(/error|expired|invalid/i)).toBeVisible();
  });
});

test.describe('[P0] Workspace Guard', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('protected settings page redirects to login', async ({ page }) => {
    await page.goto('/settings/team');

    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });

  test('protected devices page redirects to login', async ({ page }) => {
    await page.goto('/settings/devices');

    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });
});
