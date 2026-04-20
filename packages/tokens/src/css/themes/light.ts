import { lightSemanticColors } from '../../colors/semantic-light';
import { agentColors } from '../../colors/agents';
import { emotionalTokens } from '../../colors/emotional';
import { shadows } from '../../elevation';
import { typography } from '../../typography';
import { spacing, trustDensity } from '../../spacing';
import { radius } from '../../radius';
import { duration, easing } from '../../motion';
import { focusRing } from '../../focus-ring';
import { states } from '../../states';
import { zIndex } from '../../z-index';
import { layout } from '../../layout';
import { breakpoints } from '../../breakpoints';

function objectToCustomProperties(obj: Readonly<Record<string, string>>): string {
  return Object.entries(obj).map(([key, value]) => `${key}: ${value};`).join('\n  ');
}

export function generateRootFallback(): string {
  const lines: string[] = [':root {'];
  lines.push('  /* Fallback: applies when data-theme attribute is missing (e.g. before JS hydration) */');
  lines.push('  ' + objectToCustomProperties(lightSemanticColors));
  lines.push('  ' + objectToCustomProperties(agentColors));
  lines.push('  ' + objectToCustomProperties(emotionalTokens));
  for (const [key, value] of Object.entries(shadows)) {
    lines.push(`  --flow-shadow-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(typography.fontSize)) {
    lines.push(`  --flow-type-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(typography.lineHeight)) {
    lines.push(`  --flow-leading-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(typography.fontWeight)) {
    lines.push(`  --flow-font-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(typography.letterSpacing)) {
    lines.push(`  --flow-tracking-${key}: ${value};`);
  }
  lines.push(`  --flow-font-sans: ${typography.fontFamily.sans};`);
  lines.push(`  --flow-font-mono: ${typography.fontFamily.mono};`);
  for (const [key, value] of Object.entries(spacing)) {
    lines.push(`  --flow-space-${key}: ${value};`);
  }
  lines.push(`  --flow-trust-gap-compact: ${trustDensity.compact};`);
  lines.push(`  --flow-trust-gap-standard: ${trustDensity.standard};`);
  lines.push(`  --flow-trust-gap-elevated: ${trustDensity.elevated};`);
  lines.push(`  --flow-trust-gap-ceremony: ${trustDensity.ceremony};`);
  for (const [key, value] of Object.entries(radius)) {
    lines.push(`  --flow-radius-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(duration)) {
    lines.push(`  --flow-duration-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(easing)) {
    lines.push(`  --flow-ease-${key}: ${value};`);
  }
  lines.push(`  --flow-focus-ring-width: ${focusRing.width};`);
  lines.push(`  --flow-focus-ring-offset: ${focusRing.offset};`);
  lines.push(`  --flow-focus-ring-color: ${focusRing.color};`);
  lines.push(`  --flow-focus-ring-dark-glow: ${focusRing.darkGlow};`);
  lines.push(`  --flow-state-hover-brightness: ${states.light.hoverBrightness};`);
  lines.push(`  --flow-state-active-brightness: ${states.light.activeBrightness};`);
  lines.push(`  --flow-state-disabled-opacity: ${states.disabledOpacity};`);
  lines.push(`  --flow-state-readonly-opacity: ${states.readonlyOpacity};`);
  lines.push(`  --flow-state-overlay-hover: ${states.overlayHoverLight};`);
  for (const [key, value] of Object.entries(zIndex)) {
    lines.push(`  --flow-z-${key}: ${value};`);
  }
  lines.push(`  --flow-sidebar-expanded: ${layout.sidebarExpanded};`);
  lines.push(`  --flow-sidebar-collapsed: ${layout.sidebarCollapsed};`);
  lines.push(`  --flow-main-content: ${layout.mainContent};`);
  lines.push(`  --flow-detail-pane: ${layout.detailPane};`);
  for (const [key, value] of Object.entries(breakpoints)) {
    lines.push(`  --flow-breakpoint-${key}: ${value};`);
  }
  lines.push('}');
  return lines.join('\n');
}

export function generateLightTheme(): string {
  const lines: string[] = ['[data-theme="light"] {'];

  lines.push('  /* Semantic Colors */');
  lines.push('  ' + objectToCustomProperties(lightSemanticColors));

  lines.push('\n  /* Agent Identity Colors */');
  lines.push('  ' + objectToCustomProperties(agentColors));

  lines.push('\n  /* Emotional Tokens */');
  lines.push('  ' + objectToCustomProperties(emotionalTokens));

  lines.push('\n  /* Shadows */');
  for (const [key, value] of Object.entries(shadows)) {
    lines.push(`  --flow-shadow-${key}: ${value};`);
  }

  lines.push('\n  /* Typography */');
  for (const [key, value] of Object.entries(typography.fontSize)) {
    lines.push(`  --flow-type-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(typography.lineHeight)) {
    lines.push(`  --flow-leading-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(typography.fontWeight)) {
    lines.push(`  --flow-font-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(typography.letterSpacing)) {
    lines.push(`  --flow-tracking-${key}: ${value};`);
  }
  lines.push(`  --flow-font-sans: ${typography.fontFamily.sans};`);
  lines.push(`  --flow-font-mono: ${typography.fontFamily.mono};`);

  lines.push('\n  /* Spacing */');
  for (const [key, value] of Object.entries(spacing)) {
    lines.push(`  --flow-space-${key}: ${value};`);
  }

  lines.push('\n  /* Trust Density */');
  lines.push(`  --flow-trust-gap-compact: ${trustDensity.compact};`);
  lines.push(`  --flow-trust-gap-standard: ${trustDensity.standard};`);
  lines.push(`  --flow-trust-gap-elevated: ${trustDensity.elevated};`);
  lines.push(`  --flow-trust-gap-ceremony: ${trustDensity.ceremony};`);

  lines.push('\n  /* Radius */');
  for (const [key, value] of Object.entries(radius)) {
    lines.push(`  --flow-radius-${key}: ${value};`);
  }

  lines.push('\n  /* Motion */');
  for (const [key, value] of Object.entries(duration)) {
    lines.push(`  --flow-duration-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(easing)) {
    lines.push(`  --flow-ease-${key}: ${value};`);
  }

  lines.push('\n  /* Focus Ring */');
  lines.push(`  --flow-focus-ring-width: ${focusRing.width};`);
  lines.push(`  --flow-focus-ring-offset: ${focusRing.offset};`);
  lines.push(`  --flow-focus-ring-color: ${focusRing.color};`);
  lines.push(`  --flow-focus-ring-dark-glow: ${focusRing.darkGlow};`);

  lines.push('\n  /* Interactive States */');
  lines.push(`  --flow-state-hover-brightness: ${states.light.hoverBrightness};`);
  lines.push(`  --flow-state-active-brightness: ${states.light.activeBrightness};`);
  lines.push(`  --flow-state-disabled-opacity: ${states.disabledOpacity};`);
  lines.push(`  --flow-state-readonly-opacity: ${states.readonlyOpacity};`);
  lines.push(`  --flow-state-overlay-hover: ${states.overlayHoverLight};`);

  lines.push('\n  /* Z-Index */');
  for (const [key, value] of Object.entries(zIndex)) {
    lines.push(`  --flow-z-${key}: ${value};`);
  }

  lines.push('\n  /* Layout */');
  lines.push(`  --flow-sidebar-expanded: ${layout.sidebarExpanded};`);
  lines.push(`  --flow-sidebar-collapsed: ${layout.sidebarCollapsed};`);
  lines.push(`  --flow-main-content: ${layout.mainContent};`);
  lines.push(`  --flow-detail-pane: ${layout.detailPane};`);

  lines.push('\n  /* Breakpoints (CSS vars are for documentation only — use JS mediaQueries for @media) */');
  for (const [key, value] of Object.entries(breakpoints)) {
    lines.push(`  --flow-breakpoint-${key}: ${value};`);
  }

  lines.push('}');
  return lines.join('\n');
}
