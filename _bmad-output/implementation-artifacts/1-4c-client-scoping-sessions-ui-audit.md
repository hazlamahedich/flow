# Story 1.4c: Client Scoping, Sessions, UI & Audit

Status: ready-for-dev
Parent: Story 1.4 (Workspace & Team Management)
Depends on: Stories 1.4a, 1.4b

## Story

As a workspace owner,
I want to scope client access for Members, view and revoke active sessions, manage my team through a complete UI, and have all actions audit-logged,
So that my team operates with appropriate visibility and all management actions are traceable.

## Acceptance Criteria

1. **And** team members can access only the clients their role permits — Owner/Admin see all clients; Members see only clients in `member_client_access`; RLS enforces at data layer
2. **And** the workspace owner can view active sessions for all workspace members and revoke any session remotely — Owner-only; builds on `user_devices` from Story 1.3a
3. **And** all workspace/team mutations are logged to `audit_log` with workspace_id, actor_id, action, target_user_id, outcome, and typed metadata JSONB
4. **And** role-based UI rendering: Members see "Your Workspace" info card; Admins see member list + invite (Members only) + client scoping but no role/ownership management; Owners see full management; ClientUsers cannot access settings routes
5. **And** the team management page includes: member list, pending invitations list with resend/revoke, invite form, role management (Owner-only), client scoping link, and initiate transfer button
6. **And** all interactive components have ARIA labels, keyboard navigation, and focus management for accessibility
7. **And** mobile-responsive: card layout on mobile, table on desktop; bottom sheets for role changes on mobile; full-screen modals for forms
8. **And** RLS test matrix complete: 5 roles × 5 tables × operations = 100+ pgTAP cases; includes Outsider role, cross-workspace leakage prevention, `::text` cast regression tests
9. **And** comprehensive test suite passes: RBAC tests, audit tests, concurrency tests (from 1.4b), all Zod contract tests; 3 consecutive CI runs zero flakes

## Tasks / Subtasks

- [ ] Task 1: Client scoping for Members (AC: #1)
  - [ ] 1.1 Create `apps/web/app/(workspace)/settings/team/actions/scope-client-access.ts` — Server Action: Owner/Admin can grant/revoke client access for Members via `member_client_access` junction. Validates: client belongs to same workspace, target user has Member role. Grant: insert row. Revoke: set `revoked_at = now()`. Log `client_access_granted`/`client_access_revoked` audit events. Call `revalidateTag('workspace-clients:' + workspaceId)`. Zod schema: `scopeClientAccessSchema` from `@flow/types/workspace` (created in 1.4a) with contract test.
  - [ ] 1.2 Create `packages/db/src/queries/workspaces/members.ts` — `getAccessibleClients(workspaceId, userId, role)`: Owner/Admin → all clients; Member → JOIN through `member_client_access WHERE revoked_at IS NULL`.

- [ ] Task 2: Active sessions view (AC: #2)
  - [ ] 2.1 Create `apps/web/app/(workspace)/settings/sessions/page.tsx` — Server Component: lists active sessions from `user_devices` (Story 1.3a) for all workspace members. Owner-only. **`service_role` note:** queries `user_devices` across users, requiring service_role to bypass RLS. Explicitly allowed for Owner-only admin function. Add `// service_role: allowed — owner-only cross-user device visibility` comment. Cards on mobile, table on desktop.
  - [ ] 2.2 Create `apps/web/app/(workspace)/settings/sessions/actions/revoke-session.ts` — Server Action: Owner-only; revoke specific device via `invalidateUserSessions()`. Log `session_revoked_by_owner` audit event. Call `revalidateTag('workspace-sessions:' + workspaceId)`. Zod schema: `revokeSessionSchema` (add to `packages/types/src/workspace.ts`).

- [ ] Task 3: Team management UI (AC: #4, #5, #6, #7)
  - [ ] 3.1 Create `apps/web/app/(workspace)/settings/team/page.tsx` — Server Component: loads member list + pending invitations. Role-based rendering:
    - **Owner**: member list, invite button, role dropdown, revoke button, client scoping link, pending invitations section, initiate transfer button
    - **Admin**: member list (read), invite Members button, client scoping for Members, no role changes, no ownership
    - **Member**: "Your Workspace" info card (workspace name + their role), link to scoped clients. NOT a member list (seeing only yourself is confusing).
    - **ClientUser**: middleware blocks access to settings routes
  - [ ] 3.2 Create `apps/web/app/(workspace)/settings/team/components/team-member-list.tsx` — Client Component. Optimistic updates for role changes, revocations. Card layout on mobile (< 768px), table on desktop. `"use client"`.
  - [ ] 3.3 Create `apps/web/app/(workspace)/settings/team/components/invite-form.tsx` — Client Component. Email input, role select (Admin → 'member' only; Owner → 'admin' | 'member'), optional expiry date picker (max 1 year), submit with spinner + "Sending...". Validates self-invitation client-side. `"use client"`.
  - [ ] 3.4 Create `apps/web/app/(workspace)/settings/team/components/pending-invitations-list.tsx` — Client Component. Pending invitations: email, role, sent date, expiry, resend button (new token), revoke button. Empty: "No pending invitations." `"use client"`.
  - [ ] 3.5 Create `apps/web/app/(workspace)/settings/team/components/client-scoping-dialog.tsx` — Client Component. Checkbox list of clients for a Member. Search/filter for many clients. Owner/Admin only. `"use client"`.
  - [ ] 3.6 Import `confirm-revoke-dialog.tsx` and `confirm-transfer-dialog.tsx` from 1.4b (they are owned by 1.4b; this story imports them into the team page layout).
  - [ ] 3.7 Error/loading/empty states:
    - **Loading**: skeleton member list (don't flash empty state)
    - **Error**: toast notifications per action (see error message table)
    - **Empty (1 member, just Owner)**: "[Workspace Name] — it's just you right now!" + prominent invite button
    - **Empty (0 pending)**: "No pending invitations."
    - **Empty (0 sessions)**: "No other active sessions right now. You have [N] team members."
  - [ ] 3.8 Accessibility:
    - ARIA labels: `aria-label="Change role for [member name]"`, `aria-label="Remove [member name] from workspace"`, `aria-label="Role: [role]"`
    - Keyboard: Tab through member list, Escape closes dialogs, arrow keys in role select
    - Focus management: after revoke → focus member list; after invite → focus invite form (cleared); after dialog close → focus trigger element

- [ ] Task 4: Audit logging (AC: #3)
  - [ ] 4.1 Extend `apps/web/lib/auth-audit.ts` — import typed events from `@flow/types/workspace-audit` (created in 1.4a). Ensure all 10 event types are logged by their respective Server Actions (most wired in 1.4b; verify and add any missing). Events: `workspace_created`, `member_invited`, `member_role_changed`, `member_revoked`, `member_expired`, `ownership_transferred`, `client_access_granted`, `client_access_revoked`, `session_revoked_by_owner`, `transfer_initiated`.

- [ ] Task 5: Tests (AC: #8, #9)
  - [ ] 5.1 `apps/web/__tests__/workspace-rbac.test.ts` — role-based access control: Owner can do everything; Admin can invite/revoke Members, scope clients, view sessions; Member cannot manage team, sees only scoped clients; ClientUser cannot access workspace settings routes; cross-workspace leakage: user in Workspace X cannot see Workspace Y's members/clients. Server Actions tested at API level.
  - [ ] 5.2 `apps/web/__tests__/workspace-audit.test.ts` — all 10 audit events logged with correct fields and typed metadata shapes. Verify discriminated union type safety.
  - [ ] 5.3 `apps/web/__tests__/workspace-client-scoping.test.ts` — grant/revoke client access; Member sees only scoped clients; Owner/Admin see all; revocation soft-deletes (sets `revoked_at`); audit events logged.
  - [ ] 5.4 `supabase/tests/rls_workspaces.sql` — **full RLS test matrix**: 5 tables (`workspaces`, `workspace_members`, `workspace_invitations`, `member_client_access`, `transfer_requests`) × 5 roles (Owner, Admin, Member, ClientUser, Outsider) × 4 operations (SELECT, INSERT, UPDATE, DELETE) = 100+ test cases. Each test in `BEGIN ... ROLLBACK`. Includes:
    - Outsider access denial (authenticated non-member)
    - Cross-workspace data leakage prevention
    - `::text` cast regression test for every policy (test fails without cast)
    - Expired member access denial
    - Revoked member access denial
    - Admin cannot manage Admins
    - Member cannot see other members' client scopes
  - [ ] 5.5 Verify all test files from 1.4b pass alongside new tests. Run full suite 3 times — zero flakes.

- [ ] Task 6: Final verification
  - [ ] 6.1 `pnpm build` — all packages + apps/web build
  - [ ] 6.2 `pnpm test` — all existing + 1.4a + 1.4b + 1.4c tests pass
  - [ ] 6.3 `pnpm lint` — zero errors
  - [ ] 6.4 `pnpm typecheck` — zero errors

## Dev Notes

### What This Story Completes

This is the **integration and UI story** for workspace management. It builds the user-facing components and comprehensive test coverage on top of the schema (1.4a) and business logic (1.4b).

### Key Decisions

1. **Member UI is "Your Workspace" card, not member list** — seeing only yourself in a list is confusing; show workspace context instead
2. **Card layout on mobile** — member table becomes cards; role changes become bottom sheets; invite form becomes full-screen modal
3. **`service_role` for sessions page** — explicitly allowed for Owner-only cross-user device visibility; documented with ESLint allowlist comment
4. **Soft-delete for client scoping revocation** — `revoked_at` timestamp, not hard delete; preserves audit trail

### Role-Based UI Matrix

| Feature | Owner | Admin | Member | ClientUser |
|---|---|---|---|---|
| View member list | Full | Full | Own info only | Blocked |
| Invite members | Admin + Member | Member only | No | Blocked |
| Change roles | Yes | No | No | Blocked |
| Revoke members | Anyone (not self) | Members only | No | Blocked |
| Transfer ownership | Initiate + confirm | No | No | Blocked |
| Scope client access | Yes | Yes (Members) | No | Blocked |
| View pending invitations | Yes | Yes (own invites) | No | Blocked |
| View active sessions | Yes | No | No | Blocked |
| See team page | Full management | Partial management | "Your Workspace" card | Blocked (middleware) |

### Error Messages

| Scenario | Message |
|---|---|
| Network failure | "Couldn't complete the action. Please try again." |
| Revocation fails | "Couldn't remove [Name]. Please try again." |
| Role change fails | "Couldn't update role. No changes were made." |
| Insufficient permissions | "You don't have permission to perform this action." |
| Client scoping fails | "Couldn't update client access. Please try again." |

### Existing Files to Extend/Reuse

| File | Reuse |
|---|---|
| `packages/auth/server-admin.ts` | `invalidateUserSessions()` for session revoke |
| `packages/auth/device-trust.ts` | `revokeAllDevices()` |
| `apps/web/lib/auth-audit.ts` | Wire all 10 event types |
| `packages/types/src/workspace.ts` | Types from 1.4a |
| `packages/types/src/workspace-audit.ts` | Audit events from 1.4a |
| `packages/test-utils/src/fixtures/workspace.ts` | Fixtures from 1.4a |
| All Server Actions from 1.4b | Import and use in UI components |

### Architecture Compliance

- Server Actions in `apps/web/app/(workspace)/settings/{team,sessions}/actions/`
- `workspace_id` from JWT for all actions (standard)
- `revalidateTag()` with tags from `packages/db/src/cache-tags.ts`: `workspace-members:{id}`, `workspace-invitations:{id}`, `workspace-sessions:{id}`, `workspace-clients:{id}`
- `"use client"` only for: team-member-list, invite-form, pending-invitations-list, client-scoping-dialog, confirm-revoke-dialog, confirm-transfer-dialog
- 200-line file limit — decompose components if needed
- WCAG 2.1 AA: ARIA labels, keyboard nav, focus management

### Quality Gates

| Gate | Criteria | Blocking |
|---|---|---|
| RLS tests | 100+ cases, 5 roles × 5 tables, Outsider included | YES |
| `::text` cast regression | Every policy has test that fails without cast | YES |
| RBAC tests | All role × feature combinations covered | YES |
| Audit tests | All 10 events with typed metadata | YES |
| Cross-workspace leakage | User in WS-X cannot see WS-Y data | YES |
| Zod contracts | All schemas tested | YES |
| Flakiness | 3 consecutive runs, zero flakes | YES |
| Type coverage | `pnpm typecheck` passes | YES |

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
