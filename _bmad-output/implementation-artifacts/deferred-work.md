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
