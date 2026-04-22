# Deferred Work

## Deferred from: code review of 1-4a-workspace-schema-creation (2026-04-21)

- AC#2: `workspaces.name` and `workspace_members.updated_at` listed as "new columns" but may already exist from Story 1.2 — pre-existing schema ambiguity, verify in next migration
- `member_client_access.client_id` has no FK — deferred to Epic 3 (Story 3-1 creates clients table) — already documented in story
- `workspaceSchema.settings` is `z.record(z.unknown())` — no shape validation — deferred, settings schema TBD
- `workspace_audit.ts` — `workspace_created` event omits `createdBy` field — deferred, not blocking

## Deferred from: code review of 1-4b-team-invitations-ownership (2026-04-21)

- Empty workspace name on transfer [`confirm-transfer-dialog.tsx`] — deferred, pre-existing UX polish item
- Redundant `getUser` call in accept-invitation [`accept-invitation.ts`] — deferred, minor optimization
- No-op role change still logs audit event [`update-role.ts`] — deferred, acceptable behavior
- No DB CHECK constraint for max 1-year expiry — application-level Zod enforcement sufficient, DB CHECK deferred to production hardening
- No middleware/routing to `/removed` page — deferred to Story 1.4c (integration story that wires middleware and layout)

## Deferred from: code review of 1-4c-client-scoping-sessions-ui-audit (2026-04-22)

- Sessions page no pagination for large teams [`sessions/page.tsx:55-60`] — MVP design limitation, acceptable until workspace scales
- getAccessibleClients two-step query race condition [`members.ts:56-73`] — minor window between access check and client fetch, acceptable for MVP
- RLS tests use nonexistent client IDs [`rls_workspaces_full.sql:281-286`] — FK constraints deferred to Epic 3; tests need update when clients table is created
- Invitations query excludes expired with no UI indication [`team/page.tsx:31`] — UX enhancement to show expired invitations in separate section
- getAccessibleClients doesn't handle missing clients table [`members.ts`] — clients table deferred to Epic 3 (Story 3-1)
- revokeSessionSchema UUID validation mismatch risk [`workspace.ts:281-283`] — needs verification against actual user_devices.id column type
- create-workspace audit uses type assertion on RPC result [`create-workspace.ts:55-60`] — pre-existing pattern from Story 1.4a
- Sessions page unreachable empty branch [`sessions/page.tsx:42`] — dead code, owner is always a member so length can't be 0

## Deferred from: code review of 1-5-user-profile-management (2026-04-22)

- `getUserProfile` swallows all DB errors — RLS violation indistinguishable from "not found" [`get-user-profile.ts:15`] — pre-existing error handling pattern
- Concurrent avatar uploads can orphan files — no locking on read-then-write cycle [`upload-avatar.ts:56-94`] — last-write-wins documented (AC8), orphan cleanup post-MVP
- No row-affected check on profile/URL update — silent no-op on missing user [`update-user-profile.ts:8-11`] — `ensureUserProfile` called first, extremely unlikely

## Deferred from: code review of 1-5a-email-change-verification (2026-04-22)

- Timing side-channel on email enumeration [`request-email-change.ts:95`] — `supabase.auth.updateUser` takes measurable latency for available emails (sends verification) vs instant rejection for taken emails. Constant-time padding deferred pending architectural decision.
- App-server clock skew on `expires_at` comparisons [`verify/route.ts:23`, `get-pending-email-change.ts:25`, `page.tsx:81`] — all three pass `new Date().toISOString()` from app server while `expires_at` uses DB `now()`. Infrastructure-level concern.
- `signOut` only revokes refresh tokens — access tokens valid until natural expiry (~1 hour) [`verify/route.ts:55`] — Supabase platform limitation, documented in project-context.md L455 (60s invalidation target).

## Deferred from: code review of 1-6-persistent-layout-shell-navigation (2026-04-22)

- Error boundary uses `window.location.reload()` losing all client state — could add `resetErrorBoundary` pattern via `this.setState({ hasError: false })` in a future hardening pass. [`sidebar-error-boundary.tsx:53`] — deferred, pre-existing pattern
- `error.tsx` exposes raw `error.message` to users — may contain internal details. Sanitization deferred to dedicated error-handling hardening story. [`error.tsx:14`] — deferred, pre-existing

## Deferred from: code review of 1-7-home-dashboard (2026-04-22)

- **F12 — Urgency tier badges on client health cards** — deferred to Epic 2 (agent trust/badge system). Current cards show raw `status` text; urgency tiers (attention-needed → at-risk → critical) require agent signal data that doesn't exist yet.
- **Active/all-clear greeting paths still use time-of-day** — hydration mismatch risk when server and client are in different timezones. `first-run` and `no-workspace` paths are spec-compliant (no time-of-day), but `active` and `all-clear` paths call `getGreeting()` which uses `new Date()` server-side. Deferred to dedicated hydration hardening pass.
- **Cache tag wrapping on `getDashboardSummary`** — tag format fixed (`dashboard` not `dashboards`), but `unstable_cache` + `cacheTag` wrapping not added because: (a) `SupabaseClient` can't be captured in cached closure, (b) no mutations exist yet that would invalidate the tag. Revisit when agent writes invalidate dashboard data.
- **Workspace switcher error toast on `revalidatePath` failure** — `revalidatePath('/')` could throw in edge middleware contexts; current `try/catch` with `sonner` toast is sufficient for App Router server actions. Edge hardening deferred.
- **DTS build errors for `@flow/db` and `@flow/types` imports in `@flow/ui`** — pre-existing cross-package type resolution issues. Not caused by this story. Resolve when Turborepo build pipeline is stabilized (Story 1-1a still in `review`).

## Deferred from: code review of 1-8-command-palette-keyboard-shortcuts (2026-04-22)

- OverlayPriority/MAX_ACTIVE_OVERLAY never enforced — overlay stacking management deferred to Story 2.5 when inbox context exists [`overlay-priority.ts`]
- Context-based shortcut dimming in overlay — requires inbox context from Story 2.5. Platform dimming already works. [`shortcut-overlay.tsx`]
- Focus ring styling (AC-5) — pre-existing design system concern. focus-visible styles already in codebase via --flow-focus-ring-* variables.
- navigator.platform deprecated — pre-existing, works on all current browsers [`defaults.ts:4`]
- forwardRef unnecessary in React 19 — pre-existing pattern from shadcn generation [`command.tsx`]

## Deferred from: code review of 1-9-undo-conflict-resolution (2026-04-22)

- UndoFab uses `md:hidden` instead of `pointer:coarse` media query — spec says "touch devices" but viewport-width pattern is used throughout codebase [`undo-fab.tsx:28`]
- `entityType: string` is too permissive — no compile-time safety. Will tighten to union type when client/invoice entities are defined in Epic 3/7 [`types.ts:15`]
- `undoStacksAtom` initialized with module-level `new Map()` — SSR cross-request leak risk. Mitigated: all consumers are `'use client'` [`undo-stack.ts:20`]
- Toast timer doesn't reset when new entry pushed while toast already visible — minor UX issue, new entry inherits remaining time from previous toast [`undo-toast.tsx:57-75`]
- `isBlockNoteFocused` doesn't pierce Shadow DOM — `element.closest()` doesn't cross shadow boundaries. BlockNote doesn't currently use Shadow DOM [`blocknote-guard.ts:4`]

## Deferred from: code review of 1-10-day-1-micro-wizard-aha-glimpse (2026-04-23)

- No updated_at trigger on clients/time_entries — both tables have `updated_at` column but no moddatetime trigger. Acceptable for MVP. [migrations]
- No DELETE RLS policies on clients/time_entries — intentional for MVP scope. No delete functionality in current stories. [migrations]
- ON DELETE CASCADE on time_entries.client_id — deleting a client destroys all time entries silently. Acceptable for MVP, consider SET NULL before Epic 5. [migration:7]
- No server action or layout redirect tests — server action testing requires infra setup. 70 client-side tests provide coverage. [actions + layout]
- No unique constraint on (workspace_id, name) for clients — acceptable for MVP wizard with single client creation. [migration]
- Unsafe type cast `as ClientRecord` in server actions — common Supabase pattern, input validated by Zod. [create-client.ts:81, log-time-entry.ts:89]
