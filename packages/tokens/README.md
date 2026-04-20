# @flow/tokens

Design system token layer for Flow OS. Provides typed JS constants, CSS custom properties, theme infrastructure, and Tailwind v4 integration.

## Import Patterns

```ts
// Typed JS objects (all token categories)
import { darkSemanticColors, typography, spacing, radius, motion, mediaQueries } from '@flow/tokens';

// Use media query strings in JS (CSS vars cannot be used in @media queries)
if (window.matchMedia(mediaQueries.md).matches) { /* tablet+ */ }
```

// CSS entry (Tailwind v4 + shadcn bridge + themes)
// In your app's main CSS:
// @import "@flow/tokens/css";

// Theme hooks and providers
import { useTheme } from '@flow/tokens/hooks';
import { ThemeProvider } from '@flow/tokens/providers';
```

## Tailwind v4 Usage

In your app's CSS file:

```css
@import "@flow/tokens/css";
```

This includes:
- `primitives.css` — Tailwind v4 `@theme` directive with primitive color scales
- `shadcn-bridge.css` — Maps Flow tokens to shadcn/ui expected CSS vars
- `portal-brand.css` — Portal brand token defaults
- `prefers-reduced-motion` overrides

All tokens are registered as CSS custom properties under `[data-theme="dark"]` and `[data-theme="light"]`.

## Theme Switching

```tsx
import { ThemeProvider } from '@flow/tokens/providers';
import { useTheme } from '@flow/tokens/hooks';

function App({ children }) {
  return (
    <ThemeProvider defaultTheme="dark">
      {children}
    </ThemeProvider>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  return (
    <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      Current: {resolvedTheme}
    </button>
  );
}
```

### FOUC Prevention (for apps/web)

Add this inline `<script>` to `<head>` before any CSS:

```html
<script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('flow-theme');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}})()` }} />
```

And add `suppressHydrationWarning` to the `<html>` element.

## shadcn/ui Integration

The `shadcn-bridge.css` maps all shadcn/ui expected variables (`--background`, `--foreground`, `--card`, etc.) to Flow semantic tokens. No additional configuration needed — just import the CSS.

## Adding New Tokens

1. Define the value as a typed `as const` constant in the appropriate file under `src/{category}.ts`
2. Export it from `src/index.ts` (the package barrel)
3. Add the CSS custom property to both `src/css/themes/dark.ts` and `src/css/themes/light.ts`
4. Add the Tailwind v4 `@theme` registration if it's a primitive (in `src/css/primitives.css`)
5. Write tests in `src/__tests__/`

## Agent Identity Usage

```tsx
// Agent colors are permanent constants
import { agentColors } from '@flow/tokens';

// Use in CSS:
// color: var(--flow-agent-inbox);
// background: var(--flow-agent-calendar);
```

The 6 agent identity colors (inbox, calendar, ar, report, health, time) are HSL values that never change at runtime.

## Trust-Density Gaps

```css
/* Compact (16px) — standard work, low-risk actions */
gap: var(--flow-trust-gap-compact);

/* Standard (20px) — normal operations */
gap: var(--flow-trust-gap-standard);

/* Elevated (28px) — high-trust moments */
gap: var(--flow-trust-gap-elevated);

/* Ceremony (48px) — milestones */
gap: var(--flow-trust-gap-ceremony);
```

## Motion Tokens

```css
transition-duration: var(--flow-duration-fast);    /* 100ms */
transition-timing-function: var(--flow-ease-standard); /* cubic-bezier(0.4, 0, 0.2, 1) */
```

`prefers-reduced-motion` automatically reduces all durations to 0ms except ceremony (100ms).
