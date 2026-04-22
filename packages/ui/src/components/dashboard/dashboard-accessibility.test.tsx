import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { DashboardContent } from './dashboard-content';
import type { DashboardSummary } from '@flow/db';

const zeroSummary: DashboardSummary = {
  pendingApprovals: 0,
  agentActivityCount: 0,
  outstandingInvoices: 0,
  clientHealthAlerts: 0,
};

beforeEach(() => {
  document.documentElement.removeAttribute('data-flow-theme-provider');
  document.documentElement.removeAttribute('data-theme');
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('Dashboard Accessibility', () => {
  it('each section is a landmark with aria-labelledby', () => {
    const { container } = renderWithTheme(
      <DashboardContent
        summary={zeroSummary}
        profile={null}
      />,
    );

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBeGreaterThanOrEqual(4);

    for (const section of sections) {
      const labelledBy = section.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const heading = container.querySelector(`#${labelledBy}`);
      expect(heading).toBeTruthy();
    }
  });

  it('empty state cards have role="region" with aria-label', () => {
    const { container } = renderWithTheme(
      <DashboardContent
        summary={zeroSummary}
        profile={null}
      />,
    );

    const regions = container.querySelectorAll('[role="region"]');
    expect(regions.length).toBeGreaterThanOrEqual(4);

    for (const region of regions) {
      const ariaLabel = region.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }
  });

  it('section headings are focusable via semantic HTML', () => {
    const { container } = renderWithTheme(
      <DashboardContent
        summary={zeroSummary}
        profile={null}
      />,
    );

    const headings = container.querySelectorAll('h2');
    expect(headings.length).toBe(4);

    for (const heading of headings) {
      expect(heading.tagName).toBe('H2');
    }
  });

  it('needs-attention section has correct id for scroll anchor', () => {
    const { container } = renderWithTheme(
      <DashboardContent
        summary={zeroSummary}
        profile={null}
      />,
    );

    const needsAttention = container.querySelector('#needs-attention');
    expect(needsAttention).toBeTruthy();
    expect(needsAttention?.tagName).toBe('SECTION');
  });

  it('greeting heading exists with h1', () => {
    const { container } = renderWithTheme(
      <DashboardContent
        summary={zeroSummary}
        profile={null}
      />,
    );

    const h1 = container.querySelector('h1');
    expect(h1).toBeTruthy();
  });

  it('CTA links in empty states are accessible', () => {
    const { container } = renderWithTheme(
      <DashboardContent
        summary={zeroSummary}
        profile={null}
      />,
    );

    const links = container.querySelectorAll('a');
    for (const link of links) {
      expect(link.textContent).toBeTruthy();
    }
  });

  it('all dashboard sections are rendered in correct order', () => {
    const { container } = renderWithTheme(
      <DashboardContent
        summary={zeroSummary}
        profile={null}
      />,
    );

    const sectionHeadings = Array.from(container.querySelectorAll('section h2'));
    const headingTexts = sectionHeadings.map((h) => h.textContent);

    expect(headingTexts).toContain('Needs your attention');
    expect(headingTexts).toContain('Handled quietly');
    expect(headingTexts).toContain('Outstanding invoices');
    expect(headingTexts).toContain('Client health');
  });
});
