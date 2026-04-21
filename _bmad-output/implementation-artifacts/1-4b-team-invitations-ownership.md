# Story 1.4b: Team Invitations & Ownership

Status: ready-for-dev
Parent: Story 1.4 (Workspace & Team Management)
Depends on: Story 1.4a
Blocks: Story 1.4c

## Story

As a workspace owner,
I want to invite team members, manage roles, revoke access, set time-bound subcontractor access, and transfer ownership,
So that my team can collaborate with appropriate, enforceable access levels.

## Acceptance Criteria

1. **And** they can invite team members via email — invitations sent via magic link; invitation tokens are SHA-256 hashed in database; `client_user` role excluded from invitations; self-invitation prevented; duplicate pending invitations handled by updating existing record (resend)
2. **And** they can assign roles (Admin, Member) — only Owner can assign/reassign roles; Admin can invite Members only; Owner role only via transfer; self-role-change prevented
3. **And** they can revoke access with immediate effect across all active sessions — `workspace_members.status` set to `revoked` (soft delete); cascades to `member_client_access`; revoked user sees `/removed` page (human message, not 403)
4. **And** they can grant subcontractors time-bound access — `expires_at` on `workspace_members`; RLS enforces expiry at data layer (no middleware DB query); CHECK constraint: max 1 year, must be future
5. **And** they can transfer ownership via two-step flow — `transfer_requests` table; one-pending-per-workspace; `SELECT ... FOR UPDATE` for atomic swap; 48-hour expiry
6. **And** the invitation acceptance flow is complete: landing page at `/invite/[token]` handles new user, existing user, expired, already-accepted states; workspace_id from invitation record (documented exception to JWT rule)
7. **And** destructive actions (revoke, transfer) have confirmation dialogs with distinct visual treatments
8. **And** invitation rate limiting: 10 per workspace per hour via `apps/web/lib/rate-limit.ts`
9. **And** all Server Actions return `ActionResult<T>` with Zod validation; no `any`, no `@ts-ignore`

## Tasks / Subtasks

- [ ] Task 1: Team member invitation (AC: #1, #2, #6, #8)
  - [ ] 1.1 Create `apps/web/app/(workspace)/settings/team/actions/invite-member.ts` — Server Action: Zod-validate email + role (`admin | member` only); reject self-invitation (email matches current user); check inviter role (Admin → Member only, Owner → Admin | Member); enforce rate limit (10/workspace/hour via `rate_limits` table key `workspace_invitations:{workspace_id}`); check for existing pending invitation — if found, update token_hash + reset expires_at (resend); create invitation with `token_hash = sha256(token)`; send email via Resend ("Join [Workspace] on Flow OS"); call `revalidateTag('workspace-invitations:' + workspaceId)` and `revalidateTag('workspace-members:' + workspaceId)` after mutation. Return `ActionResult<WorkspaceInvitation>` (no token in response). Decompose into sub-modules if >200 lines.
  - [ ] 1.2 Create `apps/web/app/(auth)/invite/[token]/page.tsx` — Server Component: calls `accept_invitation(token)` RPC. Handles 4 states: (a) new user → redirect to magic link auth with token preserved; (b) existing user → show workspace name, inviter, role, "Accept" button; (c) expired → "This invitation has expired. Contact [owner name] for a new one."; (d) already accepted → "You're already a member of [Workspace Name]."
  - [ ] 1.3 Create `apps/web/app/(auth)/invite/[token]/actions/accept-invitation.ts` — Server Action: calls `accept_invitation(token)` RPC. **Exception to `workspace_id` from JWT rule** — workspace_id comes from invitation record via RPC. After acceptance, call `revalidateTag('workspace-members:' + workspaceId)` and `revalidateTag('workspace-invitations:' + workspaceId)`, establish workspace context, redirect to dashboard.
  - [ ] 1.4 Create `apps/web/app/(workspace)/settings/team/actions/update-role.ts` — Server Action: Owner-only; validate target membership exists and is `status = 'active'`; prevent self-role-change; prevent removing last Owner; prevent assigning Owner role (use transfer); log to audit_log with `role_before`/`role_after` in metadata; call `invalidateUserSessions()` for target if role downgraded; call `revalidateTag('workspace-members:' + workspaceId)`.

- [ ] Task 1b: Confirmation dialog tests (AC: #7)
  - [ ] 1b.1 Add tests for `confirm-revoke-dialog.tsx` and `confirm-transfer-dialog.tsx` in `apps/web/__tests__/workspace-dialogs.test.tsx` — rendering, open/close, cancel prominent, warning treatment, two-step transfer name input, accessibility (ARIA labels, Escape to close, focus return). Deferred to 1.4c integration if component tests are not yet feasible (these are Client Components and may need Playwright in 1.4c).

- [ ] Task 2: Access revocation (AC: #3, #7)
  - [ ] 2.1 Create `apps/web/app/(workspace)/settings/team/actions/revoke-member.ts` — Server Action: Owner-only; `UPDATE workspace_members SET status = 'revoked'` (soft delete); soft-delete `member_client_access` (set `revoked_at = now()`); call `invalidateUserSessions(targetUserId)`; log to audit_log; prevent revoking last Owner; call `revalidateTag('workspace-members:' + workspaceId)` and `revalidateTag('workspace-clients:' + workspaceId)`. Return `ActionResult<void>`.
  - [ ] 2.2 Create `apps/web/app/(removed)/page.tsx` — Server Component: "You have been removed from [Workspace Name]. If you believe this is an error, contact your workspace owner." + "Sign in to another workspace" link (if user has other workspaces) + "Contact support" link. NOT a 403. NOT a redirect to login with no explanation.

- [ ] Task 3: Time-bound access (AC: #4)
  - [ ] 3.1 Extend `invite-member.ts` — optional `expiresAt` parameter (ISO date string). Zod validates: future date, max 1 year. Stored on `workspace_members.expires_at`. Database CHECK also enforces: `expires_at IS NULL OR expires_at > created_at` and max 1 year (application-level enforcement sufficient for max duration).
  - [ ] 3.2 Create `packages/db/src/queries/workspaces/members.ts` — `getActiveMembership(workspaceId, userId)` queries `workspace_members WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())`. Returns membership with role or null.
  - [ ] 3.3 Nightly cleanup: NOT implemented in this story. RLS policy `rls_workspace_members_expiry` enforces expiry at data layer. Add `TODO(pg-boss): nightly expiry cleanup job` comment in `members.ts`.

- [ ] Task 4: Ownership transfer (AC: #5, #7)
  - [ ] 4.1 Create `apps/web/app/(workspace)/settings/team/actions/initiate-transfer.ts` — Server Action: Owner-only; validate target is Admin or Member with `status = 'active'` in same workspace; check no pending transfer exists (partial unique index `one_pending_transfer_per_workspace` will catch at DB level); create `transfer_requests` record (status: pending, expires_at: now() + 48 hours); send confirmation email; return `ActionResult<TransferRequest>`.
  - [ ] 4.2 Create `apps/web/app/(workspace)/settings/team/actions/confirm-transfer.ts` — Server Action: validate caller is `to_user_id` from pending transfer; begin transaction:
    ```
    BEGIN;
    SELECT * FROM workspace_members WHERE workspace_id = $1 FOR UPDATE;
    SELECT * FROM transfer_requests WHERE id = $1 FOR UPDATE;
    -- verify: pending, not expired, initiator still Owner
    UPDATE workspace_members SET role = 'member', updated_at = now()
      WHERE workspace_id = $1 AND role = 'owner';
    UPDATE workspace_members SET role = 'owner', updated_at = now()
      WHERE workspace_id = $1 AND user_id = $2;
    UPDATE workspaces SET created_by = $2 WHERE id = $1;
    UPDATE transfer_requests SET status = 'accepted', accepted_at = now() WHERE id = $1;
    COMMIT;
    ```
    After commit: `invalidateUserSessions()` for both users; log `ownership_transferred` audit event.

- [ ] Task 5: Confirmation dialogs (AC: #7)
  - [ ] 5.1 Create `apps/web/app/(workspace)/settings/team/components/confirm-revoke-dialog.tsx` — Client Component. "[Name] will be immediately signed out and lose access to all workspace data." Red/warning treatment. Cancel more prominent than confirm. Shows "This user is currently active" badge if session exists. `"use client"`.
  - [ ] 5.2 Create `apps/web/app/(workspace)/settings/team/components/confirm-transfer-dialog.tsx` — Client Component. Two-step: (1) "You are about to transfer ownership of [Workspace] to [Name]. You will become a Member." (2) "Type '[Workspace Name]' to confirm." Amber/yellow treatment (more severe than revoke). Cancel more prominent. Warns if target inactive. `"use client"`.

- [ ] Task 6: Tests
  - [ ] 6.1 `apps/web/__tests__/workspace-invitation.test.ts` — invitation lifecycle state machine: pending→accepted (legal), pending→expired (legal), accepted→accepted (illegal), expired→accepted (illegal). Token hash verification. Duplicate invitation (resend). Self-invitation rejection. Rate limit enforcement. Zod contract tests for `inviteMemberSchema`. Server Action at API level.
  - [ ] 6.2 `apps/web/__tests__/workspace-revocation.test.ts` — revocation: status set to 'revoked' (not hard delete), member_client_access soft-deleted, sessions invalidated, last-owner protection, audit event logged. Server Action at API level.
  - [ ] 6.3 `apps/web/__tests__/workspace-expiry.test.ts` — time-bound access: future expiry = active, past expiry = denied via RLS, null expiry = permanent, `expires_at = now()` boundary (exactly now, ±1μs). Uses `vi.useFakeTimers()`.
  - [ ] 6.4 `apps/web/__tests__/workspace-ownership-transfer.test.ts` — initiate: Owner-only, target must be active Admin/Member, one-pending-per-workspace. Confirm: atomic swap, `SELECT ... FOR UPDATE`, both users invalidated, audit logged, workspace `created_by` updated. Expired transfer rejected. Server Action at API level.
  - [ ] 6.5 `apps/web/__tests__/workspace-concurrency.test.ts` — (a) two admins invite same email simultaneously → one invitation; (b) user revoked while accepting → acceptance fails; (c) concurrent transfer initiations → second rejected; (d) last-owner revocation under concurrency. Uses `Promise.all()`.
  - [ ] 6.6 `pnpm build && pnpm test && pnpm lint && pnpm typecheck` — all pass

## Dev Notes

### Prerequisite: Verify `invalidateUserSessions()`

Story 1.3 deferred: "`invalidateUserSessions` may not invalidate all sessions." Before Task 2, verify against local Supabase with multiple sessions. Document what it invalidates. If only refresh tokens, the 60s JWT window is the real enforcement — document in code.

### Key Decisions (from Adversarial Review)

1. **Soft delete for revocation** — `status = 'revoked'` instead of hard delete; preserves audit trail
2. **RLS for expiry, not middleware** — `rls_workspace_members_expiry` policy handles time-bound access; no DB query in middleware
3. **Token hashing** — `sha256(token)` stored, not plaintext; consistent with device trust model from 1.3a
4. **Invitation acceptance exception** — workspace_id from invitation record, not JWT; uses SECURITY DEFINER RPC from 1.4a
5. **Row-level locking for transfer** — `SELECT ... FOR UPDATE` prevents concurrent ownership mutations

### Role Hierarchy

```
Owner → invite (any role except Owner), revoke (anyone but last Owner), transfer ownership, change roles
Admin → invite Members only, revoke Members only, scope client access for Members
Member → cannot manage team
```
- Self-role-change: prevented (Owner cannot change own role)
- Self-invitation: prevented
- Admin inviting Admin: prevented (Admin can only invite Member role)
- Last Owner revocation: prevented

### Invitation Flow

**Sending:** Email + role → validate → check existing pending (resend if found) → create record with token_hash → send email → rate limit (10/workspace/hour)

**Acceptance:** Click link → `/invite/[token]` → `accept_invitation(token)` RPC → new user? → auth flow → accept → membership created → redirect to workspace

### Error Messages

| Scenario | Message |
|---|---|
| Already a member | "[email] is already a member of this workspace." |
| Pending invite exists | "An invitation is already pending for [email]. Resend?" |
| Self-invitation | "You cannot invite yourself." |
| Transfer already pending | "An ownership transfer is already pending for this workspace." |
| Transfer expired | "The transfer wasn't confirmed in time. Your ownership is unchanged." |
| Insufficient permissions | "You don't have permission to perform this action." |

### Existing Files to Extend/Reuse

| File | Reuse |
|---|---|
| `packages/auth/server-admin.ts` | `invalidateUserSessions()` |
| `apps/web/lib/auth-audit.ts` | Log workspace/team events |
| `apps/web/lib/rate-limit.ts` | Rate limit for invitations |
| `packages/types/src/workspace.ts` | Zod schemas from 1.4a |
| `packages/types/src/workspace-audit.ts` | Typed audit events from 1.4a |
| `packages/test-utils/src/fixtures/workspace.ts` | Fixtures from 1.4a |

### Architecture Compliance

- Server Actions in `apps/web/app/(workspace)/settings/team/actions/`
- `workspace_id` from JWT for all actions **except** `accept-invitation.ts` (documented exception — from invitation record)
- `revalidateTag()` with tags from `packages/db/src/cache-tags.ts` (1.4a): `workspace-members:{id}`, `workspace-invitations:{id}`
- `"use client"` only for confirmation dialog components

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
