import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { DashboardSection } from './dashboard-section';

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

describe('DashboardSection', () => {
  it('renders heading with title', () => {
    const { container } = renderWithTheme(
      <DashboardSection title="Needs your attention" />,
    );
    const heading = container.querySelector('h2');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toBe('Needs your attention');
  });

  it('renders badge count when provided', () => {
    const { container } = renderWithTheme(
      <DashboardSection title="Section" count={7} />,
    );
    const badge = container.querySelector('span');
    expect(badge?.textContent).toBe('7');
  });

  it('renders children', () => {
    const { container } = renderWithTheme(
      <DashboardSection title="Section">
        <p>Child content</p>
      </DashboardSection>,
    );
    expect(container.textContent).toContain('Child content');
  });

  it('is a section landmark with aria-labelledby', () => {
    const { container } = renderWithTheme(
      <DashboardSection title="Test Section" id="test-section" />,
    );
    const section = container.querySelector('section');
    expect(section).toBeTruthy();
    expect(section?.getAttribute('aria-labelledby')).toBe('test-section-heading');

    const heading = container.querySelector('h2');
    expect(heading?.getAttribute('id')).toBe('test-section-heading');
  });
});
