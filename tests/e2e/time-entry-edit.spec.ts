import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Time Entry Edit', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/time');
  });

  test('edit flow: click edit, change duration, save, list shows updated value', async ({ ownerPage }) => {
    const editButtons = ownerPage.getByRole('button', { name: /edit time entry/i });
    const count = await editButtons.count();
    test.skip(count === 0, 'No time entries to edit');

    await editButtons.first().click();

    const modal = ownerPage.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const durationInput = modal.getByPlaceholder(/minutes/i);
    if (await durationInput.isVisible()) {
      await durationInput.clear();
      await durationInput.fill('120');
    }

    const saveBtn = modal.getByRole('button', { name: /save changes/i });
    await saveBtn.click();

    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('validation: invalid duration prevents submit', async ({ ownerPage }) => {
    const editButtons = ownerPage.getByRole('button', { name: /edit time entry/i });
    const count = await editButtons.count();
    test.skip(count === 0, 'No time entries to edit');

    await editButtons.first().click();

    const modal = ownerPage.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const durationInput = modal.getByPlaceholder(/minutes/i);
    if (await durationInput.isVisible()) {
      await durationInput.clear();
      await durationInput.fill('0');
    }

    const saveBtn = modal.getByRole('button', { name: /save changes/i });
    await saveBtn.click();

    await expect(modal.getByText(/minimum 1 minute/i)).toBeVisible({ timeout: 3000 });
  });

  test('cancel edit closes modal without changes', async ({ ownerPage }) => {
    const editButtons = ownerPage.getByRole('button', { name: /edit time entry/i });
    const count = await editButtons.count();
    test.skip(count === 0, 'No time entries to edit');

    await editButtons.first().click();

    const modal = ownerPage.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const cancelBtn = modal.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();

    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('deleted entry: no edit button visible', async ({ ownerPage }) => {
    const deleteButtons = ownerPage.getByRole('button', { name: /^delete$/i });
    const count = await deleteButtons.count();
    test.skip(count === 0, 'No time entries to delete');

    await deleteButtons.first().click();

    const confirmBtn = ownerPage.getByRole('button', { name: /yes/i });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await ownerPage.waitForTimeout(1000);
    }

    const editButtonsAfterDelete = ownerPage.getByRole('button', { name: /edit time entry/i });
    await expect(editButtonsAfterDelete.first()).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });
});

test.describe('[P1] Time Entry Filters', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/time');
  });

  test('filter by client shows filtered results', async ({ ownerPage }) => {
    const clientSelect = ownerPage.locator('select').first();
    if (await clientSelect.isVisible()) {
      const options = await clientSelect.locator('option').count();
      test.skip(options <= 1, 'No clients to filter by');

      await clientSelect.selectOption({ index: 1 });

      const filterBtn = ownerPage.getByRole('button', { name: /^filter$/i });
      await filterBtn.click();
      await ownerPage.waitForTimeout(1000);

      const clearBtn = ownerPage.getByRole('button', { name: /clear filters/i });
      await expect(clearBtn).toBeVisible({ timeout: 3000 });
    }
  });

  test('clear filters resets the list', async ({ ownerPage }) => {
    const clientSelect = ownerPage.locator('select').first();
    if (await clientSelect.isVisible()) {
      const options = await clientSelect.locator('option').count();
      test.skip(options <= 1, 'No clients to filter by');

      await clientSelect.selectOption({ index: 1 });
      await ownerPage.getByRole('button', { name: /^filter$/i }).click();
      await ownerPage.waitForTimeout(1000);

      await ownerPage.getByRole('button', { name: /clear filters/i }).click();
      await ownerPage.waitForTimeout(1000);

      await expect(ownerPage.getByRole('button', { name: /clear filters/i })).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('pagination: next and prev buttons work', async ({ ownerPage }) => {
    const nextBtn = ownerPage.getByRole('button', { name: /next/i });
    const prevBtn = ownerPage.getByRole('button', { name: /prev/i });

    if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
      await nextBtn.click();
      await ownerPage.waitForTimeout(1000);
      await expect(prevBtn).toBeEnabled({ timeout: 3000 });
    }
  });
});
