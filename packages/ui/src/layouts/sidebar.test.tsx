import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Provider } from 'jotai';
import { Sidebar } from './sidebar';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

function renderSidebar(collapsed = false) {
  return render(
    <Provider>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={vi.fn()}
      />
    </Provider>,
  );
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/inbox');
});

describe('Sidebar', () => {
  it('renders all 8 nav items', () => {
    const { container } = renderSidebar();
    const nav = container.querySelector('nav[aria-label="Main navigation"]');
    expect(nav).not.toBeNull();
    const links = nav?.querySelectorAll('a');
    expect(links?.length).toBe(8);
  });

  it('renders correct hrefs for nav items', () => {
    const { container } = renderSidebar();
    const expectedHrefs = ['/inbox', '/calendar', '/agents', '/clients', '/invoices', '/time', '/reports', '/settings'];
    expectedHrefs.forEach((href) => {
      const link = container.querySelector(`a[href="${href}"]`);
      expect(link).not.toBeNull();
    });
  });

  it('marks active item with left border accent', () => {
    mockUsePathname.mockReturnValue('/inbox');
    const { container } = renderSidebar();
    const inboxLink = container.querySelector('a[href="/inbox"]');
    expect(inboxLink?.className).toContain('border-l-2');
    expect(inboxLink?.className).toContain('border-[var(--flow-color-accent-gold)]');
    expect(inboxLink?.getAttribute('aria-current')).toBe('page');
  });

  it('hides labels when collapsed', () => {
    const { container } = renderSidebar(true);
    const labels = container.querySelectorAll('a span');
    labels.forEach((label) => {
      expect(label.className).toContain('sr-only');
    });
  });

  it('renders timer slot with correct attributes', () => {
    const { container } = renderSidebar();
    const timerSlot = container.querySelector('[data-testid="sidebar-timer-slot"]');
    expect(timerSlot).not.toBeNull();
    expect(timerSlot?.getAttribute('aria-label')).toBe('Timer area — coming soon');
  });

  it('has nav landmark', () => {
    const { container } = renderSidebar();
    expect(container.querySelector('nav[aria-label="Main navigation"]')).not.toBeNull();
  });

  it('scrollable region has overflow-y-auto', () => {
    const { container } = renderSidebar();
    const nav = container.querySelector('nav[aria-label="Main navigation"]');
    expect(nav?.className).toContain('overflow-y-auto');
  });

  it('has collapse toggle button', () => {
    const { container } = renderSidebar();
    const toggle = container.querySelector('[data-testid="sidebar-collapse-toggle"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-label')).toBe('Collapse sidebar');
  });

  it('collapse toggle shows expand label when collapsed', () => {
    const { container } = renderSidebar(true);
    const toggle = container.querySelector('[data-testid="sidebar-collapse-toggle"]');
    expect(toggle?.getAttribute('aria-label')).toBe('Expand sidebar');
  });
});
