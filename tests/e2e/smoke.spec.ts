import { test, expect } from '../support/merged-fixtures';

test.describe('Health Check', () => {
  test('[P0] app loads and responds with 200', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
  });
});

test.describe('Smoke — Authentication Page', () => {
  test('[P0] login page renders email input and submit button', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
  });

  test('[P0] login page shows heading', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /sign in to flow/i })).toBeVisible();
  });
});
