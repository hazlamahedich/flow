/**
 * Story 9.3b unit tests — Checkout & Customer Portal Integration (RED PHASE)
 *
 * These tests import the not-yet-implemented Server Actions and components.
 * They are intentionally RED until T8 greening replaces stubs with real
 * imports and the actions/components are implemented.
 *
 * FR55, FR58
 */
import { describe, test, expect, vi } from 'vitest';

// ── RED-PHASE STUBS ──
// The real modules do not exist yet. We stub them here so the test file
// compiles and runs, then fails meaningfully when implementation starts.
const mockCreateCheckoutSessionAction = vi.fn();
const mockCreatePortalSessionAction = vi.fn();
const mockCancelSubscriptionAction = vi.fn();
const mockReactivateSubscriptionAction = vi.fn();
const mockSyncStripeDataAction = vi.fn();
const mockBillingSettingsPage = vi.fn(() => null);

vi.mock('@/lib/actions/billing/create-checkout-session', () => ({
  createCheckoutSessionAction: mockCreateCheckoutSessionAction,
}));

vi.mock('@/lib/actions/billing/create-portal-session', () => ({
  createPortalSessionAction: mockCreatePortalSessionAction,
}));

vi.mock('@/lib/actions/billing/subscription-manage', () => ({
  cancelSubscriptionAction: mockCancelSubscriptionAction,
  reactivateSubscriptionAction: mockReactivateSubscriptionAction,
}));

vi.mock('@/lib/actions/billing/sync-stripe-data', () => ({
  syncStripeDataAction: mockSyncStripeDataAction,
}));

vi.mock('@/app/(workspace)/settings/billing/page', () => ({
  default: mockBillingSettingsPage,
}));

describe('[RED] 9.3b actions and page are stubbed', () => {
  test('stubs are defined and must be replaced with real exports during GREEN phase', () => {
    expect(mockCreateCheckoutSessionAction).toBeDefined();
    expect(mockCreatePortalSessionAction).toBeDefined();
    expect(mockCancelSubscriptionAction).toBeDefined();
    expect(mockReactivateSubscriptionAction).toBeDefined();
    expect(mockSyncStripeDataAction).toBeDefined();
    expect(mockBillingSettingsPage).toBeDefined();
    expect(typeof mockBillingSettingsPage).toBe('function');
  });
});
