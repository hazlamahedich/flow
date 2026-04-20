# Deferred Work

## Deferred from: code review of 1-1b-design-system-tokens-consumption-proof (2026-04-20)

- ~~Agent colors Inbox `hsl(217, 91%, 73%)` & Time `hsl(217, 89%, 69%)` nearly indistinguishable~~ — **Resolved 2026-04-20:** Time changed to `hsl(192 80% 55%)` (teal/cyan), 75 hue degrees from Inbox.
- ~~Breakpoints as CSS custom properties non-functional in `@media` queries~~ — **Resolved 2026-04-20:** Added `mediaQueries` JS helper object with ready-to-use `(min-width: …)` strings. CSS vars now documented as reference-only with comment in generated output.
- ~~`@theme` directive needs Tailwind v4 processing~~ — **Resolved 2026-04-20:** Added comment to `primitives.css` explaining the requirement. Works in monorepo; not an issue.
- ~~ThemeProvider double-reads localStorage on mount~~ — **Resolved 2026-04-20:** Removed redundant `useEffect` read. `useState` initializer is now the single source of truth for stored theme.
- ~~`matchMedia` not guarded for SSR~~ — **Resolved 2026-04-20:** Extracted `hasMatchMedia()` guard used in both `getSystemPreference()` and the system-theme `useEffect` listener setup.
- ~~Multiple ThemeProviders race on documentElement~~ — **Resolved 2026-04-20:** Provider sets `data-flow-theme-provider` attribute on mount and warns in console if a second instance is detected. Cleans up on unmount.
- ~~No `:root` fallback without data-theme~~ — **Resolved 2026-04-20:** `generateRootFallback()` outputs a full `:root { … }` block with light theme defaults, included in `dist/tokens.css` before the themed selectors.
- ~~CSS export points to source not dist~~ — **Resolved 2026-04-20:** `package.json` export `./css` now points to `./dist/tokens.css`. `generate-css.ts` assembles a combined file (primitives + shadcn bridge + portal brand + themes + reduced-motion).
