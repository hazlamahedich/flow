import { darkSemanticColors } from '../colors/semantic-dark';
import { lightSemanticColors } from '../colors/semantic-light';
import { agentColors } from '../colors/agents';
import { typography } from '../typography';
import { duration } from '../motion';

const errors: string[] = [];

const darkKeys = new Set(Object.keys(darkSemanticColors));
const lightKeys = new Set(Object.keys(lightSemanticColors));

for (const key of darkKeys) {
  if (!lightKeys.has(key)) {
    errors.push(`Orphan token in dark theme: ${key}`);
  }
}
for (const key of lightKeys) {
  if (!darkKeys.has(key)) {
    errors.push(`Orphan token in light theme: ${key}`);
  }
}

const cssVarPattern = /^--[a-z][a-z0-9-]*$/;
for (const key of [...Object.keys(darkSemanticColors), ...Object.keys(lightSemanticColors)]) {
  if (!cssVarPattern.test(key)) {
    errors.push(`Invalid CSS variable name: ${key}`);
  }
}

const hexPattern = /^#[0-9a-fA-F]{3,8}$/;
const rgbaPattern = /^rgba?\(/;
const hslPattern = /^hsl\(/;
const varPattern = /^var\(/;
for (const [key, value] of Object.entries(darkSemanticColors)) {
  if (!hexPattern.test(value) && !rgbaPattern.test(value) && !hslPattern.test(value) && !varPattern.test(value)) {
    errors.push(`Non-parseable color value in dark theme: ${key} = ${value}`);
  }
}
for (const [key, value] of Object.entries(lightSemanticColors)) {
  if (!hexPattern.test(value) && !rgbaPattern.test(value) && !hslPattern.test(value) && !varPattern.test(value)) {
    errors.push(`Non-parseable color value in light theme: ${key} = ${value}`);
  }
}

const requiredShadcnVars = [
  '--background', '--foreground', '--card', '--card-foreground',
  '--popover', '--popover-foreground', '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
  '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
  '--border', '--input', '--ring', '--radius',
];

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shadcnBridgePath = resolve(__dirname, '../css/shadcn-bridge.css');
let shadcnBridgeCss = '';
try {
  shadcnBridgeCss = readFileSync(shadcnBridgePath, 'utf-8');
} catch {
  errors.push(`shadcn-bridge.css not found at ${shadcnBridgePath}`);
}

for (const v of requiredShadcnVars) {
  if (!shadcnBridgeCss.includes(v + ':')) {
    errors.push(`Missing shadcn bridge mapping: ${v}`);
  }
}

if (Object.keys(agentColors).length !== 6) {
  errors.push(`Expected 6 agent colors, found ${Object.keys(agentColors).length}`);
}
if (Object.keys(typography.fontSize).length !== 9) {
  errors.push(`Expected 9 font sizes, found ${Object.keys(typography.fontSize).length}`);
}
if (Object.keys(duration).length !== 5) {
  errors.push(`Expected 5 duration tokens, found ${Object.keys(duration).length}`);
}

if (errors.length > 0) {
  console.error('Token validation failed:');
  for (const error of errors) {
    console.error(`  ✗ ${error}`);
  }
  process.exit(1);
}

console.log('Token validation passed ✓');
console.log(`  ${darkKeys.size} semantic tokens verified in both themes`);
console.log(`  ${Object.keys(agentColors).length} agent identity colors verified`);
console.log(`  ${requiredShadcnVars.length} shadcn bridge mappings verified`);
process.exit(0);
