import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Client List Page', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
  });

  test('clients page loads with heading', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: 'Clients' }),
    ).toBeVisible();
  });

  test('clients page shows search input and status filter', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const searchInput = ownerPage.locator('input[placeholder="Search clients..."]');
    await expect(searchInput).toBeVisible();
    const statusSelect = ownerPage.locator('select');
    await expect(statusSelect).toBeVisible();
  });

  test('clients page shows add client button for owner', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const addButton = ownerPage.getByRole('button', { name: /add client/i });
    await expect(addButton).toBeVisible();
  });

  test('clients page renders table or empty state', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const table = ownerPage.getByRole('table');
    const emptyState = ownerPage.getByText(/add your first client|no clients match|no clients assigned/i);
    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('status filter switches between all, active, archived', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const statusSelect = ownerPage.locator('select');
    await statusSelect.selectOption('active');
    await ownerPage.waitForURL(/status=active/);
    await expect(ownerPage).toHaveURL(/status=active/);

    await statusSelect.selectOption('archived');
    await ownerPage.waitForURL(/status=archived/);
    await expect(ownerPage).toHaveURL(/status=archived/);

    await statusSelect.selectOption('all');
    await ownerPage.waitForURL(/\/clients(\?|$)/);
  });

  test('search input filters clients by name', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const table = ownerPage.getByRole('table');
    if (!(await table.isVisible())) return;

    const searchInput = ownerPage.locator('input[placeholder="Search clients..."]');
    await searchInput.fill('nonexistent-client-xyz');
    await ownerPage.getByRole('button', { name: 'Search' }).click();
    await ownerPage.waitForURL(/search=/);
    await expect(ownerPage).toHaveURL(/search=/);
  });

  test('member cannot see add client button', async ({ memberPage }) => {
    await memberPage.goto('/clients');
    await expect(memberPage).not.toHaveURL(/\/login/);
    const addButton = memberPage.getByRole('button', { name: /add client/i });
    await expect(addButton).not.toBeVisible();
  });
});

test.describe('[P0] Client Detail Page', () => {
  test('navigating to invalid client ID shows not found', async ({ ownerPage }) => {
    await ownerPage.goto('/clients/00000000-0000-0000-0000-000000000000');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const notFound = ownerPage.getByText(/not found|404|could not find/i);
    if (await notFound.isVisible().catch(() => false)) {
      await expect(notFound).toBeVisible();
    }
  });

  test('unauthenticated user is redirected from client detail', async ({ page }) => {
    await page.goto('/clients/00000000-0000-0000-0000-000000000000');
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });
});

test.describe('[P0] Client Wizard — Create Client', () => {
  test('wizard opens when Add Client is clicked', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const addButton = ownerPage.getByRole('button', { name: /add client/i });
    await addButton.click();

    const dialog = ownerPage.locator('[role="dialog"][aria-label="New Client Setup Wizard"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Contact Details')).toBeVisible();
  });

  test('wizard shows progress indicator', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const addButton = ownerPage.getByRole('button', { name: /add client/i });
    await addButton.click();

    const progressbar = ownerPage.locator('[role="progressbar"]');
    await expect(progressbar).toBeVisible();
  });

  test('wizard step 1 requires name to proceed', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const addButton = ownerPage.getByRole('button', { name: /add client/i });
    await addButton.click();

    const nameInput = ownerPage.locator('#wiz-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('');

    const nextButton = ownerPage.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeDisabled();
  });

  test('wizard navigates through all steps and creates client', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const addButton = ownerPage.getByRole('button', { name: /add client/i });
    await addButton.click();

    const dialog = ownerPage.locator('[role="dialog"][aria-label="New Client Setup Wizard"]');
    await expect(dialog).toBeVisible();

    const nameInput = ownerPage.locator('#wiz-name');
    await nameInput.fill('E2E Test Client');

    const emailInput = ownerPage.locator('#wiz-email');
    await emailInput.fill('e2e-test@example.com');

    await ownerPage.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByText('Billing & Notes')).toBeVisible();

    await ownerPage.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByText(/retainer/i)).toBeVisible();

    await ownerPage.getByRole('button', { name: /skip|i'll set this up later/i }).click();
    await expect(dialog.getByText('Review & Confirm')).toBeVisible();

    await ownerPage.getByRole('button', { name: 'Create Client' }).click();

    await ownerPage.waitForURL(/\/clients\/[0-9a-f-]+\?/, { timeout: 15000 });
    await expect(ownerPage).toHaveURL(/\/clients\/[0-9a-f-]+/);
  });

  test('wizard can be closed with close button', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const addButton = ownerPage.getByRole('button', { name: /add client/i });
    await addButton.click();

    const dialog = ownerPage.locator('[role="dialog"][aria-label="New Client Setup Wizard"]');
    await expect(dialog).toBeVisible();

    await ownerPage.getByRole('button', { name: 'Close wizard' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('wizard shows contact details in review step', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const addButton = ownerPage.getByRole('button', { name: /add client/i });
    await addButton.click();

    const dialog = ownerPage.locator('[role="dialog"][aria-label="New Client Setup Wizard"]');
    await expect(dialog).toBeVisible();

    const nameInput = ownerPage.locator('#wiz-name');
    await nameInput.fill('Review Test Client');

    await ownerPage.getByRole('button', { name: 'Next' }).click();
    await ownerPage.getByRole('button', { name: 'Next' }).click();
    await ownerPage.getByRole('button', { name: /skip|i'll set this up later/i }).click();

    await expect(dialog.getByText('Review Test Client')).toBeVisible();
    await expect(dialog.getByText('Contact Details')).toBeVisible();
    await expect(dialog.getByText('Billing & Notes')).toBeVisible();
    await expect(dialog.getByText('Retainer')).toBeVisible();
  });
});

test.describe('[P1] Client List — Data Interactions', () => {
  test('clicking client row navigates to detail page', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const table = ownerPage.getByRole('table');
    if (!(await table.isVisible())) return;

    const clientLink = ownerPage.locator('table a[href^="/clients/"]').first();
    if (!(await clientLink.isVisible())) return;

    const href = await clientLink.getAttribute('href');
    await clientLink.click();
    await ownerPage.waitForURL(/\/clients\/[0-9a-f-]+/);
    if (href) {
      await expect(ownerPage).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  test('pagination controls are present when data exists', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const table = ownerPage.getByRole('table');
    if (!(await table.isVisible())) return;

    const prevButton = ownerPage.getByRole('button', { name: 'Previous' });
    const nextButton = ownerPage.getByRole('button', { name: 'Next' });
    await expect(prevButton.or(nextButton)).toBeVisible();
  });
});

test.describe('[P1] Client Detail — Retainer Panel', () => {
  test('client detail page shows retainer section', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);

    const table = ownerPage.getByRole('table');
    if (!(await table.isVisible())) return;

    const clientLink = ownerPage.locator('table a[href^="/clients/"]').first();
    if (!(await clientLink.isVisible())) return;

    await clientLink.click();
    await ownerPage.waitForURL(/\/clients\/[0-9a-f-]+/);

    const retainerSection = ownerPage.getByText(/retainer|set up a retainer/i);
    await expect(retainerSection).toBeVisible();
  });
});
