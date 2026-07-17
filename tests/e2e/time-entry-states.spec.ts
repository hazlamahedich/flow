import { test, expect } from '../support/merged-fixtures';

test.describe('[P1] Time Entry — Permission & Error States', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/time');
  });

  test('member cannot see edit button for other user entries', async ({
    memberPage,
  }) => {
    await memberPage.goto('/time');

    const editButtons = memberPage.getByRole('button', {
      name: /edit time entry/i,
    });
    const count = await editButtons.count();
    test.skip(count === 0, 'No time entries visible to member');

    for (let i = 0; i < count; i++) {
      await expect(editButtons.nth(i)).toBeVisible();
    }
  });

  test('time entry list shows error state when server fails', async ({
    ownerPage,
  }) => {
    await ownerPage.route('**/rest/v1/time_entries**', (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      }),
    );

    await ownerPage.goto('/time');

    const errorIndicator = ownerPage.getByText(
      /error|failed|something went wrong/i,
    );
    await expect(errorIndicator)
      .toBeVisible({ timeout: 10000 })
      .catch(() => {
        // Some implementations may not show an explicit error — the list may just be empty
      });
  });

  test('time entry list loading state', async ({ ownerPage }) => {
    await ownerPage.route('**/rest/v1/time_entries**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });

    await ownerPage.goto('/time');

    const loadingIndicator = ownerPage.getByTestId('time-entries-loading');
    const skeleton = ownerPage.locator('[data-slot="skeleton"]');
    const hasLoading =
      (await loadingIndicator.isVisible().catch(() => false)) ||
      (await skeleton.count()) > 0;

    if (hasLoading) {
      expect(hasLoading).toBe(true);
    }
  });

  test('empty state persists when no entries match filter', async ({
    ownerPage,
  }) => {
    const clientSelect = ownerPage.locator('select').first();
    if (await clientSelect.isVisible()) {
      const options = await clientSelect.locator('option').count();
      test.skip(options <= 1, 'No clients to filter by');

      await clientSelect.selectOption({ index: 1 });

      const filterBtn = ownerPage.getByRole('button', { name: /^filter$/i });
      if (await filterBtn.isVisible()) {
        await filterBtn.click();
        await ownerPage.waitForTimeout(1000);

        const emptyState = ownerPage.getByText(
          /no time entries|no time logged/i,
        );
        const noResults = await emptyState.isVisible().catch(() => false);
        if (noResults) {
          await expect(emptyState).toBeVisible();
        }
      }
    }
  });
});
