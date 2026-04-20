import { describe, it, expect } from 'vitest';
import { darkSemanticColors } from '../colors/semantic-dark';
import { lightSemanticColors } from '../colors/semantic-light';
import { agentColors } from '../colors/agents';
import { emotionalTokens } from '../colors/emotional';
import { typography } from '../typography';
import { spacing, trustDensity } from '../spacing';
import { radius } from '../radius';
import { zIndex } from '../z-index';
import { layout } from '../layout';
import { breakpoints } from '../breakpoints';

describe('token completeness', () => {
  const semanticTokenKeys = Object.keys(darkSemanticColors);

  it('every semantic token exists in both themes', () => {
    const darkKeys = new Set(Object.keys(darkSemanticColors));
    const lightKeys = new Set(Object.keys(lightSemanticColors));
    for (const key of darkKeys) {
      expect(lightKeys.has(key)).toBe(true);
    }
    for (const key of lightKeys) {
      expect(darkKeys.has(key)).toBe(true);
    }
  });

  it('all tokens use --flow- prefix', () => {
    for (const key of semanticTokenKeys) {
      expect(key.startsWith('--flow-')).toBe(true);
    }
    for (const key of Object.keys(agentColors)) {
      expect(key.startsWith('--flow-')).toBe(true);
    }
  });

  it('typography has all required scales', () => {
    expect(Object.keys(typography.fontSize)).toHaveLength(9);
    expect(Object.keys(typography.lineHeight)).toHaveLength(5);
    expect(Object.keys(typography.fontWeight)).toHaveLength(4);
    expect(Object.keys(typography.letterSpacing)).toHaveLength(3);
  });

  it('spacing has standard scale', () => {
    expect(Object.keys(spacing).length).toBeGreaterThan(15);
  });

  it('trust density has all 4 levels', () => {
    expect(Object.keys(trustDensity)).toHaveLength(4);
  });

  it('radius has 7 steps', () => {
    expect(Object.keys(radius)).toHaveLength(7);
  });

  it('z-index has 8 levels', () => {
    expect(Object.keys(zIndex)).toHaveLength(8);
  });

  it('layout has all 4 constants', () => {
    expect(Object.keys(layout)).toHaveLength(4);
  });

  it('breakpoints has 5 steps', () => {
    expect(Object.keys(breakpoints)).toHaveLength(5);
  });

  it('agent colors have 6 entries', () => {
    expect(Object.keys(agentColors)).toHaveLength(6);
  });

  it('emotional tokens have 7 entries', () => {
    expect(Object.keys(emotionalTokens)).toHaveLength(7);
  });
});
