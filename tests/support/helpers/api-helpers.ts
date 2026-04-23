import { test as base } from '@playwright/test';

export async function waitForApiCall(
  page: import('@playwright/test').Page,
  urlPattern: string,
  method: string = 'GET',
) {
  return page.waitForResponse(
    (response) => response.url().includes(urlPattern) && response.request().method() === method,
  );
}

export async function loginWithEmail(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.click('[data-testid="send-magic-link"]');
}
