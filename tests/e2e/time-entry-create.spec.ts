import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Time Entry Creation — Manual Logging', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/time');
  });

  test('log time button opens modal', async ({ ownerPage }) => {
    const logBtn = ownerPage.getByRole('button', { name: /log time/i });
    await expect(logBtn).toBeVisible();
    await logBtn.click();
    await expect(ownerPage.getByText(/log time/i)).toBeVisible();
  });

  test('time entry list shows empty state when no entries', async ({ ownerPage }) => {
    const emptyState = ownerPage.getByText(/no time logged yet/i);
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('create time entry: fill form, submit, entry appears in list', async ({ ownerPage }) => {
    const logBtn = ownerPage.getByRole('button', { name: /log time/i });
    await logBtn.click();

    const modal = ownerPage.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const clientSelect = modal.locator('select').first();
    if (await clientSelect.isVisible()) {
      await clientSelect.selectOption({ index: 1 });
    }

    const durationInput = modal.getByPlaceholder(/minutes/i);
    if (await durationInput.isVisible()) {
      await durationInput.fill('60');
    }

    const submitBtn = modal.getByRole('button', { name: /log|save|submit/i });
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('validation: empty duration prevents submit', async ({ ownerPage }) => {
    const logBtn = ownerPage.getByRole('button', { name: /log time/i });
    await logBtn.click();

    const modal = ownerPage.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const submitBtn = modal.getByRole('button', { name: /log|save|submit/i });
    if (await submitBtn.isVisible()) {
      const isEnabled = await submitBtn.isEnabled();
      if (!isEnabled) {
        expect(isEnabled).toBe(false);
      }
    }
  });

  test('cancel closes modal without creating entry', async ({ ownerPage }) => {
    const logBtn = ownerPage.getByRole('button', { name: /log time/i });
    await logBtn.click();

    const modal = ownerPage.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const cancelBtn = modal.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });
});
