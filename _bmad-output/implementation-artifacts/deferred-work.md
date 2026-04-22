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
