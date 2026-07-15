/**
 * Story 9.5b T5.4 — DowngradeBanner component tests.
 *
 * Verifies rendering conditions, dismiss-until-new-event semantics with
 * `last-archived-at` localStorage timestamp, and upgrade CTA wiring.
 *
 * FR57 (auto-upgrade prompt)
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { mockOnUpgrade } = vi.hoisted(() => ({
  mockOnUpgrade: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));

// Stub localStorage with a real Map-backed implementation (jsdom's localStorage
// does not include `clear` reliably across vitest versions).
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
  removeItem: vi.fn((key: string) => { store.delete(key); }),
  clear: vi.fn(() => { store.clear(); }),
  length: 0,
  key: vi.fn(),
});

import { DowngradeBanner } from '../DowngradeBanner';

const PROPS = {
  archivedCount: 3,
  archivedAt: '2026-06-18T00:00:00.000Z' as string | null,
  workspaceId: 'ws-test-1',
  onUpgrade: mockOnUpgrade,
};

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
});

afterEach(() => {
  cleanup();
});

describe('DowngradeBanner — render conditions', () => {
  test('renders when archivedCount > 0', () => {
    render(<DowngradeBanner {...PROPS} archivedCount={2} />);
    expect(screen.getByTestId('downgrade-banner')).toBeDefined();
    expect(screen.getByText(/You have 2 archived clients/)).toBeDefined();
  });

  test('does NOT render when archivedCount = 0', () => {
    const { container } = render(<DowngradeBanner {...PROPS} archivedCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  test('does NOT render when archivedAt is null', () => {
    const { container } = render(<DowngradeBanner {...PROPS} archivedAt={null} archivedCount={3} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders singular "client" when archivedCount = 1', () => {
    render(<DowngradeBanner {...PROPS} archivedCount={1} />);
    expect(screen.getByText(/You have 1 archived client/)).toBeDefined();
  });
});

describe('DowngradeBanner — dismiss-until-new-event semantics', () => {
  test('dismiss writes archivedAt to localStorage (per-workspace key)', () => {
    render(<DowngradeBanner {...PROPS} />);
    fireEvent.click(screen.getByTestId('downgrade-banner-dismiss'));
    expect(store.get('flow:downgrade-banner:dismissed:ws-test-1')).toBe(PROPS.archivedAt);
  });

  test('does NOT re-render after dismiss for the SAME archive event', () => {
    store.set('flow:downgrade-banner:dismissed:ws-test-1', PROPS.archivedAt as string);
    const { container } = render(<DowngradeBanner {...PROPS} />);
    expect(container.firstChild).toBeNull();
  });

  test('re-renders when a NEW archive event arrives (later timestamp)', () => {
    store.set('flow:downgrade-banner:dismissed:ws-test-1', '2026-06-17T00:00:00.000Z');
    render(<DowngradeBanner {...PROPS} archivedAt="2026-06-18T12:00:00.000Z" />);
    expect(screen.getByTestId('downgrade-banner')).toBeDefined();
  });

  test('does NOT re-render for an OLDER event than the dismissed one', () => {
    store.set('flow:downgrade-banner:dismissed:ws-test-1', '2026-06-18T00:00:00.000Z');
    render(<DowngradeBanner {...PROPS} archivedAt="2026-06-17T00:00:00.000Z" />);
    expect(screen.queryByTestId('downgrade-banner')).toBeNull();
  });

  test('namespaces dismiss per workspace', () => {
    store.set('flow:downgrade-banner:dismissed:ws-other', PROPS.archivedAt as string);
    render(<DowngradeBanner {...PROPS} workspaceId="ws-test-1" />);
    expect(screen.getByTestId('downgrade-banner')).toBeDefined();
  });
});

describe('DowngradeBanner — CTA wiring', () => {
  test('Upgrade button calls onUpgrade with {tier: pro, interval: monthly}', () => {
    mockOnUpgrade.mockResolvedValueOnce({ success: true, data: { checkoutUrl: 'https://checkout.example' } });
    render(<DowngradeBanner {...PROPS} archivedAt="2026-06-18T00:00:00.000Z" />);
    fireEvent.click(screen.getByTestId('downgrade-banner-upgrade'));
    expect(mockOnUpgrade).toHaveBeenCalledWith({ tier: 'pro', interval: 'monthly' });
  });

  test('View archived clients link points to /clients?status=archived (existing param)', () => {
    render(<DowngradeBanner {...PROPS} archivedAt="2026-06-18T00:00:00.000Z" />);
    const link = screen.getByTestId('downgrade-banner-view-archived') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/clients?status=archived');
  });
});
