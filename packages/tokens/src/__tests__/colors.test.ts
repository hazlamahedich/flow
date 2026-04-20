import { describe, it, expect } from 'vitest';
import {
  primitives,
  slate,
  blue,
  red,
  green,
  amber,
  violet,
  rose,
  orange,
  white,
  black,
} from '../colors/primitives';
import { darkSemanticColors } from '../colors/semantic-dark';
import { lightSemanticColors } from '../colors/semantic-light';
import { agentColors, agentNames } from '../colors/agents';
import { emotionalTokens } from '../colors/emotional';

describe('primitive color scales', () => {
  const scales = { slate, blue, red, green, amber, violet, rose, orange };

  it('has all 10 color scales plus white and black', () => {
    expect(Object.keys(primitives)).toEqual(
      expect.arrayContaining([
        'slate', 'blue', 'red', 'green', 'amber',
        'violet', 'rose', 'orange', 'white', 'black',
      ]),
    );
  });

  for (const [name, scale] of Object.entries(scales)) {
    it(`${name} has shades 50-950`, () => {
      const keys = Object.keys(scale);
      expect(keys).toContain('50');
      expect(keys).toContain('100');
      expect(keys).toContain('950');
    });

    it(`${name} values use oklch() format`, () => {
      for (const value of Object.values(scale)) {
        expect(value).toMatch(/^oklch\(/);
      }
    });
  }

  it('white is oklch(1 0 0)', () => {
    expect(white).toBe('oklch(1 0 0)');
  });

  it('black is oklch(0 0 0)', () => {
    expect(black).toBe('oklch(0 0 0)');
  });
});

describe('semantic color tokens', () => {
  const darkKeys = Object.keys(darkSemanticColors);
  const lightKeys = Object.keys(lightSemanticColors);

  it('dark and light have identical token names', () => {
    expect(darkKeys).toEqual(lightKeys);
  });

  it('has all required bg tokens', () => {
    expect(darkKeys).toEqual(expect.arrayContaining([
      '--flow-bg-canvas',
      '--flow-bg-surface',
      '--flow-bg-surface-raised',
      '--flow-bg-surface-overlay',
    ]));
  });

  it('has all required text tokens', () => {
    expect(darkKeys).toEqual(expect.arrayContaining([
      '--flow-text-primary',
      '--flow-text-secondary',
      '--flow-text-muted',
      '--flow-text-disabled',
      '--flow-text-inverse',
    ]));
  });

  it('has all required border tokens', () => {
    expect(darkKeys).toEqual(expect.arrayContaining([
      '--flow-border-default',
      '--flow-border-subtle',
      '--flow-border-strong',
    ]));
  });

  it('has accent and status tokens', () => {
    expect(darkKeys).toEqual(expect.arrayContaining([
      '--flow-accent-primary',
      '--flow-accent-primary-text',
      '--flow-status-success',
      '--flow-status-warning',
      '--flow-status-error',
      '--flow-status-info',
    ]));
  });

  it('dark theme has exact hex values from AC-4', () => {
    expect(darkSemanticColors['--flow-bg-canvas']).toBe('#09090b');
    expect(darkSemanticColors['--flow-text-primary']).toBe('#fafafa');
    expect(darkSemanticColors['--flow-accent-primary']).toBe('#6366f1');
  });

  it('light theme has exact hex values from AC-5', () => {
    expect(lightSemanticColors['--flow-bg-canvas']).toBe('#fafaf8');
    expect(lightSemanticColors['--flow-text-primary']).toBe('#1a1917');
    expect(lightSemanticColors['--flow-accent-primary']).toBe('#4f46e5');
  });

  it('no identical adjacent tokens that suggest copy-paste errors', () => {
    const entries = Object.entries(darkSemanticColors);
    for (let i = 0; i < entries.length - 1; i++) {
      const [keyA, valA] = entries[i]!;
      const [keyB, valB] = entries[i + 1]!;
      if (keyA.startsWith('--flow-') && keyB.startsWith('--flow-')) {
        if (valA === valB) {
          expect(`${keyA} and ${keyB} have identical values`).toBe('unexpected duplicate');
        }
      }
    }
  });
});

describe('agent identity colors', () => {
  it('has exactly 6 agent colors', () => {
    expect(Object.keys(agentColors)).toHaveLength(6);
  });

  it('agent names array matches color keys', () => {
    const expectedNames = ['inbox', 'calendar', 'ar', 'report', 'health', 'time'];
    expect(agentNames).toEqual(expectedNames);
  });

  it('uses HSL format for all agent colors', () => {
    for (const value of Object.values(agentColors)) {
      expect(value).toMatch(/^hsl\(/);
    }
  });

  it('has exact values from AC-6', () => {
    expect(agentColors['--flow-agent-inbox']).toBe('hsl(217, 91%, 73%)');
    expect(agentColors['--flow-agent-calendar']).toBe('hsl(263, 85%, 75%)');
    expect(agentColors['--flow-agent-ar']).toBe('hsl(33, 90%, 61%)');
    expect(agentColors['--flow-agent-report']).toBe('hsl(160, 65%, 51%)');
    expect(agentColors['--flow-agent-health']).toBe('hsl(330, 85%, 72%)');
    expect(agentColors['--flow-agent-time']).toBe('hsl(217, 89%, 69%)');
  });

  it('no agent color uses red (reserved for error)', () => {
    for (const value of Object.values(agentColors)) {
      expect(value).not.toMatch(/^hsl\(0,/);
    }
  });
});

describe('emotional tokens', () => {
  it('has all 7 emotional tokens', () => {
    expect(Object.keys(emotionalTokens)).toHaveLength(7);
  });

  it('includes key emotions', () => {
    const keys = Object.keys(emotionalTokens);
    expect(keys).toContain('--flow-emotion-tension');
    expect(keys).toContain('--flow-emotion-calm');
    expect(keys).toContain('--flow-emotion-pride');
    expect(keys).toContain('--flow-emotion-trust-betrayed');
  });
});
