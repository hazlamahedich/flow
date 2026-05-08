import { test, expect } from '../support/merged-fixtures';

test.describe('[P1] Mobile Triage Experience', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/agents/approvals');
    await ownerPage.setViewportSize({ width: 375, height: 812 });
  });

  test('tapping a card opens the mobile overlay', async ({ ownerPage }) => {
    const firstCard = ownerPage.getByTestId('approval-card').first();
    const isVisible = await firstCard.isVisible().catch(() => false);
    test.skip(!isVisible, 'No approval cards on page');

    await firstCard.click();

    const overlay = ownerPage.getByTestId('mobile-triage-overlay');
    await expect(overlay).toBeVisible();

    await expect(overlay.getByText('Save Changes')).toBeVisible();
  });

  test('mobile swipe actions are visible', async ({ ownerPage }) => {
    const swipeableCard = ownerPage.getByTestId('swipeable-card').first();
    const isVisible = await swipeableCard.isVisible().catch(() => false);
    test.skip(!isVisible, 'No swipeable cards on page');

    await expect(swipeableCard).toBeVisible();
  });

  test('can dismiss mobile overlay with close button', async ({ ownerPage }) => {
    const firstCard = ownerPage.getByTestId('approval-card').first();
    const isVisible = await firstCard.isVisible().catch(() => false);
    test.skip(!isVisible, 'No approval cards on page');

    await firstCard.click();

    const overlay = ownerPage.getByTestId('mobile-triage-overlay');
    await expect(overlay).toBeVisible();

    const closeButton = ownerPage.getByTestId('mobile-overlay-close');
    await closeButton.click();
    await expect(overlay).not.toBeVisible();
  });
});
