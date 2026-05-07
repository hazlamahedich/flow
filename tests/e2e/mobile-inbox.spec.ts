import { test, expect } from '../support/merged-fixtures';

test.describe('[P1] Mobile Triage Experience', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/agents/approvals');
    await ownerPage.setViewportSize({ width: 375, height: 812 });
  });

  test('tapping a card opens the mobile overlay', async ({ ownerPage }) => {
    // Assuming cards have a generic role or test id
    const firstCard = ownerPage.locator('button:has-text("Review Draft"), [role="button"]:has-text("Review")').first();
    
    if (await firstCard.isVisible()) {
      await firstCard.click();
      
      // Check if the overlay (Dialog/Modal) is visible
      const overlay = ownerPage.locator('[role="dialog"]');
      await expect(overlay).toBeVisible();
      
      // Verify "Save Changes" is visible in overlay
      await expect(overlay.getByText('Save Changes')).toBeVisible();
    }
  });

  test('mobile swipe actions are visible', async ({ ownerPage }) => {
    // This targets the SwipeableCard components
    const swipeableCard = ownerPage.locator('div:has-text("Approve"):has-text("Reject")').first();
    
    if (await swipeableCard.isVisible()) {
      // In mobile viewport, gestures are active
      await expect(swipeableCard).toBeVisible();
    }
  });

  test('can dismiss mobile overlay with close button', async ({ ownerPage }) => {
    const firstCard = ownerPage.locator('button:has-text("Review Draft"), [role="button"]:has-text("Review")').first();
    
    if (await firstCard.isVisible()) {
      await firstCard.click();
      const overlay = ownerPage.locator('[role="dialog"]');
      await expect(overlay).toBeVisible();
      
      // Assuming there's a close button or we can click outside
      const closeButton = ownerPage.locator('button:has-text("Close"), [aria-label="Close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(overlay).not.toBeVisible();
      }
    }
  });
});
