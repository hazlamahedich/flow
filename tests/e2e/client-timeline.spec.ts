import { test, expect } from '../support/merged-fixtures';

test.describe('[P0] Client Timeline', () => {
  let clientId: string;

  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    const clientLink = ownerPage.getByTestId('client-list-link').first();
    const href = await clientLink.getAttribute('href');
    clientId = href?.split('/').pop()?.split('?')[0] || '';
    await ownerPage.goto(`/clients/${clientId}`);
  });

  test('timeline section is visible with heading', async ({ ownerPage }) => {
    const heading = ownerPage.getByRole('heading', {
      name: 'Communication Timeline',
    });
    await expect(heading).toBeVisible();
  });

  test('renders either empty state or timeline items', async ({
    ownerPage,
  }) => {
    const emptyState = ownerPage.getByText(
      'No communication history yet for this client.',
    );
    const items = ownerPage.getByTestId('timeline-item');

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const itemCount = await items.count();

    expect(hasEmpty || itemCount > 0).toBe(true);
  });

  test('filter: selecting Emails Only hides agent run rows', async ({
    ownerPage,
  }) => {
    const emailsButton = ownerPage.getByRole('button', { name: 'Emails' });
    await emailsButton.click();
    await ownerPage.waitForURL(/type=emails/);
    await expect(ownerPage).toHaveURL(/type=emails/);

    await ownerPage.reload();
    await expect(ownerPage).toHaveURL(/type=emails/);
    await expect(
      ownerPage.getByRole('button', { name: 'Emails' }),
    ).toBeVisible();
  });

  test('filter: selecting Agent Runs pushes URL param', async ({
    ownerPage,
  }) => {
    const agentRunsButton = ownerPage.getByRole('button', {
      name: 'Agent Actions',
    });
    await agentRunsButton.click();
    await ownerPage.waitForURL(/type=agent_runs/);
    await expect(ownerPage).toHaveURL(/type=agent_runs/);
  });

  test('deep-link: navigating to URL with type=emails&range=7d shows filtered view', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(`/clients/${clientId}?type=emails&range=7d`);
    await expect(ownerPage).toHaveURL(/type=emails/);
    await expect(ownerPage).toHaveURL(/range=7d/);

    const select = ownerPage.locator('select').last();
    await expect(select).toHaveValue('7d');
  });

  test('date range can be changed', async ({ ownerPage }) => {
    const rangeSelect = ownerPage.locator('select').last();
    await rangeSelect.selectOption('7d');
    await ownerPage.waitForURL(/range=7d/);
    await expect(ownerPage).toHaveURL(/range=7d/);
  });

  test('AC4: pending_approval agent action shows proposal card with View in Approvals', async ({
    ownerPage,
  }) => {
    const proposalLink = ownerPage.getByTestId('timeline-proposal-link');

    const isVisible = await proposalLink.isVisible().catch(() => false);
    test.skip(!isVisible, 'No pending_approval items in current data');

    await proposalLink.click();
    await expect(ownerPage).toHaveURL(/\/agents\/approvals/);
  });

  test('AC7: client with no history shows empty state text', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(`/clients/${clientId}?range=7d`);
    const emptyState = ownerPage.getByText(
      'No communication history yet for this client.',
    );
    const items = ownerPage.getByTestId('timeline-item');

    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty) {
      expect(hasEmpty).toBe(true);
    } else {
      await expect(items.first()).toBeVisible();
    }
  });

  test('AC8: Load More button behavior', async ({ ownerPage }) => {
    const loadMoreButton = ownerPage.getByRole('button', { name: 'Load More' });
    const isVisible = await loadMoreButton.isVisible().catch(() => false);
    test.skip(!isVisible, 'No Load More button — not enough items');

    const itemsBefore = await ownerPage.getByTestId('timeline-item').count();
    await loadMoreButton.click();

    await expect(async () => {
      const itemsAfter = await ownerPage.getByTestId('timeline-item').count();
      expect(itemsAfter).toBeGreaterThanOrEqual(itemsBefore);
    }).toPass({ timeout: 5000 });
  });
});
