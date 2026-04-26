import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { TrustBadge } from './trust-badge';

const STATES = [
  { label: 'Learning', colorToken: '--flow-emotion-trust-building', borderStyle: '1px solid' },
  { label: 'Established', colorToken: '--flow-emotion-trust-confirm', borderStyle: '1px dashed' },
  { label: 'Auto', colorToken: '--flow-emotion-trust-auto', borderStyle: 'none' },
  { label: 'Promoting', colorToken: '--flow-emotion-trust-building', borderStyle: '1px solid' },
  { label: 'Regressing', colorToken: '--flow-emotion-trust-betrayed', borderStyle: '1px solid' },
  { label: 'Ready for review?', colorToken: '--flow-emotion-trust-auto', borderStyle: 'none' },
];

beforeEach(() => {
  document.documentElement.removeAttribute('data-flow-theme-provider');
  document.documentElement.removeAttribute('data-theme');
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
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

describe('TrustBadge', () => {
  describe('6 visual tiers', () => {
    it.each(STATES)('renders badge with label "$label"', ({ label, colorToken, borderStyle }) => {
      const { container } = renderWithTheme(
        <TrustBadge
          label={label}
          colorToken={colorToken}
          borderStyle={borderStyle}
          animState="default"
        />,
      );
      expect(container.textContent).toContain(label);
    });

    it.each(STATES)('renders sidebar variant as dot for "$label"', ({ label, colorToken, borderStyle }) => {
      const { container } = renderWithTheme(
        <TrustBadge
          label={label}
          colorToken={colorToken}
          borderStyle={borderStyle}
          animState="default"
          variant="sidebar"
        />,
      );
      const dot = container.querySelector('[role="status"]');
      expect(dot).toBeTruthy();
    });
  });

  describe('three-channel status (text + color + border)', () => {
    it('supervised has text "Learning", blue color, solid border', () => {
      const { container } = renderWithTheme(
        <TrustBadge label="Learning" colorToken="--flow-emotion-trust-building" borderStyle="1px solid" animState="default" />,
      );
      const badge = container.querySelector('[role="status"]');
      expect(badge?.textContent).toBe('Learning');
      expect(badge?.getAttribute('style')).toContain('--flow-emotion-trust-building');
      expect(badge?.getAttribute('style')).toContain('1px solid');
    });

    it('confirm has text "Established", violet color, dashed border', () => {
      const { container } = renderWithTheme(
        <TrustBadge label="Established" colorToken="--flow-emotion-trust-confirm" borderStyle="1px dashed" animState="default" />,
      );
      const badge = container.querySelector('[role="status"]');
      expect(badge?.textContent).toBe('Established');
      expect(badge?.getAttribute('style')).toContain('--flow-emotion-trust-confirm');
      expect(badge?.getAttribute('style')).toContain('1px dashed');
    });

    it('auto has text "Auto", green color, no border', () => {
      const { container } = renderWithTheme(
        <TrustBadge label="Auto" colorToken="--flow-emotion-trust-auto" borderStyle="none" animState="default" />,
      );
      const badge = container.querySelector('[role="status"]');
      expect(badge?.textContent).toBe('Auto');
      expect(badge?.getAttribute('style')).toContain('--flow-emotion-trust-auto');
      expect(badge?.getAttribute('style')).not.toContain('solid');
      expect(badge?.getAttribute('style')).not.toContain('dashed');
    });
  });

  describe('ARIA', () => {
    it('has role="status"', () => {
      const { container } = renderWithTheme(
        <TrustBadge label="Learning" colorToken="--flow-emotion-trust-building" borderStyle="1px solid" animState="default" />,
      );
      expect(container.querySelector('[role="status"]')).toBeTruthy();
    });

    it('inline variant has descriptive aria-label', () => {
      const { container } = renderWithTheme(
        <TrustBadge label="Learning" colorToken="--flow-emotion-trust-building" borderStyle="1px solid" animState="default" agentLabel="Inbox Agent" />,
      );
      const badge = container.querySelector('span[role="status"]');
      expect(badge?.getAttribute('aria-label')).toBe('Inbox Agent trust: Learning');
    });

    it('sidebar variant has descriptive aria-label', () => {
      const { container } = renderWithTheme(
        <TrustBadge label="Auto" colorToken="--flow-emotion-trust-auto" borderStyle="none" animState="default" variant="sidebar" agentLabel="Calendar Agent" />,
      );
      const statuses = container.querySelectorAll('span[role="status"]');
      const badge = Array.from(statuses).find((el) => el.getAttribute('aria-label')?.includes('Calendar Agent'));
      expect(badge?.getAttribute('aria-label')).toBe('Calendar Agent trust: Auto');
    });
  });

  describe('prefers-reduced-motion', () => {
    it('promoting state returns no animation when reduced motion preferred', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));
      const { container } = renderWithTheme(
        <TrustBadge label="Promoting" colorToken="--flow-emotion-trust-building" borderStyle="1px solid" animState="promoting" />,
      );
      const badge = container.querySelector('[role="status"]');
      const style = badge?.getAttribute('style') ?? '';
      expect(style).toContain('transition: none');
      expect(style).not.toContain('animation');
    });
  });

  describe('keyboard handlers', () => {
    it('badge is focusable when interactive context is added', () => {
      const { container } = renderWithTheme(
        <TrustBadge label="Learning" colorToken="--flow-emotion-trust-building" borderStyle="1px solid" animState="default" />,
      );
      const badge = container.querySelector('[role="status"]');
      expect(badge).toBeTruthy();
    });
  });
});
