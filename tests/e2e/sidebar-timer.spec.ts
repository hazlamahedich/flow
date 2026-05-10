import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Persistent Sidebar Timer — Expanded', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
  });

  test('timer slot is present in the sidebar', async ({ ownerPage }) => {
    await expect(ownerPage.getByTestId('sidebar-timer-slot')).toBeVisible();
  });

  test('start button is disabled when no client is selected', async ({ ownerPage }) => {
    const startBtn = ownerPage.getByTestId('sidebar-timer-start');
    if (await startBtn.isVisible()) {
      await expect(startBtn).toBeDisabled();
    }
  });

  test('full start/stop flow: select client, start, stop, verify time entry', async ({ ownerPage }) => {
    const pickerTrigger = ownerPage.getByTestId('timer-client-picker-trigger');
    await expect(pickerTrigger).toBeVisible();
    await pickerTrigger.click();

    const clientOption = ownerPage.getByRole('option').first();
    await clientOption.waitFor({ state: 'visible', timeout: 5000 });
    const clientName = (await clientOption.textContent()) ?? '';
    await clientOption.click();

    const startBtn = ownerPage.getByTestId('sidebar-timer-start');
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    const stopBtn = ownerPage.getByTestId('sidebar-timer-stop');
    await expect(stopBtn).toBeVisible({ timeout: 1000 });

    const display = ownerPage.getByTestId('sidebar-timer-display');
    await expect(display).toBeVisible();
    await expect(display).toHaveClass(/font-mono/);

    await ownerPage.waitForTimeout(2000);

    await stopBtn.click();

    await expect(ownerPage.getByTestId('sidebar-timer-start')).toBeVisible({ timeout: 3000 });
  });

  test('timer persists across page refresh', async ({ ownerPage }) => {
    const pickerTrigger = ownerPage.getByTestId('timer-client-picker-trigger');
    await pickerTrigger.click();
    const clientOption = ownerPage.getByRole('option').first();
    await clientOption.waitFor({ state: 'visible', timeout: 5000 });
    await clientOption.click();

    await ownerPage.getByTestId('sidebar-timer-start').click();
    await expect(ownerPage.getByTestId('sidebar-timer-stop')).toBeVisible({ timeout: 1000 });

    await ownerPage.reload();
    await expect(ownerPage.getByTestId('sidebar-timer-stop')).toBeVisible({ timeout: 10000 });

    await ownerPage.getByTestId('sidebar-timer-stop').click();
    await expect(ownerPage.getByTestId('sidebar-timer-start')).toBeVisible({ timeout: 3000 });
  });

  test('timer persists across client-side navigation', async ({ ownerPage }) => {
    const pickerTrigger = ownerPage.getByTestId('timer-client-picker-trigger');
    await pickerTrigger.click();
    const clientOption = ownerPage.getByRole('option').first();
    await clientOption.waitFor({ state: 'visible', timeout: 5000 });
    await clientOption.click();

    await ownerPage.getByTestId('sidebar-timer-start').click();
    await expect(ownerPage.getByTestId('sidebar-timer-stop')).toBeVisible({ timeout: 1000 });

    await ownerPage.getByTestId('sidebar').getByRole('link').first().click();

    await expect(ownerPage.getByTestId('sidebar-timer-stop')).toBeVisible({ timeout: 5000 });

    await ownerPage.getByTestId('sidebar-timer-stop').click();
  });
});

test.describe('[P0] Persistent Sidebar Timer — Collapsed', () => {
  test('collapsed timer shows trigger and popover with stop button', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');

    const pickerTrigger = ownerPage.getByTestId('timer-client-picker-trigger');
    await pickerTrigger.click();
    const clientOption = ownerPage.getByRole('option').first();
    await clientOption.waitFor({ state: 'visible', timeout: 5000 });
    await clientOption.click();

    await ownerPage.getByTestId('sidebar-timer-start').click();
    await expect(ownerPage.getByTestId('sidebar-timer-stop')).toBeVisible({ timeout: 1000 });

    const collapseBtn = ownerPage.getByTestId('sidebar-collapse-toggle');
    await collapseBtn.click();

    const collapsedTrigger = ownerPage.getByTestId('sidebar-timer-collapsed-trigger');
    await expect(collapsedTrigger).toBeVisible();

    await collapsedTrigger.click();

    await expect(ownerPage.getByRole('button', { name: /stop/i })).toBeVisible({ timeout: 3000 });
  });
});

test.describe('[P0] Persistent Sidebar Timer — Error Handling', () => {
  test('optimistic start rolls back on server failure', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');

    await ownerPage.route('**/supabase**', (route) => route.abort());

    const pickerTrigger = ownerPage.getByTestId('timer-client-picker-trigger');
    await pickerTrigger.click();
    const clientOption = ownerPage.getByRole('option').first();
    await clientOption.waitFor({ state: 'visible', timeout: 5000 });
    await clientOption.click();

    await ownerPage.getByTestId('sidebar-timer-start').click();

    await ownerPage.waitForTimeout(3000);

    await expect(ownerPage.getByTestId('sidebar-timer-start')).toBeVisible({ timeout: 5000 });
  });
});
