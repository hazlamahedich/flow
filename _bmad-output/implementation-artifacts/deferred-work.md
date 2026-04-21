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

## Deferred from: code review of 1-2-database-foundation-tenant-isolation (2026-04-20)

- Audit anomaly scan not implemented — explicitly deferred to Epic 10 per story spec "What This Story Does NOT Include"
- audit_log has no FK constraints on workspace_id/user_id — intentional design choice (audit entries must survive workspace/user deletion for compliance)
- No INSERT policy on workspaces for authenticated users — intentional (workspace creation via service_role only, per migration comments)
- requireTenantContext has no memoization — performance optimization, each call hits Supabase Auth server (~50-100ms overhead per call)
- expires_at not enforced by RLS or CHECK constraint — time-limited access feature not yet implemented, expires_at column exists but has no effect
- createBrowserClient silently drops cookies — documented as expected behavior (actual singleton wiring deferred to apps/web per story spec)
- Stale JWT after setActiveWorkspace — known JWT limitation; workspace_id in JWT only updates on token refresh
- renderTheme ignores newTheme parameter — pre-existing from story 1.1b
- No user profile auto-creation trigger — signup flow and user creation come in Story 1.3

## Deferred from: code review of 1-3-magic-link-authentication (2026-04-21)

- `invalidateUserSessions` may not invalidate all sessions — Missing scope parameter, SDK version-dependent behavior. Should pass `{ scope: 'global' }` to `admin.signOut()`.
- `console.error` in callback leaks error details to server logs — Sanitize before logging to prevent leaking Supabase internals.
- Rate limit fail-open allows unlimited requests on DB failure — Design choice (fail-open is safer than locking out all users), but needs monitoring/alerting when rate limit DB is unreachable.

## Deferred from: code review of 1-3a-device-trust-session-persistence (2026-04-21)

- Middleware DB call per request — `verifyDeviceTrust()` creates a fresh Supabase service client on every middleware invocation. MVP design choice; revisit with performance profiling.
- renameDevice allows renaming revoked devices — cosmetic, not blocking.
- handleSignOutEverywhere React concurrent mode race — `window.location.href` redirect may cancel pending server action. Low-probability edge case.
- device-trust.ts exceeds 200-line soft limit — 218 lines, 18 lines over soft limit. Can be split later.
