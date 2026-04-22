# Story 1.5a: Email Change with Session Invalidation

Status: backlog

**Prerequisite:** Story 1.4c must have its 25 unresolved patches resolved, specifically:
- `revoke-session` must correctly set `is_revoked = true`
- pgTAP `plan()` counts must match actual assertions
- This story depends on a working session revocation mechanism

## Story

As a user,
I want to change my email address with verification,
So that I can keep my account up-to-date if my email changes, and my account remains secure during the transition.

## Acceptance Criteria

1. **Given** a user is on `/settings/profile` **When** they enter a new email and submit **Then** `supabase.auth.updateUser({ email: newEmail })` is called, a verification magic link is sent to the new address, and the user sees: "We've sent a verification link to {new_email}. Please check your inbox."
2. **Given** a user requests an email change **When** the new email is already registered to another `auth.users` account **Then** Supabase Auth returns an error and the Server Action returns `{ success: false, error: FlowError }` with message: "This email is already associated with an account."
3. **Given** a user requests an email change **When** they have made 5 or more change attempts in the last hour **Then** the Server Action returns `{ success: false, error: FlowError }` with message: "Too many email change attempts. Please try again later." — rate limiting is enforced in the Server Action via a DB-backed counter in `email_change_requests` table
4. **Given** a user clicks the verification magic link **When** Supabase Auth processes the callback **Then** the auth callback route handler at `/auth/callback` detects the email change type, updates `public.users.email` to match the new `auth.users.email`, and redirects to `/settings/profile?email_verified=true`
5. **Given** the email change is verified **When** `public.users.email` is updated **Then** `invalidateUserSessions(userId)` is called to revoke all active sessions, the user is immediately redirected to `/login`, and they must authenticate with the new email
6. **Given** the email change verification callback **When** updating `public.users.email` fails after `auth.users.email` already changed **Then** the callback logs the error, redirects to `/settings/profile?email_error=true`, and a reconciliation mechanism (cron job checking for auth.users vs public.users email mismatches) corrects it within 5 minutes
7. **Given** a user has a pending email change **When** they view `/settings/profile` **Then** they see a banner: "Email change pending verification. Check {new_email} for a verification link." with a "Cancel change" button
8. **Given** a user cancels a pending email change **When** they click "Cancel change" **Then** the pending change is discarded and the banner disappears

## Tasks / Subtasks

- [ ] Task 1: Rate limiting infrastructure (AC: #3)
  - [ ] 1.1 Create migration: `email_change_requests` table — `id`, `user_id` (uuid, FK to users), `new_email` (text), `created_at` (timestamptz), `status` (text: 'pending' | 'verified' | 'cancelled')
  - [ ] 1.2 Create `packages/db/src/queries/email-change-requests/check-rate-limit.ts` — count rows for user in last hour, return `{ allowed: boolean, remaining: number }`
  - [ ] 1.3 Create `packages/db/src/queries/email-change-requests/create-request.ts` — insert new request row
  - [ ] 1.4 Create `packages/db/src/queries/email-change-requests/index.ts` — barrel

- [ ] Task 2: Email change Server Action (AC: #1, #2, #3)
  - [ ] 2.1 Create `apps/web/app/(workspace)/settings/profile/actions/change-email.ts`:
    ```
    'use server'
    → Zod validate { email: z.string().email() }
    → requireTenantContext() → get userId + current email
    → checkRateLimit(userId) → if !allowed, return rate limit error
    → supabase.auth.updateUser({ email: newEmail })
    → If Supabase returns email-in-use error → return { success: false, error: ... }
    → createRequest(userId, newEmail)
    → revalidateTag(cacheTag('user', userId))
    → return ActionResult<{ message: "Verification link sent to {newEmail}" }>
    ```

- [ ] Task 3: Auth callback email change handling (AC: #4, #5, #6)
  - [ ] 3.1 Extend existing `/auth/callback` route handler (from Story 1.3) to detect email change type in the Supabase auth callback
  - [ ] 3.2 On email change verified:
    ```
    → Get userId and newEmail from auth callback
    → Update public.users.email = newEmail WHERE id = userId
    → Mark email_change_requests row as 'verified'
    → invalidateUserSessions(userId) from @flow/auth
    → Redirect to /login (not /settings — sessions are gone)
    ```
  - [ ] 3.3 Error recovery: wrap `public.users` update in try/catch. On failure:
    ```
    → Log error to console + observability
    → Redirect to /settings/profile?email_error=true
    → The reconciliation cron (Task 5) will fix the mismatch
    ```

- [ ] Task 4: Pending email change UI (AC: #7, #8)
  - [ ] 4.1 Create `EmailChangeForm.tsx` — `"use client"` with `useActionState`, input for new email, submit button
  - [ ] 4.2 Create `EmailChangePendingBanner.tsx` — `"use client"` shows pending email from `email_change_requests` table, "Cancel change" button
  - [ ] 4.3 Create `apps/web/app/(workspace)/settings/profile/actions/cancel-email-change.ts`:
    ```
    'use server'
    → requireTenantContext()
    → Update email_change_requests set status = 'cancelled' WHERE user_id AND status = 'pending'
    → revalidateTag(cacheTag('user', userId))
    → return ActionResult<void>
    ```
  - [ ] 4.4 Add success/error toast handling for `?email_verified=true` and `?email_error=true` query params on profile page

- [ ] Task 5: Email reconciliation cron (AC: #6)
  - [ ] 5.1 Create `packages/jobs/src/reconcile-emails.ts` — pg-boss scheduled job (runs every 5 minutes):
    ```
    → Query: SELECT u.id, u.email as public_email, au.email as auth_email
      FROM users u JOIN auth.users au ON u.id = au.id
      WHERE u.email != au.email
    → For each mismatch: UPDATE users SET email = au.email WHERE id = u.id
    → Log reconciliation count
    ```
  - [ ] 5.2 Register job in pg-boss scheduler with 5-minute repeat interval

- [ ] Task 6: Tests (AC: all)
  - [ ] 6.1 Unit tests: Zod `changeEmailSchema` — valid email, invalid format, empty string
  - [ ] 6.2 Integration tests: `change-email` Server Action — happy path (Supabase updateUser called, request row created, rate limit counter increments), email already in use (Supabase error → FlowError), rate limited (6th request in hour → error), no auth → 401
  - [ ] 6.3 Integration tests: `cancel-email-change` Server Action — cancels pending request, no pending request → success anyway (idempotent), no auth → 401
  - [ ] 6.4 Integration tests: Auth callback email change handler — successful email change (public.users.email updated, sessions invalidated, redirect to /login), public.users update fails (redirect to profile with error, reconciliation job fixes it)
  - [ ] 6.5 Integration tests: Rate limit — 5 requests succeed, 6th fails, after 1 hour window passes → succeeds again (use FakeTimers)
  - [ ] 6.6 Integration tests: Reconciliation job — creates mismatch (auth.email ≠ public.email), runs job, verifies public.email corrected
  - [ ] 6.7 Client component tests: `EmailChangeForm` (renders, submits valid email, shows error on invalid), `EmailChangePendingBanner` (shows pending email, cancel button works) with `renderWithTheme`

## Dev Notes

### Session Invalidation Architecture (AC #5)

**Mechanism:** Direct call to `invalidateUserSessions(userId)` in the auth callback handler.

- `invalidateUserSessions()` is from `packages/auth/src/server-admin.ts` (established in Story 1.3a)
- This function uses the `service_role` key (acceptable in auth callback / server-only context)
- It marks all sessions for the user as revoked
- The redirect to `/login` is immediate — no polling, no async delay
- **The "60 seconds" SLA from the original AC is removed.** The invalidation is synchronous in the callback handler. The user is redirected to login immediately. There is no window where the old session works after the callback completes.

**Why this works:**
1. User clicks verification link in new email
2. Supabase Auth processes the email change in `auth.users`
3. Our `/auth/callback` handler fires
4. We update `public.users.email`
5. We call `invalidateUserSessions(userId)` — all sessions revoked NOW
6. We redirect to `/login`
7. User must sign in with new email — old sessions are dead

**Prerequisite:** Story 1.4c's `revoke-session` bug must be fixed first. If `invalidateUserSessions()` doesn't actually revoke sessions, this entire flow is broken.

### Split-Brain Prevention (AC #6)

The risk: `auth.users.email` changes but `public.users.email` update fails.

**Primary defense:** Wrap the callback in a try/catch with the redirect-to-profile-with-error fallback.

**Secondary defense:** The reconciliation cron job runs every 5 minutes and fixes any `auth.users.email ≠ public.users.email` mismatches. This is a belt-and-suspenders approach — the cron should rarely fire, but it's there for resilience.

### Rate Limiting Design

- DB-backed, not Redis — keeps the dependency footprint small
- `email_change_requests` table serves dual purpose: rate limiting (count recent rows) and pending state tracking (status column)
- Rate limit window: 1 hour, max 5 attempts
- TTL: Old rows (>24 hours) can be cleaned up by the reconciliation job to prevent unbounded growth

### File Structure

```
apps/web/app/(workspace)/settings/profile/
├── actions/
│   └── change-email.ts               # "use server" — email change initiation
│   └── cancel-email-change.ts         # "use server" — cancel pending change
├── components/
│   ├── EmailChangeForm.tsx            # "use client" — email input + submit
│   └── EmailChangePendingBanner.tsx   # "use client" — pending state + cancel
└── __tests__/
    ├── change-email.test.ts
    └── cancel-email-change.test.ts

apps/web/app/auth/callback/            # Extended, not new
└── route.ts                           # Add email change branch to existing handler

packages/db/src/queries/email-change-requests/
├── check-rate-limit.ts
├── create-request.ts
├── cancel-request.ts
├── get-pending-request.ts
└── index.ts

packages/jobs/src/
└── reconcile-emails.ts                # pg-boss cron job

supabase/migrations/
└── YYYYMMDDHHMMSS_email_change_requests.sql
```

### Constraints & Guardrails

- All constraints from Story 1.5 apply
- `service_role` key used ONLY in auth callback handler and reconciliation job — never in user-facing Server Actions
- `change-email.ts` uses standard Supabase client (RLS-gated) — `supabase.auth.updateUser()` works with user's own session
- Rate limiting is enforced BEFORE calling `supabase.auth.updateUser()` — don't burn the Supabase Auth rate limit
- pgTAP: `plan()` count MUST match actual assertion count

### References

- [Source: _bmad-output/implementation-artifacts/1-3-magic-link-authentication.md] — auth callback patterns
- [Source: _bmad-output/implementation-artifacts/1-3a-device-trust-session-persistence.md] — session invalidation patterns
- [Source: _bmad-output/implementation-artifacts/1-4c-client-scoping-sessions-ui-audit.md] — session revocation (MUST be fixed first)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
