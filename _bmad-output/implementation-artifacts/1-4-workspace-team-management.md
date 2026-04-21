# Story 1.4: Workspace & Team Management

Status: split
Split into: 1.4a (schema + creation), 1.4b (invitations + ownership), 1.4c (scoping + sessions + UI + audit)
Revised: 2026-04-21 — 4-agent adversarial review (Winston, Murat, Amelia, Sally). 22 findings addressed. Split into 3 sub-stories, each validated.

> **Sprint Note:** This story covers a large surface area (13 tasks, 40+ subtasks). The dev agent should evaluate whether to implement as one story or split into sub-stories at implementation time. Recommended split: 1.4a (Tasks 1–2: schema + workspace creation), 1.4b (Tasks 3–6: invitations, revocation, expiry, ownership), 1.4c (Tasks 7–13: client scoping, sessions, UI, audit, tests).

## Story

As a workspace owner,
I want to create a workspace, invite members, and manage roles,
So that my team can collaborate with appropriate access levels.

## Acceptance Criteria

1. **Given** a user is authenticated via magic link, **When** the user creates a workspace, **Then** they become the workspace owner (role: Owner) per FR1
2. **And** they can invite team members via email per FR1 — invitations sent via magic link to the invitee; invitation tokens are hashed (SHA-256) in the database, never stored plaintext
3. **And** they can assign roles (Admin, Member) per FR2 — only Owner can assign/reassign roles; Admin can invite Members; Owner role only assignable via ownership transfer; ClientUser role excluded from workspace invitations (portal-only)
4. **And** they can revoke access for team members with immediate effect across all active sessions per FR4 — uses `invalidateUserSessions()` from Story 1.3; revocation sets `workspace_members.status = 'revoked'` (soft delete, not hard delete); cascades to `member_client_access`
5. **And** they can grant seasonal subcontractors time-bound access that auto-expires on a set date per FR5 — `expires_at` column on `workspace_members`; RLS policy enforces `expires_at IS NULL OR expires_at > now()` at the data layer; no middleware DB query required
6. **And** they can transfer ownership via a confirmed succession flow per FR6 — two-step confirmation with `transfer_requests` table (initiate → target user accepts within 48 hours); atomic role swap with `SELECT ... FOR UPDATE`; concurrent transfer prevention via one-pending-per-workspace constraint
7. **And** team members can access only the clients and data their role permits per FR3 — RLS enforces role-based scoping; Member access further scoped by `member_client_access` junction
8. **And** the workspace owner can view active sessions and revoke any session remotely per FR10 — builds on device trust infrastructure from Story 1.3a; `service_role` usage explicitly documented and scoped
9. **And** all workspace/team mutations are logged to `audit_log` with workspace_id, actor_id, action, target_user_id, outcome, and `metadata` JSONB containing `role_before`/`role_after` for role-change events
10. **And** all Server Actions return `ActionResult<T>` with Zod validation on every input — no `any`, no `@ts-ignore`
11. **And** RLS policies on `workspaces`, `workspace_members`, `workspace_invitations`, `member_client_access`, `transfer_requests` enforce role-based access at the data layer — every policy uses `workspace_id::text` cast against JWT claims; invitation acceptance uses `SECURITY DEFINER` RPC
12. **And** workspace creation triggers tenant provisioning that creates a fully isolated workspace per FR91
13. **And** role-based UI rendering: Members see "Your Workspace" info card (their role, workspace name); Admins see member list + invite + client scoping but no role/ownership management; Owners see full management; ClientUsers cannot access workspace settings routes at all
14. **And** the invitation acceptance flow is fully specified: email template, invitation landing page, expired/already-accepted handling, new-user vs existing-user paths, pending invitations list with resend/revoke
15. **And** destructive actions (revoke, ownership transfer) have confirmation dialogs with distinct visual treatments; revoked users see a "You have been removed" page, not a generic 403

## Tasks / Subtasks

### Phase 1: Schema & Foundation

- [ ] Task 1: Database schema for workspace management (AC: #1, #2, #3, #5, #6, #11, #12)
  - [ ] 1.1 Create migration `supabase/migrations/*_workspace_management.sql` with the following schema changes:
    - **workspaces**: add `name text NOT NULL`, `slug text NOT NULL`, `created_by uuid REFERENCES auth.users(id)`; `UNIQUE(slug)` constraint; index `idx_workspaces_slug`
    - **workspace_members**: add `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked'))`, `expires_at timestamptz`, `updated_at timestamptz DEFAULT now()`; index `idx_workspace_members_workspace_status (workspace_id, status)`
    - **workspace_invitations** (new table — see full schema in Appendix A)
    - **member_client_access** (new junction table — see full schema in Appendix A)
    - **transfer_requests** (new table — see full schema in Appendix A)
  - [ ] 1.2 Update `packages/db/src/schema/` — Drizzle schema for all new tables; update `workspace_members` schema with `status`, `expires_at`, `updated_at`
  - [ ] 1.3 Create RLS policies (all with `workspace_id::text` cast against JWT claims):
    - `rls_workspaces_member_select` — members can SELECT their workspace
    - `rls_workspace_members_owner_all` — Owner has full CRUD on memberships
    - `rls_workspace_members_admin_select_insert` — Admin can SELECT and INSERT (invite) Members
    - `rls_workspace_members_expiry` — RLS check: `status = 'active' AND (expires_at IS NULL OR expires_at > now())` — expired members denied at data layer
    - `rls_workspace_invitations_member_select` — workspace members can see invitations
    - `rls_workspace_invitations_owner_admin_insert` — Owner/Admin can create invitations
    - `rls_member_client_access_scoped` — Members see only rows matching their user_id; Owner/Admin see all
    - `rls_transfer_requests_owner` — only current workspace Owner can SELECT/INSERT/UPDATE transfer requests
  - [ ] 1.4 Create `SECURITY DEFINER` RPC: `accept_invitation(p_token uuid)` — looks up invitation by `token_hash`, validates not expired/already accepted, creates `workspace_members` record, marks invitation accepted, returns workspace_id. Runs as Postgres superuser to bypass RLS for the token lookup (only this RPC; all other paths use session-scoped client)
  - [ ] 1.5 Add indexes: `idx_invitations_token_hash ON workspace_invitations (token_hash)`, `idx_invitations_workspace_email_pending ON workspace_invitations (workspace_id, email) WHERE accepted_at IS NULL`, `idx_member_client_access_workspace_user ON member_client_access (workspace_id, user_id)`, `idx_transfer_requests_pending ON transfer_requests (workspace_id) WHERE status = 'pending'`

- [ ] Task 2: Types, validation schemas, and audit event definitions (AC: #9, #10)
  - [ ] 2.1 Create `packages/types/src/workspace.ts` — Zod schemas: `createWorkspaceSchema`, `inviteMemberSchema` (role restricted to `admin | member` only), `updateRoleSchema`, `revokeMemberSchema`, `initiateTransferSchema`, `confirmTransferSchema`, `scopeClientAccessSchema`. Inferred types: `Workspace`, `WorkspaceMember`, `WorkspaceInvitation`, `MemberClientAccess`, `TransferRequest`, `Role` (enum: Owner | Admin | Member | ClientUser), `MemberStatus` (enum: active | expired | revoked)
  - [ ] 2.2 Create `packages/types/src/workspace-audit.ts` — typed audit event definitions with discriminated union. Each event has a typed `metadata` shape:
    ```
    WorkspaceAuditEvent =
      | { action: 'workspace_created'; metadata: { workspace_id: string } }
      | { action: 'member_invited'; metadata: { workspace_id: string; target_email: string; role: Role } }
      | { action: 'member_role_changed'; metadata: { workspace_id: string; target_user_id: string; role_before: Role; role_after: Role } }
      | { action: 'member_revoked'; metadata: { workspace_id: string; target_user_id: string } }
      | { action: 'member_expired'; metadata: { workspace_id: string; target_user_id: string } }
      | { action: 'ownership_transferred'; metadata: { workspace_id: string; from_user_id: string; to_user_id: string } }
      | { action: 'client_access_granted'; metadata: { workspace_id: string; target_user_id: string; client_id: string } }
      | { action: 'client_access_revoked'; metadata: { workspace_id: string; target_user_id: string; client_id: string } }
      | { action: 'session_revoked_by_owner'; metadata: { workspace_id: string; target_user_id: string; device_id: string } }
      | { action: 'transfer_initiated'; metadata: { workspace_id: string; target_user_id: string } }
    ```
  - [ ] 2.3 Add barrel exports to `packages/types/src/index.ts` — export `workspace.ts` and `workspace-audit.ts`

### Phase 2: Workspace Creation

- [ ] Task 3: Workspace creation (AC: #1, #12)
  - [ ] 3.1 Create `apps/web/app/(workspace)/settings/actions/create-workspace.ts` — Server Action: validates input with `createWorkspaceSchema`, generates slug from name (append short hash on collision), creates workspace record, adds creator as Owner in `workspace_members` (status: active), creates default `app_config` entries for Free tier, redirects to workspace dashboard. Returns `ActionResult<Workspace>`. Use `INSERT ... ON CONFLICT` on slug for race safety.
  - [ ] 3.2 Create `apps/web/app/(auth)/onboarding/actions/setup-workspace.ts` — if user has 0 workspaces, auto-create on first login (from Story 1.3 callback redirect). Guard against concurrent creation with `INSERT ... ON CONFLICT` or `SELECT ... FOR UPDATE` on user record.

### Phase 3: Invitations & Membership

- [ ] Task 4: Team member invitation (AC: #2, #3, #14)
  - [ ] 4.1 Create `apps/web/app/(workspace)/settings/team/actions/invite-member.ts` — Server Action: validates email + role with `inviteMemberSchema`; rejects `client_user` role and self-invitation (email matches current user); checks inviter has Owner/Admin role (Admin can only invite Member role); enforces rate limit (10 invitations per workspace per hour via `apps/web/lib/rate-limit.ts`); creates invitation record with UUID token — stores `token_hash = sha256(token)` NOT the raw token; checks for existing pending invitation for same (workspace_id, email) — if found, generates new token, updates existing record (resend); sends invitation email via Resend with workspace name + inviter name. Returns `ActionResult<WorkspaceInvitation>` (without token). If file exceeds 200 lines, decompose into `invite-member/validate.ts`, `invite-member/persist.ts`, `invite-member/notify.ts`.
  - [ ] 4.2 Create `apps/web/app/(auth)/invite/[token]/page.tsx` — Server Component: invitation landing page. Calls `accept_invitation(token)` RPC. Handles states: (a) new user → redirect to magic link auth, then back to this page; (b) existing user → show workspace name, inviter name, assigned role, "Accept Invitation" button; (c) expired → "This invitation has expired. Contact [owner name] for a new one."; (d) already accepted → "You're already a member of [Workspace Name]."
  - [ ] 4.3 Create `apps/web/app/(auth)/invite/[token]/actions/accept-invitation.ts` — Server Action: calls `accept_invitation(token)` RPC (SECURITY DEFINER, bypasses RLS for token lookup only). This is an **explicit exception** to the "workspace_id from JWT" rule — workspace_id comes from the invitation record, not JWT. After acceptance, establishes workspace context and redirects.
  - [ ] 4.4 Create `apps/web/app/(workspace)/settings/team/actions/update-role.ts` — Server Action: only Owner can change roles; validates target membership exists and is `status = 'active'`; prevents changing own role; prevents removing last Owner; prevents assigning Owner role (use transfer flow); logs role change to audit_log with `role_before`/`role_after` in metadata; calls `invalidateUserSessions()` for target user if role downgraded

- [ ] Task 5: Access revocation (AC: #4, #15)
  - [ ] 5.1 Create `apps/web/app/(workspace)/settings/team/actions/revoke-member.ts` — Server Action: Owner-only; sets `workspace_members.status = 'revoked'` (soft delete — does NOT hard-delete the row); cascades: sets `member_client_access` rows' `revoked_at = now()` (soft delete); calls `invalidateUserSessions(targetUserId)` from `@flow/auth/server-admin`; logs to audit_log. Prevents revoking last Owner.
  - [ ] 5.2 Create `apps/web/app/(removed)/page.tsx` — Server Component: "You have been removed from [Workspace Name]. If you believe this is an error, contact your workspace owner." Not a 403. Not a redirect to login with no explanation. Human-readable message.
  - [ ] 5.3 Update `apps/web/middleware.ts` — after workspace membership check, if `workspace_members.status != 'active'`, redirect to `/removed` page (NOT query the database — use JWT claims or RLS-denied redirect)

### Phase 4: Time-Bound Access & Ownership

- [ ] Task 6: Time-bound access for subcontractors (AC: #5)
  - [ ] 6.1 Extend `invite-member.ts` — optional `expiresAt` parameter (ISO date string). Stored on `workspace_members.expires_at`. Zod validates: must be future date, max 1 year from now. Also add CHECK constraint in migration: `CHECK (expires_at IS NULL OR expires_at > created_at)` and `CHECK (expires_at IS NULL OR expires_at < created_at + interval '1 year')`.
  - [ ] 6.2 Create `packages/db/src/queries/workspaces/members.ts` — `getActiveMembership(workspaceId, userId)` function that queries `workspace_members WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())`. Returns membership with effective role, or null if expired/revoked.
  - [ ] 6.3 Nightly cleanup (DEFERRED to infrastructure story): Once pg-boss is scaffolded, add a nightly job that sets `workspace_members.status = 'expired'` WHERE `expires_at < now() AND status = 'active'`. **Not implemented in this story** — instead, RLS policy enforces expiry at the data layer. Add `TODO(pg-boss): nightly expiry cleanup` comment in migration.

- [ ] Task 7: Ownership transfer (AC: #6)
  - [ ] 7.1 Create `apps/web/app/(workspace)/settings/team/actions/initiate-transfer.ts` — Server Action: Owner-only; validates target user is Admin or Member with `status = 'active'` in same workspace; checks no other `pending` transfer request exists for this workspace (one-pending-per-workspace enforced by unique partial index); creates `transfer_requests` record (status: pending, expires_at: now() + 48 hours); sends confirmation email to target user with workspace name and transfer details. Returns `ActionResult<TransferRequest>`.
  - [ ] 7.2 Create `apps/web/app/(workspace)/settings/team/actions/confirm-transfer.ts` — Server Action: validates caller is the target user from the pending transfer request; begins transaction:
    ```
    BEGIN;
    SELECT ... FROM workspace_members WHERE workspace_id = $1 FOR UPDATE;  -- lock all members
    SELECT ... FROM transfer_requests WHERE id = $1 FOR UPDATE;  -- lock transfer request
    -- verify: transfer is still pending, hasn't expired, initiator is still Owner
    UPDATE workspace_members SET role = 'member' WHERE workspace_id = $1 AND role = 'owner';
    UPDATE workspace_members SET role = 'owner' WHERE workspace_id = $1 AND user_id = $2;
    UPDATE workspaces SET created_by = $2 WHERE id = $1;
    UPDATE transfer_requests SET status = 'accepted', accepted_at = now() WHERE id = $1;
    COMMIT;
    ```
    After commit: `invalidateUserSessions()` for both users; log `ownership_transferred` audit event.

### Phase 5: Client Scoping & Sessions

- [ ] Task 8: Client scoping for Members (AC: #7)
  - [ ] 8.1 Create `apps/web/app/(workspace)/settings/team/actions/scope-client-access.ts` — Server Action: Owner/Admin can associate/disassociate specific clients with a Member via `member_client_access` junction table. Validates client belongs to same workspace. Validates target user has Member role.
  - [ ] 8.2 Create `packages/db/src/queries/workspaces/members.ts` — `getAccessibleClients(workspaceId, userId, role)` returns all clients for Owner/Admin, scoped clients for Member (JOIN through `member_client_access`).

- [ ] Task 9: Active sessions view (AC: #8)
  - [ ] 9.1 Create `apps/web/app/(workspace)/settings/sessions/page.tsx` — Server Component listing active sessions from `user_devices` table (Story 1.3a) for all workspace members. Owner-only access. **`service_role` usage note:** This page queries `user_devices` across workspace members, requiring `service_role` to bypass RLS. This is explicitly allowed for Owner-only admin functions. Add `// service_role: allowed — owner-only cross-user device visibility (review finding M7)` comment. Scope to ESLint allowlist for this file only.
  - [ ] 9.2 Create `apps/web/app/(workspace)/settings/sessions/actions/revoke-session.ts` — Server Action: Owner-only; revokes a specific device/session for any workspace member via `invalidateUserSessions()`.

### Phase 6: UI

- [ ] Task 10: Team management UI (AC: #3, #13, #14, #15)
  - [ ] 10.1 Create `apps/web/app/(workspace)/settings/team/page.tsx` — Server Component: loads member list + pending invitations. Role-based rendering:
    - **Owner**: full management — member list with role badges, invite button, role dropdown, revoke button, client scoping link, pending invitations section with resend/revoke, initiate transfer button
    - **Admin**: member list (read), invite Members button, client scoping link for Members, no role changes, no ownership management
    - **Member**: "Your Workspace" info card showing workspace name + their role (not a member list — seeing only yourself is confusing). Link to their scoped clients.
    - **ClientUser**: cannot access this route (middleware redirect)
  - [ ] 10.2 Create `apps/web/app/(workspace)/settings/team/components/team-member-list.tsx` — Client Component with optimistic updates for role changes and revocations. Card layout on mobile (< 768px), table on desktop. `"use client"`
  - [ ] 10.3 Create `apps/web/app/(workspace)/settings/team/components/invite-form.tsx` — Client Component: email input, role select (Admin: only 'member' option; Owner: 'admin' | 'member'), optional expiry date picker (for subcontractors, max 1 year), submit with loading spinner + "Sending..." text. Validates self-invitation client-side. `"use client"`
  - [ ] 10.4 Create `apps/web/app/(workspace)/settings/team/components/pending-invitations-list.tsx` — Client Component: shows pending invitations with email, role, sent date, expiry date, resend button (generates new token), revoke button. Empty state: "No pending invitations." `"use client"`
  - [ ] 10.5 Create `apps/web/app/(workspace)/settings/team/components/confirm-revoke-dialog.tsx` — Client Component: destructive confirmation dialog. "[Name] will be immediately signed out and lose access to all workspace data." Red/warning visual treatment. Cancel button more prominent than confirm. Shows "This user is currently active" badge if session exists. `"use client"`
  - [ ] 10.6 Create `apps/web/app/(workspace)/settings/team/components/confirm-transfer-dialog.tsx` — Client Component: two-step transfer. Step 1: "You are about to transfer ownership of [Workspace] to [Name]. You will become a Member." Step 2: "Type '[Workspace Name]' to confirm." Amber/yellow visual treatment (more severe than revoke). Cancel more prominent. Warns if target member is inactive. `"use client"`
  - [ ] 10.7 Create `apps/web/app/(workspace)/settings/team/components/client-scoping-dialog.tsx` — Client Component: checkbox list of clients the member can access. Search/filter for many clients. Owner/Admin only. `"use client"`
  - [ ] 10.8 Error/loading/empty states for all components:
    - **Loading**: skeleton member list (don't flash empty state)
    - **Error**: toast notifications per action (see error message table in Dev Notes)
    - **Empty (1 member)**: "[Workspace Name] — it's just you right now!" + prominent invite button
    - **Empty (0 pending)**: "No pending invitations." (not shown if no pending section)
    - **Empty (0 sessions)**: "No other active sessions right now. You have [N] team members."
  - [ ] 10.9 Accessibility: ARIA labels on all interactive elements (`aria-label="Change role for [member name]"`, `aria-label="Remove [member name] from workspace"`). Keyboard navigation: Tab through member list, Escape closes dialogs, focus returns to trigger element after dialog close. Focus management after destructive actions.

### Phase 7: Audit & Final

- [ ] Task 11: Audit logging (AC: #9)
  - [ ] 11.1 Extend `apps/web/lib/auth-audit.ts` — import typed events from `@flow/types/workspace-audit`. Add all 10 workspace/team events. All events include `workspace_id`, `actor_id`, `target_user_id`, `outcome` in base fields; event-specific data in `metadata` JSONB per the typed schema from Task 2.2.

- [ ] Task 12: Tests (AC: all)
  - [ ] 12.1 Create fixture factories in `packages/test-utils/src/fixtures/workspace.ts`:
    - `buildWorkspace(overrides?)` — creates workspace row
    - `buildMember(overrides?)` — creates workspace_member row with defaults
    - `buildInvitation(overrides?)` — creates workspace_invitation row
    - `buildTransferRequest(overrides?)` — creates transfer_request row
    - `buildTestJWT({ role, workspaceId, userId, expiresAt? })` — generates valid JWT signed with local Supabase JWT secret. Supports: expired tokens, missing claims, tampered claims.
  - [ ] 12.2 `apps/web/__tests__/workspace-management.test.ts` — workspace creation, invitation flow, role assignment, revocation, ownership transfer. **Server Actions tested at API level** (import + execute), NOT component tests. Zod contract tests: every schema validates valid input and rejects invalid input with specific errors.
  - [ ] 12.3 `apps/web/__tests__/workspace-rbac.test.ts` — role-based access: Owner can do everything, Admin can invite/revoke Members, Member cannot manage team, ClientUser cannot access workspace routes. Cross-workspace leakage: user in Workspace X cannot see Workspace Y's members.
  - [ ] 12.4 `apps/web/__tests__/workspace-expiry.test.ts` — time-bound access: future expiry = active, past expiry = denied (via RLS, not middleware), null expiry = permanent, `expires_at = now()` boundary (test at microsecond precision: exactly now, 1μs before, 1μs after). Uses `vi.useFakeTimers()`.
  - [ ] 12.5 `apps/web/__tests__/workspace-audit.test.ts` — all 10 new audit events logged with correct fields and typed metadata shapes.
  - [ ] 12.6 `apps/web/__tests__/workspace-invitation.test.ts` — invitation lifecycle state machine: pending → accepted (legal), pending → expired (legal), accepted → accepted (illegal, rejected), expired → accepted (illegal, rejected). Invitation acceptance for new user, existing user, already-accepted, expired token. Duplicate invitation handling (resend, not create duplicate). Token hash verification.
  - [ ] 12.7 `apps/web/__tests__/workspace-concurrency.test.ts` — race conditions: (a) two admins invite same email simultaneously → only one invitation created; (b) user revoked while accepting invitation → invitation acceptance fails; (c) ownership transfer while another transfer is pending → second initiation rejected; (d) last-owner protection: cannot revoke last owner via any code path. Uses `Promise.all()` for concurrent action invocation.
  - [ ] 12.8 `supabase/tests/rls_workspaces.sql` — pgTAP: RLS policies for `workspaces`, `workspace_members`, `workspace_invitations`, `member_client_access`, `transfer_requests` across 5 roles (Owner, Admin, Member, ClientUser, Outsider). Each test runs in `BEGIN ... ROLLBACK` for isolation. **Minimum 100 test cases** covering all role × table × operation combinations. Includes: `::text` cast regression test for every policy (test fails if cast removed), outsider access denial, cross-workspace data leakage prevention, expired member access denial.

- [ ] Task 13: Final verification
  - [ ] 13.1 `pnpm build` — all packages + apps/web build
  - [ ] 13.2 `pnpm test` — all existing + new tests pass (3 consecutive runs, zero flakes)
  - [ ] 13.3 `pnpm lint` — zero errors
  - [ ] 13.4 `pnpm typecheck` — zero errors

## Dev Notes

### Prerequisite: Resolve Story 1.3 Deferred Defect

Story 1.3 deferred a finding: "`invalidateUserSessions` may not invalidate all sessions — Missing scope parameter, SDK version-dependent behavior." This story depends on `invalidateUserSessions()` for 5 use cases. **Before starting Task 5, verify** `invalidateUserSessions()` against a running Supabase local instance with multiple active sessions. Document exactly which sessions it invalidates. If it only invalidates refresh tokens, the 60-second JWT window is the real enforcement — and this must be documented in the middleware redirect logic.

### What This Story Builds On

This story extends the auth and database foundations from Stories 1.2, 1.3, and 1.3a:
- **Story 1.2** created `workspaces`, `users`, `workspace_members` tables with basic RLS and `app_config`
- **Story 1.3** created `packages/auth/` with `invalidateUserSessions()` in `server-admin.ts`, `ActionResult<T>`, `FlowError`, middleware with auth redirect, audit logging with HMAC hashing, rate limiting pattern
- **Story 1.3a** created `user_devices` table, device trust/revocation, `packages/auth/device-trust.ts`, middleware device check, audit events for device operations
- **Story 1.3** established the `apps/web` Next.js 15 App Router with route groups `(auth)`, `(workspace)`, `(portal)/[slug]`
- **Story 1.3** established the Server Action pattern: Zod validation → `requireTenantContext()` → business logic → `ActionResult<T>` return

### Existing Files to Extend/Reuse

| Existing File | Reuse Pattern |
|---|---|
| `packages/auth/server-admin.ts` | `invalidateUserSessions(targetUserId)` for revocation and role changes |
| `packages/auth/device-trust.ts` | `revokeAllDevices()` for session revocation per member |
| `apps/web/lib/auth-audit.ts` | Extend with typed workspace/team events from `@flow/types/workspace-audit` |
| `apps/web/lib/rate-limit.ts` | Reuse atomic upsert pattern for invitation rate limiting (key: `workspace_invitations:{workspace_id}`, limit: 10/hour) |
| `apps/web/middleware.ts` | Add workspace membership status check (status != 'active' → redirect to `/removed`). **No DB query** — use JWT claims or catch RLS denial in route handler |
| `apps/web/lib/supabase-server.ts` | `getServerSupabase()` for all Server Actions |
| `packages/db/src/schema/` | Extend existing workspace_members schema with new columns |
| `packages/types/src/errors.ts` | Add workspace error codes to FlowError union |
| `packages/types/src/action-result.ts` | Reuse `ActionResult<T>` for all new Server Actions |
| `apps/web/app/(workspace)/settings/` | Already has `devices/` page from 1.3a; add `team/`, `sessions/` |

### Architecture Compliance

- **Server Actions colocated with route group**: `apps/web/app/(workspace)/settings/team/actions/`, `apps/web/app/(workspace)/settings/sessions/actions/`
- **Shared query logic**: `packages/db/src/queries/workspaces/`
- **`service_role` key** — used in two places only: (1) `packages/auth/server-admin.ts` for `invalidateUserSessions()` (existing), (2) sessions page Server Action for cross-user device visibility (new, Owner-only, documented with ESLint allowlist comment)
- **200-line file limit**: decompose `invite-member.ts` into sub-modules if needed (`invite-member/validate.ts`, `invite-member/persist.ts`, `invite-member/notify.ts`)
- **Named exports only** (default export only for page components)
- **Zod validation at every Server Action boundary** — parse `input: unknown`, never trust client data
- **`workspace_id` from session/JWT** — never from URL params or form data. **One exception:** invitation acceptance (`accept-invitation.ts`) derives workspace_id from the invitation record via `SECURITY DEFINER` RPC, not from JWT. This is documented and isolated.
- **RLS `::text` cast** — all RLS policies comparing `workspace_id` (uuid) against JWT claims (text) MUST use `::text` cast. Every RLS policy has a regression test that fails without the cast.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — strict TypeScript throughout
- **App Router only** — no Pages Router patterns
- **Server Components by default** — `"use client"` only for: team-member-list, invite-form, pending-invitations-list, confirm-revoke-dialog, confirm-transfer-dialog, client-scoping-dialog
- **Never `revalidatePath()`** — always `revalidateTag()` with defined tag taxonomy:
  - `workspace-members:{workspace_id}` — invalidated on invite, accept, revoke, role change, transfer
  - `workspace-invitations:{workspace_id}` — invalidated on invite, accept, resend, revoke invitation
  - `workspace-sessions:{workspace_id}` — invalidated on session revoke
  - `workspace-clients:{workspace_id}` — invalidated on client scoping change

### Role Hierarchy Rules

```
Owner → can do everything (invite, revoke, assign roles, transfer ownership, manage billing, scope clients)
Admin → can invite Members, revoke Members, scope client access for Members, view all clients
Member → can access only scoped clients, cannot manage team or settings
ClientUser → portal-only access, never appears in workspace team management
```

- Only **one Owner** per workspace at any time (ownership transfer is atomic swap)
- **Last Owner cannot be revoked** — must transfer ownership first
- **Role downgrade triggers session invalidation** — downgraded user gets new JWT with reduced claims within 60s
- **Admin cannot revoke or re-role other Admins** — only Owner can manage Admins
- **Admin can only invite Members** — not other Admins (only Owner can assign Admin role)
- **Member access is intersection of role + client scoping** — Member with no scoped clients sees empty client list
- **Self-role-change is prevented** — Owner cannot change their own role (must use transfer flow)
- **Self-invitation is prevented** — cannot invite your own email address

### Invitation Flow (Complete)

#### Sending (Owner/Admin)

1. Owner/Admin enters invitee email + selects role (`admin | member` only — `client_user` rejected by Zod)
2. System validates: email not empty, not current user's email, not already an active member, role permitted for inviter's role
3. System checks for existing pending invitation for same (workspace_id, email) — if found, update with new token + reset expiry (resend)
4. System creates `workspace_invitations` record: generates UUID token, stores `token_hash = sha256(token)`, sets `expires_at = now() + 7 days`
5. System sends invitation email via Resend: subject "Join [Workspace Name] on Flow OS", body includes workspace name, inviter name, role, and acceptance link with `?invitation_token=<token>`
6. Rate limit: 10 per workspace per hour (enforced via `rate_limits` table)

#### Acceptance (Invitee)

1. Invitee clicks link → arrives at `/invite/[token]`
2. Server Component calls `accept_invitation(token)` RPC (SECURITY DEFINER)
3. RPC: hashes token, looks up invitation by `token_hash`, validates `accepted_at IS NULL AND expires_at > now()`
4. If invitee has no account: redirect to magic link auth with `invitation_token` preserved in URL; after auth, redirect back to `/invite/[token]`
5. If invitee has account: show acceptance page with workspace name, inviter name, assigned role; "Accept Invitation" button calls `accept-invitation` Server Action
6. Server Action: RPC creates `workspace_members` record, sets `accepted_at = now()` on invitation
7. Redirect to workspace dashboard
8. If invitation expired: "This invitation has expired. Contact [owner name] for a new one."
9. If invitation already accepted: "You're already a member of [Workspace Name]."

### Ownership Transfer Flow (Two-Step)

1. Owner initiates transfer → selects target member (must be Admin or Member with status = 'active')
2. System validates: no other pending transfer for this workspace (unique partial index)
3. System creates `transfer_requests` record (status: pending, expires_at: now() + 48 hours)
4. System sends confirmation email to target user: "You've been offered ownership of [Workspace Name]"
5. Target user clicks confirmation link → `confirm-transfer` Server Action:
   - Begin transaction with `SELECT ... FOR UPDATE` on workspace_members and transfer_request
   - Verify: transfer still pending, not expired, initiator still Owner, target still active member
   - `UPDATE workspace_members SET role = 'member' WHERE workspace_id = $1 AND role = 'owner'`
   - `UPDATE workspace_members SET role = 'owner' WHERE workspace_id = $1 AND user_id = $2`
   - `UPDATE workspaces SET created_by = $2 WHERE id = $1`
   - `UPDATE transfer_requests SET status = 'accepted', accepted_at = now() WHERE id = $1`
   - Commit
   - `invalidateUserSessions()` for both users
   - Log `ownership_transferred` audit event
6. If target user does not confirm within 48 hours, transfer request expires (nightly job or on-next-query check)

### Error Message Table

| Scenario | Error Message | Component |
|---|---|---|
| Invite email already member | "[email] is already a member of this workspace." | invite-form |
| Invite email has pending invite | "An invitation is already pending for [email]. Would you like to resend?" | invite-form |
| Self-invitation | "You cannot invite yourself." | invite-form |
| Invalid email | "Please enter a valid email address." | invite-form |
| Network failure | "Couldn't complete the action. Please try again." | toast |
| Revocation fails | "Couldn't remove [Name]. Please try again." | toast |
| Role change fails | "Couldn't update role. No changes were made." | toast |
| Transfer already pending | "An ownership transfer is already pending for this workspace." | confirm-transfer-dialog |
| Transfer expired | "The transfer wasn't confirmed in time. Your ownership is unchanged." | toast |
| Insufficient permissions | "You don't have permission to perform this action." | toast |

### Access Denied for Revoked Users

When a revoked user's middleware check detects `status != 'active'`:
- Redirect to `/removed` — NOT to login, NOT a 403
- Page shows: "You have been removed from [Workspace Name]. If you believe this is an error, contact your workspace owner."
- Includes a "Sign in to another workspace" link if user belongs to other workspaces
- Includes a "Contact support" link

### References

- [Source: epics.md#Story 1.4] — acceptance criteria, FR mapping
- [Source: architecture.md#Data Architecture] — workspace_members junction, member_client_access, RLS policies
- [Source: architecture.md#Authentication & Security] — 4 roles, RLS `::text` cast, has_access() RPC
- [Source: architecture.md#Project Structure] — `apps/web/app/(workspace)/settings/team/` directory
- [Source: architecture.md#Validation Layer Boundary] — Server Actions always validate with Zod
- [Source: architecture.md#ActionResult contract] — exact `ActionResult<T>` format
- [Source: architecture.md#FlowError contract] — discriminated union error types
- [Source: architecture.md#Mock Boundary Table] — Supabase DB mocked in unit, real in integration
- [Source: project-context.md#Language-Specific Rules] — strict TypeScript, no any, no ts-ignore
- [Source: project-context.md#Framework-Specific Rules] — Server Actions colocated, workspace_id from JWT
- [Source: project-context.md#Never Do This] — no workspace_id from URL, no service_role in user-facing code
- [Source: project-context.md#Testing Rules] — RLS test matrix per table, role-based assertions
- [Source: Story 1.3] — auth foundation, middleware, audit logging, rate limiting patterns, ActionResult pattern
- [Source: Story 1.3a] — device trust, session revocation, user_devices table, middleware device check
- [Source: Adversarial Review 2026-04-21] — 22 findings from Winston (architect), Murat (test), Amelia (dev), Sally (UX)

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

-- CRITICAL: partial unique index prevents duplicate pending invitations
-- (standard UNIQUE with nullable accepted_at does NOT work because NULL != NULL in Postgres)
CREATE UNIQUE INDEX one_pending_invitation_per_workspace_email
  ON workspace_invitations (workspace_id, email) WHERE accepted_at IS NULL;

-- index for token lookup (by hash, not plaintext)
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

-- CRITICAL: only one pending transfer per workspace
CREATE UNIQUE INDEX one_pending_transfer_per_workspace
  ON transfer_requests (workspace_id) WHERE status = 'pending';

-- workspace_members additions
ALTER TABLE workspace_members ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'expired', 'revoked'));
ALTER TABLE workspace_members ADD COLUMN expires_at timestamptz
  CHECK (expires_at IS NULL OR expires_at > created_at);
ALTER TABLE workspace_members ADD COLUMN updated_at timestamptz DEFAULT now();

-- workspaces additions
ALTER TABLE workspaces ADD COLUMN name text NOT NULL;
ALTER TABLE workspaces ADD COLUMN slug text NOT NULL;
ALTER TABLE workspaces ADD COLUMN created_by uuid REFERENCES auth.users(id);
CREATE UNIQUE INDEX idx_workspaces_slug ON workspaces (slug);

-- SECURITY DEFINER RPC for invitation acceptance
-- Bypasses RLS for token lookup only; all other paths use session-scoped client
CREATE OR REPLACE FUNCTION accept_invitation(p_token uuid)
RETURNS uuid AS $$
DECLARE
  v_invitation RECORD;
  v_workspace_id uuid;
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
  VALUES (
    v_invitation.workspace_id,
    auth.uid(),
    v_invitation.role,
    'active'
  ) ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE workspace_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;

  RETURN v_invitation.workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Appendix B: Quality Gates

| Gate | Criteria | Blocking |
|---|---|---|
| RLS tests | 100% of role×table×operation matrix passes (5 roles × 5 tables × 4 ops = 100 cases minimum) | YES |
| RLS `::text` cast regression | Every RLS policy has a test that fails without the cast | YES |
| Invitation state machine | All legal transitions succeed; all illegal transitions fail | YES |
| Concurrency: last-owner | Cannot revoke last owner via any code path | YES |
| Concurrency: duplicate invite | Only one pending invitation per (workspace, email) | YES |
| Concurrency: transfer race | Only one pending transfer per workspace; confirm is atomic | YES |
| Zod schema contracts | All valid inputs pass; all invalid inputs reject with specific errors | YES |
| Server Action integration | All actions tested at API level, not component level | YES |
| Audit events | All 10 event types logged with correct typed metadata | YES |
| No `any` / `@ts-ignore` | Zero instances in new code | YES |
| Flakiness | 3 consecutive CI runs, zero flakes | YES |
| Type coverage | `pnpm typecheck` passes | YES |

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
