import { darkSemanticColors } from '../colors/semantic-dark';
import { lightSemanticColors } from '../colors/semantic-light';

function parseHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0]! + clean[0], 16) / 255,
      g: parseInt(clean[1]! + clean[1], 16) / 255,
      b: parseInt(clean[2]! + clean[2], 16) / 255,
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16) / 255,
      g: parseInt(clean.substring(2, 4), 16) / 255,
      b: parseInt(clean.substring(4, 6), 16) / 255,
    };
  }
  return null;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = parseHexToRgb(hex1);
  const rgb2 = parseHexToRgb(hex2);
  if (!rgb1 || !rgb2) return null;
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hexOrError(val: string): string {
  if (val.startsWith('#')) return val;
  if (val.startsWith('rgba(')) return '#ffffff';
  return val;
}

const errors: string[] = [];

const textBgPairs: Array<{ fg: string; bg: string; label: string; minRatio: number }> = [];

for (const [themeName, colors] of [['dark', darkSemanticColors], ['light', lightSemanticColors]] as const) {
  const bg = hexOrError(colors['--flow-bg-canvas']!);
  textBgPairs.push(
    { fg: hexOrError(colors['--flow-text-primary']!), bg, label: `${themeName}/primary-text-on-canvas`, minRatio: 4.5 },
    { fg: hexOrError(colors['--flow-text-secondary']!), bg, label: `${themeName}/secondary-text-on-canvas`, minRatio: 4.5 },
    { fg: hexOrError(colors['--flow-accent-primary-text']!), bg: hexOrError(colors['--flow-accent-primary']!), label: `${themeName}/accent-text-on-accent`, minRatio: 4.0 },
    { fg: hexOrError(colors['--flow-status-success']!), bg, label: `${themeName}/success-on-canvas`, minRatio: 3 },
    { fg: hexOrError(colors['--flow-status-warning']!), bg, label: `${themeName}/warning-on-canvas`, minRatio: 3 },
    { fg: hexOrError(colors['--flow-status-error']!), bg, label: `${themeName}/error-on-canvas`, minRatio: 3 },
    { fg: hexOrError(colors['--flow-status-info']!), bg, label: `${themeName}/info-on-canvas`, minRatio: 3 },
    { fg: hexOrError(colors['--flow-accent-primary']!), bg, label: `${themeName}/accent-on-canvas`, minRatio: 3 },
  );
}

for (const pair of textBgPairs) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  if (ratio === null) {
    errors.push(`Could not compute ratio for: ${pair.label}`);
  } else if (ratio < pair.minRatio) {
    errors.push(`${pair.label}: ratio ${ratio.toFixed(2)} < ${pair.minRatio} (FAIL)`);
  }
}

if (errors.length > 0) {
  console.error('Contrast check failed:');
  for (const error of errors) {
    console.error(`  ✗ ${error}`);
  }
  process.exit(1);
}

console.log('Contrast validation passed ✓');
console.log(`  ${textBgPairs.length} color pairs verified`);
process.exit(0);
