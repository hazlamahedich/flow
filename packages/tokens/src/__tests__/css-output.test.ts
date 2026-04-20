import { describe, it, expect } from 'vitest';
import { generateDarkTheme } from '../css/themes/dark';
import { generateLightTheme } from '../css/themes/light';
import { darkSemanticColors } from '../colors/semantic-dark';
import { lightSemanticColors } from '../colors/semantic-light';

describe('CSS output', () => {
  const darkCss = generateDarkTheme();
  const lightCss = generateLightTheme();

  it('dark theme output starts with [data-theme="dark"]', () => {
    expect(darkCss.trim().startsWith('[data-theme="dark"]')).toBe(true);
  });

  it('light theme output starts with [data-theme="light"]', () => {
    expect(lightCss.trim().startsWith('[data-theme="light"]')).toBe(true);
  });

  it('dark theme contains all semantic tokens', () => {
    for (const [key, value] of Object.entries(darkSemanticColors)) {
      expect(darkCss).toContain(`${key}: ${value}`);
    }
  });

  it('light theme contains all semantic tokens', () => {
    for (const [key, value] of Object.entries(lightSemanticColors)) {
      expect(lightCss).toContain(`${key}: ${value}`);
    }
  });

  it('both themes contain typography tokens', () => {
    expect(darkCss).toContain('--flow-type-base');
    expect(lightCss).toContain('--flow-type-base');
  });

  it('both themes contain spacing tokens', () => {
    expect(darkCss).toContain('--flow-space-4');
    expect(lightCss).toContain('--flow-space-4');
  });

  it('both themes contain motion tokens', () => {
    expect(darkCss).toContain('--flow-duration-fast');
    expect(lightCss).toContain('--flow-duration-fast');
  });

  it('both themes contain z-index tokens', () => {
    expect(darkCss).toContain('--flow-z-modal');
    expect(lightCss).toContain('--flow-z-modal');
  });
});
