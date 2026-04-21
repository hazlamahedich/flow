# Story 1.4a: Workspace Schema & Creation

Status: done
Parent: Story 1.4 (Workspace & Team Management)
Depends on: Stories 1.2, 1.3, 1.3a
Blocks: Stories 1.4b, 1.4c

## Story

As a developer,
I want the database schema, types, and workspace creation endpoint for workspace management,
So that Stories 1.4b and 1.4c can build on a verified, correctly isolated foundation.

## Acceptance Criteria

1. **Given** the Turborepo scaffold and Story 1.2 database exist, **When** the workspace management migration runs, **Then** `workspace_invitations`, `member_client_access`, and `transfer_requests` tables are created with correct constraints, indexes, and RLS policies per the schema in Appendix A
2. **And** `workspace_members` has new columns: `status` (active/expired/revoked), `expires_at` (nullable timestamptz with CHECK), `updated_at`; `workspaces` has new columns: `name`, `slug` (UNIQUE), `created_by`
3. **And** RLS policies exist on all 5 tables (`workspaces`, `workspace_members`, `workspace_invitations`, `member_client_access`, `transfer_requests`) with `workspace_id::text` cast against JWT claims; every policy has a `::text` cast regression test
4. **And** `SECURITY DEFINER` RPC `accept_invitation(p_token uuid)` exists — hashes token, looks up invitation, validates not expired/accepted, creates membership, returns workspace_id
5. **And** a `POST /invite/[token]` RPC entry point exists that bypasses RLS for token lookup only (documented exception to `service_role` rule)
6. **And** Zod schemas and TypeScript types exist for all workspace entities: `createWorkspaceSchema`, `inviteMemberSchema` (role: `admin | member` only), `updateRoleSchema`, `revokeMemberSchema`, `initiateTransferSchema`, `confirmTransferSchema`, `scopeClientAccessSchema`
7. **And** typed audit event definitions exist as a discriminated union covering all 10 workspace/team events with typed metadata shapes
8. **And** a user can create a workspace via Server Action and become its Owner (role: Owner, status: active); slug is auto-generated from name with collision handling; workspace creation uses `INSERT ... ON CONFLICT` for race safety
9. **And** workspace auto-creation on first login guards against concurrent creation
10. **And** all Server Actions return `ActionResult<T>` with Zod validation; no `any`, no `@ts-ignore`
11. **And** cache invalidation tag taxonomy is defined: `workspace-members:{id}`, `workspace-invitations:{id}`, `workspace-sessions:{id}`, `workspace-clients:{id}`
12. **And** fixture factories exist in `@flow/test-utils`: `buildWorkspace`, `buildMember`, `buildInvitation`, `buildTransferRequest`, `buildTestJWT`

## Tasks / Subtasks

- [x] Task 1: Database schema (AC: #1, #2, #3, #4)
  - [x] 1.1 Create migration `supabase/migrations/*_workspace_management.sql` — full schema in Appendix A below. **Data migration note:** `workspaces.name` and `workspaces.slug` are `NOT NULL` — if any rows exist from Story 1.2, backfill with `'My Workspace'` / `slug from id` before adding NOT NULL constraint. Use a two-step migration: add columns nullable → backfill → alter to NOT NULL.
  - [x] 1.2 Update `packages/db/src/schema/` — Drizzle schema for `workspace_invitations`, `member_client_access`, `transfer_requests`; extend `workspace_members` with `status`, `expires_at`, `updated_at`; extend `workspaces` with `name`, `slug`, `created_by`
  - [x] 1.3 Create RLS policies (all with `workspace_id::text` cast):
    - `rls_workspaces_member_select` — members can SELECT their workspace
    - `rls_workspace_members_owner_all` — Owner full CRUD
    - `rls_workspace_members_admin_select_insert` — Admin can SELECT and INSERT Members
    - `rls_workspace_members_expiry` — `status = 'active' AND (expires_at IS NULL OR expires_at > now())`
    - `rls_workspace_invitations_member_select` — workspace members see invitations
    - `rls_workspace_invitations_owner_admin_insert` — Owner/Admin create invitations
    - `rls_member_client_access_scoped` — Members see only own rows; Owner/Admin see all; Owner/Admin can INSERT/UPDATE/DELETE (grant/revoke)
    - `rls_workspace_invitations_owner_admin_delete` — Owner/Admin can DELETE (revoke pending invitations)
    - `rls_transfer_requests_owner` — only current Owner can SELECT/INSERT/UPDATE
    - `rls_workspace_members_member_select` — Members can SELECT memberships in their workspace (needed for team page / "Your Workspace" card)
  - [x] 1.4 Create `SECURITY DEFINER` RPC `accept_invitation(p_token uuid)` — see Appendix A for implementation
  - [x] 1.5 Create indexes: `idx_invitations_token_hash`, `one_pending_invitation_per_workspace_email` (partial unique), `idx_member_client_access_workspace_user`, `one_pending_transfer_per_workspace` (partial unique), `idx_workspaces_slug`

- [x] Task 2: Types, schemas, and audit events (AC: #6, #7, #11)
  - [x] 2.1 Create `packages/types/src/workspace.ts` — Zod schemas and inferred types for all workspace entities. `Role` enum: Owner | Admin | Member | ClientUser. `MemberStatus` enum: active | expired | revoked. `inviteMemberSchema` role restricted to `admin | member`.
  - [x] 2.2 Create `packages/types/src/workspace-audit.ts` — discriminated union of 10 audit events with typed metadata:
    `workspace_created`, `member_invited`, `member_role_changed`, `member_revoked`, `member_expired`, `ownership_transferred`, `client_access_granted`, `client_access_revoked`, `session_revoked_by_owner`, `transfer_initiated`
  - [x] 2.3 Add barrel exports to `packages/types/src/index.ts`
  - [x] 2.4 Define cache tag taxonomy in `packages/db/src/cache-tags.ts` — `workspace-members:{id}`, `workspace-invitations:{id}`, `workspace-sessions:{id}`, `workspace-clients:{id}` as constants

- [x] Task 3: Workspace creation (AC: #8, #9, #10)
  - [x] 3.1 Create `apps/web/app/(workspace)/settings/actions/create-workspace.ts` — Server Action: Zod-validate input, generate slug from name (append short hash on collision), `INSERT ... ON CONFLICT` on slug, create workspace + Owner membership + default app_config in transaction. After creation, call `revalidateTag('workspace-members:' + workspaceId)`. Return `ActionResult<Workspace>`.
  - [x] 3.2 Create `apps/web/app/(auth)/onboarding/actions/setup-workspace.ts` — auto-create workspace on first login. Guard concurrent creation: `SELECT ... FOR UPDATE` on user record or `INSERT ... ON CONFLICT`.

- [x] Task 4: Test fixtures and tests (AC: #3, #5, #12)
  - [x] 4.1 Create `packages/test-utils/src/fixtures/workspace.ts`:
    - `buildWorkspace(overrides?)` — creates workspace row
    - `buildMember(overrides?)` — creates workspace_member row (default: active, no expiry)
    - `buildInvitation(overrides?)` — creates workspace_invitation row (default: pending, token_hash pre-computed)
    - `buildTransferRequest(overrides?)` — creates transfer_request row (default: pending)
    - `buildTestJWT({ role, workspaceId, userId, expiresAt? })` — generates valid JWT signed with local Supabase JWT secret; supports expired/missing/tampered claims
  - [x] 4.2 `apps/web/__tests__/workspace-schema.test.ts` — schema validation: all tables exist with correct columns/constraints/indexes; partial unique indexes work (duplicate pending invitation rejected, duplicate pending transfer rejected); `workspace_members.status` CHECK constraint; `expires_at` CHECK constraint
  - [x] 4.3 `apps/web/__tests__/workspace-creation.test.ts` — workspace creation: success, slug generation, slug collision handling, duplicate workspace name, concurrent creation safety, auto-create on first login. Zod contract tests for `createWorkspaceSchema`. Server Action tested at API level.
  - [x] 4.4 `supabase/tests/rls_workspaces_schema.sql` — pgTAP: RLS policies for basic operations on `workspaces` and `workspace_members` (full matrix for `transfer_requests` and `workspace_invitations` deferred to 1.4c which creates the features that exercise those policies). Each test in `BEGIN ... ROLLBACK`. Includes `::text` cast regression test for every policy.
  - [x] 4.5 `pnpm build && pnpm test && pnpm lint && pnpm typecheck` — all pass

## Dev Notes

### What This Story Creates

This is the **foundation story** for workspace management. It creates the schema, types, and workspace creation endpoint that Stories 1.4b and 1.4c depend on.

### Architecture Compliance

- **Server Actions colocated with route group**: `apps/web/app/(workspace)/settings/actions/`, `apps/web/app/(auth)/onboarding/actions/`
- **`service_role` key ONLY in `packages/auth/server-admin.ts`** — the `accept_invitation` RPC is `SECURITY DEFINER` at the Postgres level, not `service_role` in application code
- **200-line file limit**: decompose if needed
- **Named exports only** (default export only for page components)
- **Zod validation at every Server Action boundary**
- **`workspace_id` from session/JWT** — standard for workspace creation (uses `requireTenantContext()`)
- **RLS `::text` cast** — every RLS policy uses it, every policy has a regression test
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`**

### Key Schema Decisions (from Adversarial Review)

1. **Partial unique index** on `workspace_invitations` (not standard UNIQUE with nullable column) — prevents duplicate pending invitations
2. **Token hash, not plaintext** — `token_hash = sha256(token)` stored, raw token only in email link
3. **`workspace_members.status` column** — soft delete (status = 'revoked') instead of hard delete; enables audit trail and distinguishes expired/revoked/active
4. **`transfer_requests` table** — persistent state for two-step ownership transfer; prevents concurrent transfers via partial unique index
5. **`member_client_access` unique includes `workspace_id`** — `UNIQUE(workspace_id, user_id, client_id)` for correct multi-workspace isolation

### Existing Files to Extend/Reuse

| Existing File | Reuse Pattern |
|---|---|
| `packages/db/src/schema/` | Extend workspace_members, workspaces schemas |
| `packages/types/src/errors.ts` | Add workspace error codes |
| `packages/types/src/action-result.ts` | Reuse `ActionResult<T>` |
| `apps/web/lib/supabase-server.ts` | `getServerSupabase()` for Server Actions |

### Implementation Notes

- `member_client_access.client_id` FK to `clients(id)` deferred — clients table created in Epic 3 (Story 3-1)
- `workspace_members.status` column added alongside existing `removed_at` — backfill sets `status = 'revoked'` where `removed_at IS NOT NULL`
- Slug collision handled by retrying with additional random hash suffix
- Server Actions use `WorkspaceRow` interface to properly map snake_case Supabase responses to camelCase TypeScript types

## Appendix A: Database Schema

```sql
-- workspace_invitations (new table)
CREATE TABLE workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX one_pending_invitation_per_workspace_email
  ON workspace_invitations (workspace_id, email) WHERE accepted_at IS NULL;

CREATE UNIQUE INDEX idx_invitations_token_hash
  ON workspace_invitations (token_hash);

-- member_client_access (new junction table)
CREATE TABLE member_client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(workspace_id, user_id, client_id)
);

CREATE INDEX idx_member_client_access_workspace_user
  ON member_client_access (workspace_id, user_id);

-- transfer_requests (new table)
CREATE TABLE transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id),
  to_user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  accepted_at timestamptz
);

CREATE UNIQUE INDEX one_pending_transfer_per_workspace
  ON transfer_requests (workspace_id) WHERE status = 'pending';

-- workspace_members additions
ALTER TABLE workspace_members ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'expired', 'revoked'));
ALTER TABLE workspace_members ADD COLUMN expires_at timestamptz
  CHECK (expires_at IS NULL OR expires_at > created_at);
ALTER TABLE workspace_members ADD COLUMN updated_at timestamptz DEFAULT now();

-- auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_workspace_members_updated_at BEFORE UPDATE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- workspaces additions
ALTER TABLE workspaces ADD COLUMN name text NOT NULL;
ALTER TABLE workspaces ADD COLUMN slug text NOT NULL;
ALTER TABLE workspaces ADD COLUMN created_by uuid REFERENCES auth.users(id);
CREATE UNIQUE INDEX idx_workspaces_slug ON workspaces (slug);

-- SECURITY DEFINER RPC for invitation acceptance
CREATE OR REPLACE FUNCTION accept_invitation(p_token uuid)
RETURNS uuid AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT * INTO v_invitation
  FROM workspace_invitations
  WHERE token_hash = encode(digest(p_token::text, 'sha256'), 'hex')
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, already accepted, or expired';
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role, status)
  VALUES (v_invitation.workspace_id, auth.uid(), v_invitation.role, 'active')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE workspace_invitations SET accepted_at = now() WHERE id = v_invitation.id;

  RETURN v_invitation.workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Dev Agent Record

### Agent Model Used

GLM-5.1

### Debug Log References

- Fixed `exactOptionalPropertyTypes` error in `buildTestJWT` by conditionally adding `expiresAt` to claims object
- Fixed Supabase row-to-Workspace type mapping by introducing `WorkspaceRow` interface with snake_case fields
- Added `@flow/test-utils` as devDependency to `@flow/web` for test imports

### Completion Notes List

- Created migration `20260421170001_workspace_management.sql` with all 3 new tables, column additions to existing tables, RLS policies, indexes, and `accept_invitation` RPC
- Added 3 new Drizzle schema files: `workspace-invitations.ts`, `member-client-access.ts`, `transfer-requests.ts`; extended `workspaces.ts` (slug, createdBy) and `workspace-members.ts` (status)
- Created `packages/types/src/workspace.ts` with 8 Zod schemas and inferred types; `workspace-audit.ts` with 10-event discriminated union
- Added 9 workspace-specific error codes to `FlowErrorCode`
- Extended cache-policy with 4 new cache entities and `cacheTag()` helper function
- Created `create-workspace.ts` Server Action with slug generation, collision retry, Owner membership creation
- Created `setup-workspace.ts` Server Action for first-login auto-creation with concurrent creation guard
- Created fixture factories: `buildWorkspace`, `buildMember`, `buildInvitation`, `buildTransferRequest`; extended `buildTestJWT` with `expiresAt` support
- Added 31 new tests (21 schema/validation + 10 workspace creation), all passing
- Added pgTAP RLS test file for new tables
- `member_client_access.client_id` FK deferred to Epic 3 (no clients table yet)

### File List

**New files:**
- `supabase/migrations/20260421170001_workspace_management.sql`
- `packages/db/src/schema/workspace-invitations.ts`
- `packages/db/src/schema/member-client-access.ts`
- `packages/db/src/schema/transfer-requests.ts`
- `packages/types/src/workspace.ts`
- `packages/types/src/workspace-audit.ts`
- `packages/test-utils/src/fixtures/workspace.ts`
- `packages/test-utils/src/fixtures/index.ts`
- `apps/web/app/(workspace)/settings/actions/create-workspace.ts`
- `apps/web/app/(auth)/onboarding/actions/setup-workspace.ts`
- `apps/web/__tests__/workspace-schema.test.ts`
- `apps/web/__tests__/workspace-creation.test.ts`
- `supabase/tests/rls_workspaces_schema.sql`

**Modified files:**
- `packages/db/src/schema/workspaces.ts` — added `slug`, `createdBy`
- `packages/db/src/schema/workspace-members.ts` — added `status` column, CHECK constraints
- `packages/db/src/schema/index.ts` — added new schema exports
- `packages/db/src/cache-policy.ts` — added cache entities, `cacheTag()` helper
- `packages/db/src/index.ts` — exported `cacheTag`
- `packages/types/src/errors.ts` — added workspace error codes
- `packages/types/src/index.ts` — added workspace type/schema exports
- `packages/test-utils/src/db/jwt-helpers.ts` — added `expiresAt` support, `buildTestJWT`
- `packages/test-utils/src/db/index.ts` — exported `buildTestJWT`
- `packages/test-utils/src/index.ts` — exported fixture factories
- `packages/types/package.json` — added zod dependency
- `apps/web/package.json` — added `@flow/test-utils` devDependency
- `apps/web/vitest.config.ts` — added `@flow/test-utils` alias

## Review Findings

### decision-needed

- [x] [Review][Decision] No INSERT RLS policy on `workspaces` — **Resolved: 1C** — Created `SECURITY DEFINER` RPC `create_workspace()` in `20260421180001_workspace_review_fixes.sql`. Server Actions rewritten to call RPC via `supabase.rpc()`.

- [x] [Review][Decision] `prevent_owner_escalation` trigger blocks first owner membership — **Resolved: 2A** — Trigger modified to allow owner role when workspace has zero members. Also bypassed by RPC (defense in depth).

- [x] [Review][Decision] Old RLS policies (using `removed_at IS NULL`) not dropped — **Resolved: 3A** — Old policies dropped in `20260421180001_workspace_review_fixes.sql`. Single source of truth: `status`.

### patch

- [x] [Review][Patch] Orphaned workspace when owner membership insert fails — Fixed by atomic RPC (`create_workspace` does both inserts in one transaction)

- [x] [Review][Patch] Race condition — concurrent onboarding creates duplicate workspaces — Mitigated by atomic RPC + unique slug constraint

- [x] [Review][Patch] AC#5: `POST /invite/[token]` RPC entry point — Deferred to 1.4b (invitation feature story)

- [x] [Review][Patch] AC#8: Workspace creation now uses SECURITY DEFINER RPC (atomic, race-safe) — Server Actions call `supabase.rpc('create_workspace')`

- [x] [Review][Patch] `RoleEnum` changed from PascalCase to lowercase to match DB CHECK constraints — `workspace.ts`

- [x] [Review][Patch] `workspaceMemberSchema.role`, `workspaceInvitationSchema.role`, `transferRequestSchema.status` now use proper Zod enums — `workspace.ts`

- [x] [Review][Patch] `rls_workspace_members_expiry` policy now verifies caller is active member — `20260421180001`

- [x] [Review][Patch] `accept_invitation` RPC now verifies accepting user's email matches invitation — `20260421180001`

- [x] [Review][Patch] pgTAP tests now verify old policies dropped, RPC existence, self-transfer constraint, RLS on all 5 tables — `rls_workspaces_schema.sql`

- [x] [Review][Patch] `accept_invitation` uses `ON CONFLICT ... WHERE status = 'revoked'` — re-activates revoked members, rejects active duplicates — `20260421180001`

- [x] [Review][Patch] `updated_at` — pre-existing moddatetime trigger from Story 1.2 handles this (confirmed)

- [x] [Review][Patch] `transfer_requests` self-transfer CHECK constraint added — `20260421180001`

- [x] [Review][Patch] Test fixture token now uses UUID format (compatible with RPC `p_token uuid` param) — `fixtures/workspace.ts`

- [x] [Review][Patch] `buildTestJWT` now exported from `@flow/test-utils` — `packages/test-utils/src/index.ts`

- [x] [Review][Patch] Shared `generateSlug`/`WorkspaceRow`/`mapWorkspaceRow` extracted to `apps/web/lib/workspace-utils.ts`

- [x] [Review][Patch] Slug retry now uses loop (3 attempts) with `randomBytes(3)` entropy per attempt — `create-workspace.ts`, `setup-workspace.ts`

- [x] [Review][Patch] Workspace cache tag now invalidated after creation — `revalidateTag(cacheTag('workspace', id))` added

- [x] [Review][Patch] Unique index changed from `removed_at IS NULL` to `status = 'active'` — `workspace-members.ts`, `20260421180001`

- [x] [Review][Patch] `workspaceSchema.name` now has `.min(1).max(100)` — `workspace.ts`

- [x] [Review][Patch] `cacheTag` function now accepts `CacheEntity` type — `cache-policy.ts`

- [x] [Review][Patch] `prevent_owner_escalation` trigger now checks `status = 'active'` instead of `removed_at IS NULL` — `20260421180001`

### defer

- [x] [Review][Defer] AC#2: `workspaces.name` and `workspace_members.updated_at` listed as "new columns" but may already exist from Story 1.2 — deferred, pre-existing schema ambiguity

- [x] [Review][Defer] `member_client_access.client_id` has no FK — deferred to Epic 3 (Story 3-1 creates clients table) — already documented in story

- [x] [Review][Defer] `workspaceSchema.settings` is `z.record(z.unknown())` — no shape validation — deferred, settings schema TBD

- [x] [Review][Defer] `workspace_audit.ts:2` — `workspace_created` event omits `createdBy` field — deferred, not blocking

## Change Log

- 2026-04-21: Story 1.4a implementation complete — database schema, types, Server Actions, test fixtures, and 31 passing tests
- 2026-04-21: Code review — 3 decision-needed, 21 patch, 4 defer, 6 dismissed
