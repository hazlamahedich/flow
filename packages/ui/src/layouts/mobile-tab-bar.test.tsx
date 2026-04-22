import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MobileTabBar } from './mobile-tab-bar';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

beforeEach(() => {
  mockUsePathname.mockReturnValue('/inbox');
});

function renderTabBar() {
  return render(<MobileTabBar />);
}

describe('MobileTabBar', () => {
  it('renders Inbox, Calendar, and More', () => {
    const { container } = renderTabBar();
    expect(container.querySelector('a[href="/inbox"]')).not.toBeNull();
    expect(container.querySelector('a[href="/calendar"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="More navigation"]')).not.toBeNull();
  });

  it('highlights active tab with aria-current', () => {
    mockUsePathname.mockReturnValue('/inbox');
    const { container } = renderTabBar();
    const inboxLink = container.querySelector('a[href="/inbox"]');
    expect(inboxLink?.getAttribute('aria-current')).toBe('page');
  });

  it('opens bottom sheet on More click', () => {
    const { container } = renderTabBar();
    fireEvent.click(container.querySelector('button[aria-label="More navigation"]')!);
    expect(container.querySelector('[data-testid="mobile-bottom-sheet"]')).not.toBeNull();
  });

  it('renders 6 overflow items in sheet', () => {
    const { container } = renderTabBar();
    fireEvent.click(container.querySelector('button[aria-label="More navigation"]')!);
    const sheet = container.querySelector('[data-testid="mobile-bottom-sheet"]');
    const expectedHrefs = ['/agents', '/clients', '/invoices', '/time', '/reports', '/settings'];
    expectedHrefs.forEach((href) => {
      expect(sheet?.querySelector(`a[href="${href}"]`)).not.toBeNull();
    });
  });

  it('closes sheet on Escape', () => {
    const { container } = renderTabBar();
    fireEvent.click(container.querySelector('button[aria-label="More navigation"]')!);
    expect(container.querySelector('[data-testid="mobile-bottom-sheet"]')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('[data-testid="mobile-bottom-sheet"]')).toBeNull();
  });

  it('closes sheet on backdrop click', () => {
    const { container } = renderTabBar();
    fireEvent.click(container.querySelector('button[aria-label="More navigation"]')!);
    expect(container.querySelector('[data-testid="mobile-bottom-sheet"]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-testid="mobile-sheet-backdrop"]')!);
    expect(container.querySelector('[data-testid="mobile-bottom-sheet"]')).toBeNull();
  });

  it('has mobile navigation landmark', () => {
    const { container } = renderTabBar();
    expect(container.querySelector('nav[aria-label="Mobile navigation"]')).not.toBeNull();
  });
});
