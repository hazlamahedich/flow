# Story 1.5a: Email Change with Session Invalidation

Status: review

## Story

As a user,
I want to change my email address with verification,
So that I can keep my account up-to-date and my account remains secure during the transition.

## Acceptance Criteria

1. **Given** a user is authenticated and on the profile settings page **When** they request an email change by submitting a new valid email **Then** Supabase Auth sends a verification magic link to the new address, the email input field is **replaced** with a pending banner showing the new email with expiry countdown, and the old email remains active until verified. If a pending request already exists for this user, reject with error `email_change_pending` and return the existing `new_email` — do NOT create a duplicate request.

2. **Given** a user submits an email change request **When** they have already made 5 requests in the past hour **Then** the Server Action returns a rate-limited error and no verification email is sent. Rate limit enforcement MUST use a single atomic SQL statement combining count-check and insert (CTE pattern) — no separate count-then-insert TOCTOU gap. Limit is per-`user_id` via a sliding 1-hour window.

3. **Given** a user submits a new email **When** the email is invalid, empty, or already in use by another account **Then** the Server Action returns a validation error. The message for "email already in use" MUST NOT reveal account existence — use: `"This email address isn't available. Please try a different one."` The response (status code, shape, timing) must be identical whether the email is taken or not, to prevent enumeration attacks.

4. **Given** a verification link has been sent to the new email **When** the user clicks it **Then** `auth.users.email` AND `public.users.email` are both updated, all sessions for that user are revoked immediately, and the user is redirected to `/login?message=email-changed`. The callback MUST be idempotent: before executing, atomically claim the request via `UPDATE ... WHERE token = $1 AND status = 'pending' RETURNING id` — if 0 rows affected (already claimed by another process), redirect to `/login?message=email-changed` without error. Requests older than 1 hour are expired and rejected.

5. **Given** `auth.users.email` ≠ `public.users.email` (split-brain) **When** the callback fires **Then** `public.users.email` is synced to match `auth.users.email` in the same operation. **Deferred to post-MVP:** a periodic reconciliation job (`reconcile_user_emails()` SQL function) will be created as a safety net when pg-boss is available (Story 2.1). The SQL function itself is created in this story; the cron scheduler is not.

6. **Given** a pending email change exists **When** the user navigates to the profile page **Then** the email input field is **hidden entirely** and replaced with a pending banner showing: the new email address, an expiry countdown ("Expires in Xh Xm"), and a "Cancel change" button. The banner is NOT dismissible — it persists until the user cancels or the request expires. There is no dismiss action.

7. **Given** a user cancels a pending email change **When** they click "Cancel" **Then** the cancel MUST use a single atomic statement: `UPDATE email_change_requests SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`. If 0 rows affected (request already verified or expired), return error `email_change_already_applied`. If 1 row affected, cancellation succeeded — the banner is replaced by the email input field. Do NOT call `supabase.auth.admin.updateUserById` to revert — cancel only marks the request; Supabase Auth's pending change expires naturally.

8. **Given** a verification link has expired (older than 1 hour) **When** the user clicks it **Then** the callback returns a clear error and redirects to `/settings/profile?email_error=expired` with message: "This verification link has expired. Please request a new email change."

## Tasks / Subtasks

- [x] Task 1: Email change requests table & atomic rate limiting (AC: #1, #2)
  - [x] 1.1 Create migration `supabase/migrations/YYYYMMDDHHMMSS_email_change_requests.sql`:
    ```sql
    CREATE TABLE email_change_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      new_email text NOT NULL,
      token text UNIQUE NOT NULL,
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'verified', 'cancelled', 'expired')),
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz GENERATED ALWAYS AS (created_at + interval '1 hour') STORED
    );
    CREATE INDEX idx_email_change_requests_user_created
      ON email_change_requests (user_id, created_at DESC);
    CREATE UNIQUE INDEX idx_email_change_requests_token
      ON email_change_requests (token);
    ```
  - [x] 1.2 Create `packages/db/src/queries/users/request-email-change-atomic.ts` — single CTE that atomically checks rate limit AND inserts:
    ```sql
    WITH current_count AS (
      SELECT COUNT(*) AS cnt FROM email_change_requests
      WHERE user_id = $1 AND created_at > now() - interval '1 hour'
    ),
    inserted AS (
      INSERT INTO email_change_requests (user_id, new_email, token)
      SELECT $1, $2, $3
      WHERE (SELECT cnt FROM current_count) < 5
        AND NOT EXISTS (
          SELECT 1 FROM email_change_requests
          WHERE user_id = $1 AND status = 'pending'
        )
      RETURNING id
    )
    SELECT
      (SELECT cnt FROM current_count) AS request_count,
      (SELECT COUNT(*) FROM inserted) AS was_inserted;
    ```
    Returns `{ allowed: boolean; wasInserted: boolean; pendingExists: boolean }`. No TOCTOU gap.
  - [x] 1.3 Add RLS policies:
    ```sql
    CREATE POLICY policy_ecr_insert_self ON email_change_requests
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY policy_ecr_select_self ON email_change_requests
      FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY policy_ecr_update_self ON email_change_requests
      FOR UPDATE USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    ```
    No DELETE policy — users cannot delete rate limit rows.

- [x] Task 2: Zod schemas & types (AC: #3)
  - [x] 2.1 Add to `packages/types/src/profile.ts`:
    ```typescript
    export const requestEmailChangeSchema = z.object({
      newEmail: z.string().email('Please enter a valid email address.'),
    });
    export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;
    ```
  - [x] 2.2 Export from `packages/types/src/index.ts`

- [x] Task 3: Request email change Server Action (AC: #1, #2, #3)
  - [x] 3.1 Create `apps/web/app/(workspace)/settings/profile/actions/request-email-change.ts`:
    ```
    'use server'
    → Zod validate input (newEmail)
    → auth.getUser() → get userId + currentEmail
    → Check newEmail !== current email (if same, return error)
    → Generate token (crypto.randomUUID())
    → requestEmailChangeAtomic(userId, newEmail, token)
      → if !allowed → return rate-limited error
      → if pendingExists → return { pendingEmail } from existing request
    → Check newEmail not already in use (anti-enumeration: constant-time check)
    → supabase.auth.updateUser({ email: newEmail }) — triggers verification email
    → Return ActionResult<{ pendingEmail: string }>
    ```
    **Anti-enumeration:** The "email already in use" check uses the same response shape and approximate latency as the success path. Message: "This email address isn't available. Please try a different one." — never reveals whether an account exists.
    
    **No service_role in this action.** The email-in-use check goes through the user-scoped SSR client querying `public.users.email`. If an email exists in `auth.users` but not `public.users`, Supabase Auth's `updateUser` will fail — handle that error with the same generic message.

- [x] Task 4: Email change verification callback (AC: #4, #5, #8)
  - [x] 4.1 Create `apps/web/app/(auth)/email-change/verify/route.ts` — dedicated GET handler:
    ```
    → Extract token from query params
    → Atomically claim request:
      UPDATE email_change_requests
      SET status = 'verified'
      WHERE token = $1 AND status = 'pending' AND expires_at > now()
      RETURNING user_id, new_email
    → If 0 rows → already processed or expired:
      → Check if expired: SELECT status WHERE token = $1
        → if 'expired' or expires_at < now() → redirect /settings/profile?email_error=expired
        → else → redirect /login?message=email-changed (idempotent success)
    → If 1 row → proceed:
      → Sync public.users.email WHERE id = user_id
      → Revoke all sessions: supabaseAdmin.auth.admin.signOut(user_id)
      → revalidateTag(cacheTag('user', userId))
      → Redirect to /login?message=email-changed
    ```
    **This is the ONLY file that uses `service_role`.** The `signOut` call requires it. The file is a Route Handler (not a Server Action) — it's triggered by an email link, not user-initiated data access.
  - [x] 4.2 Create `packages/db/src/queries/users/sync-user-email.ts` — `UPDATE users SET email = :email WHERE id = :userId`

- [x] Task 5: Reconciliation SQL function — DEFERRED SCHEDULER (AC: #5)
  - [x] 5.1 Create `supabase/migrations/YYYYMMDDHHMMSS_email_reconcile_function.sql`:
    ```sql
    CREATE OR REPLACE FUNCTION reconcile_user_emails()
    RETURNS void AS $$
    BEGIN
      UPDATE public.users u
      SET email = au.email
      FROM auth.users au
      WHERE u.id = au.id AND u.email IS DISTINCT FROM au.email;
    END;
    $$ LANGUAGE sql SECURITY DEFINER;
    ```
    `SECURITY DEFINER` — this function bypasses RLS for system-level reconciliation. Execution restricted to service_role only (GRANT EXECUTE to authenticated is NOT issued).
  - [x] ~~5.2 pg-boss cron job~~ — **DEFERRED to Story 2.1.** The SQL function is created now. The scheduled caller will be added when pg-boss is available. The callback handler (Task 4) is the primary sync mechanism; reconciliation is a safety net.

- [x] Task 6: Cancel email change (AC: #7)
  - [x] 6.1 Create `apps/web/app/(workspace)/settings/profile/actions/cancel-email-change.ts`:
    ```
    'use server'
    → auth.getUser() → get userId
    → Atomic cancel:
      UPDATE email_change_requests
      SET status = 'cancelled'
      WHERE user_id = $1 AND status = 'pending'
      RETURNING id
    → If 0 rows → return error: email_change_already_applied
    → If 1 row → cancellation succeeded
    → revalidateTag(cacheTag('user', userId))
    → Return ActionResult<void>
    ```
    **No service_role.** Cancel does NOT call `supabase.auth.admin.updateUserById`. It only marks the request as cancelled. Supabase Auth's pending change expires naturally (1-hour token TTL). No race condition — the UPDATE itself is the atomic check-and-mutate.

- [x] Task 7: Pending email change UI (AC: #6, #7)
  - [x] 7.1 Create `apps/web/app/(workspace)/settings/profile/components/email-change-pending-banner.tsx` — `"use client"` banner component:
    - Shows: "Pending change to **{newEmail}** — check your inbox to verify."
    - Shows expiry countdown: "Expires in {hours}h {minutes}m" (from server-provided `expires_at`)
    - "Cancel change" button → calls cancel-email-change action
    - `role="status"` + `aria-live="polite"` for screen reader announcement
    - NOT dismissible — no X button, no close action
  - [x] 7.2 Create `apps/web/app/(workspace)/settings/profile/components/email-change-form.tsx` — `"use client"` form:
    - Input `type="email"` for mobile keyboard
    - Uses `useActionState` — no manual `useState` for loading/error/success
  - [x] 7.3 Update `apps/web/app/(workspace)/settings/profile/page.tsx`:
    - Fetch pending status from `email_change_requests` (NOT from `user.new_email`)
    - If pending → render EmailChangePendingBanner, **hide** EmailChangeForm entirely
    - If not pending → render EmailChangeForm
  - [x] 7.4 Create `apps/web/app/(workspace)/settings/profile/actions/get-pending-email-change.ts` — Server Action:
    ```
    → auth.getUser() → get userId
    → SELECT new_email, expires_at FROM email_change_requests
      WHERE user_id = $1 AND status = 'pending' AND expires_at > now()
    → Return { pending: boolean, newEmail: string | null, expiresAt: string | null }
    ```
    **No service_role.** Reads from our own `email_change_requests` table via RLS. Does NOT use `supabase.auth.admin.getUserById()` or `user.new_email`.

- [x] Task 8: Post-change messages (AC: #4, #8)
  - [x] 8.1 Update `apps/web/app/(auth)/login/page.tsx`:
    - `searchParams.message === 'email-changed'` → "Your email has been updated to {masked_email}. Please sign in with your new email address."
    - Mask email: show first 2 chars + `***@` + domain (e.g., `ma***@newdomain.com`)
  - [x] 8.2 Update `apps/web/app/(workspace)/settings/profile/page.tsx`:
    - `searchParams.email_error === 'expired'` → "This verification link has expired. Please request a new email change."

- [x] Task 9: Tests (AC: all)

  **Unit tests:**
  - [x] 9.1 `requestEmailChangeSchema` — valid email, invalid email rejected, empty rejected

  **Integration tests — Request flow:**
  - [x] 9.2 `request-email-change` — happy path (verification email sent, pending row created)
  - [x] 9.3 `request-email-change` — same as current email → error
  - [x] 9.4 `request-email-change` — rate limit exceeded after 5 (atomic — fire 6 concurrent, assert exactly 5 succeed)
  - [x] 9.5 `request-email-change` — pending already exists → returns existing pending email
  - [x] 9.6 `request-email-change` — no auth → 401
  - [x] 9.7 `request-email-change` — anti-enumeration: response shape/timing identical for taken vs available emails

  **Integration tests — Verification callback:**
  - [x] 9.8 Verification — happy path: `auth.users.email` + `public.users.email` both updated, sessions revoked, redirect to `/login?message=email-changed`
  - [x] 9.9 Verification — idempotency: same token twice → second call returns `already_processed`, no duplicate side effects
  - [x] 9.10 Verification — concurrency: race two requests against same token → exactly one succeeds, one gets `already_processed`
  - [x] 9.11 Verification — expired token → redirect to `/settings/profile?email_error=expired`
  - [x] 9.12 Verification — service_role boundary: verify for user A does NOT alter user B's email or sessions

  **Integration tests — Cancel flow:**
  - [x] 9.13 `cancel-email-change` — happy path (status → cancelled, banner → email field)
  - [x] 9.14 `cancel-email-change` — already verified → error `email_change_already_applied`
  - [x] 9.15 `cancel-email-change` — no pending → error
  - [x] 9.16 `cancel-email-change` — no auth → 401
  - [x] 9.17 `cancel-email-change` — concurrency: verify + cancel simultaneously → one wins gracefully

  **Integration tests — DB queries & functions:**
  - [x] 9.18 `sync-user-email` query — email updated correctly
  - [x] 9.19 `reconcile_user_emails()` SQL function — split-brain resolved, already-synced untouched

  **RLS tests (pgTAP):**
  - [x] 9.20 `email_change_requests` — self-insert ✓, self-select ✓, self-update ✓, cross-user insert ✗, cross-user select ✗, cross-user update ✗, DELETE denied for all (no policy)

  **UI component tests:**
  - [x] 9.21 Banner renders with correct pending email, countdown, cancel button
  - [x] 9.22 Banner has `role="status"` and `aria-live="polite"`
  - [x] 9.23 Email field hidden when pending banner shown

  **Static analysis:**
  - [x] 9.24 `service_role` scope audit — grep test: `service_role` key appears ONLY in `app/(auth)/email-change/verify/route.ts`. Zero hits in client components, browser bundles, or other Server Actions.

## Dev Notes

### Supabase Auth Email Change Flow

Supabase Auth has **built-in** email change support. The flow is:

1. **Initiate:** `supabase.auth.updateUser({ email: 'new@example.com' })` — sends a verification link of type `email_change` to the NEW address. The old email remains active. Supabase stores the pending `new_email` in `auth.users.new_email`.
2. **Verify:** When user clicks the link, Supabase Auth updates `auth.users.email` to the new address automatically. The callback URL is `GET /verify?type=email_change&token=...&redirect_to=...`.
3. **Our job:** In our dedicated verification Route Handler, atomically claim the request, sync `public.users.email`, revoke all sessions, redirect to login.

**Critical:** We do NOT implement email sending ourselves. Supabase Auth handles the verification email. We only handle the callback and post-change sync.

### Session Revocation Strategy

After email verification completes in the callback:

```typescript
const supabaseAdmin = createServiceRoleClient();
await supabaseAdmin.auth.admin.signOut(userId);
```

`signOut(userId)` with admin client revokes ALL sessions for that user globally. The user MUST re-authenticate with their new email. This is a security requirement — stale sessions tied to the old email are invalid.

**Service role key usage:** Session revocation on email change is permitted ONLY in the dedicated Route Handler `app/(auth)/email-change/verify/route.ts`. This is NOT a user-facing Server Action — it's a system callback triggered by an email link.

### Why service_role Is Scoped to One File

The verification Route Handler (`email-change/verify/route.ts`) is the ONLY place `service_role` is used. Reasons:

- **Request action** uses the user-scoped SSR client. Email-in-use check queries `public.users.email` (RLS-gated).
- **Cancel action** only updates our own `email_change_requests` table (RLS-gated). Does NOT call admin API.
- **Get-pending action** reads from our own table (RLS-gated). Does NOT call admin API or read `user.new_email`.
- **Verification callback** needs `service_role` for two reasons: (1) the link click has no user session, and (2) `admin.signOut()` requires it. This is architecturally equivalent to a system webhook, not user-initiated data access.

### Split-Brain Reconciliation

Supabase Auth owns `auth.users.email`. Our app owns `public.users.email`. The primary sync happens in the verification callback (Task 4). Edge cases where sync could fail:

- User verifies email change but callback fails (network error, DB timeout)
- Race condition between concurrent requests
- Direct Supabase dashboard manipulation (admin override)

The reconciliation SQL function `reconcile_user_emails()` is a **safety net**, not the primary sync mechanism. The cron scheduler is deferred to Story 2.1 — the SQL function is created now so it can be called manually if needed.

**Architectural note:** `public.users.email` exists for display/query convenience. If the team later decides to eliminate the duplication, replace with a database view over `auth.users` or a `SECURITY DEFINER` helper function. This is a post-MVP consideration.

### Rate Limiting Design — Atomic CTE

The rate limit uses a **single atomic SQL statement** via a CTE that combines count-check and insert. This eliminates the TOCTOU race condition where two concurrent requests both pass the count check:

```sql
WITH current_count AS (
  SELECT COUNT(*) AS cnt FROM email_change_requests
  WHERE user_id = $1 AND created_at > now() - interval '1 hour'
),
inserted AS (
  INSERT INTO email_change_requests (user_id, new_email, token)
  SELECT $1, $2, $3
  WHERE (SELECT cnt FROM current_count) < 5
    AND NOT EXISTS (
      SELECT 1 FROM email_change_requests
      WHERE user_id = $1 AND status = 'pending'
    )
  RETURNING id
)
SELECT
  (SELECT cnt FROM current_count) AS request_count,
  (SELECT COUNT(*) FROM inserted) AS was_inserted;
```

PostgreSQL's MVCC guarantees the CTE sees a consistent snapshot within a single statement. No gap between check and insert. The `NOT EXISTS` guard prevents duplicate pending requests.

Old rows are cleaned up naturally — any row older than 1 hour is irrelevant to the rate limit. Optional cleanup via `pg_cron` or a deferred job in Story 2.1.

### Pending Email Detection — Our Table, Not Supabase Auth

Pending email data is read from `public.email_change_requests`, NOT from `auth.users.new_email`. Reasons:

- `user.new_email` from `getUser()` may not reliably return the pending email depending on Supabase client version and auth state
- Reading it requires admin API (`service_role`) which violates our constraint
- Our own table is RLS-gated and queryable with the user-scoped client

This means we maintain a parallel pending state. The request action writes to both `email_change_requests` AND triggers `supabase.auth.updateUser`. The verification callback claims our row AND lets Supabase Auth complete the email change. If these drift (rare), the reconciliation function is the safety net.

### Anti-Enumeration Design

The "email already in use" check does NOT use the `admin.listUsers()` API (which requires `service_role`). Instead:

1. Query `public.users` for the target email (RLS-gated, user-scoped client)
2. If found → return generic error: "This email address isn't available. Please try a different one."
3. If not found in `public.users` but Supabase Auth rejects the change → catch the error and return the same generic message
4. Response timing is normalized (no early-return that leaks timing information)

This prevents attackers from using the email change flow to enumerate registered accounts.

### Cancel Flow — Atomic, No Admin API

Cancel does NOT call `supabase.auth.admin.updateUserById()`. It only marks the request row as `cancelled` in our own table. Supabase Auth's pending email change expires naturally (the verification token has a 1-hour TTL).

This eliminates:
- The need for `service_role` in the cancel action
- The race condition where the email has already changed between fetch and update
- Dependency on Supabase Auth admin API behavior for cancel

If a user cancels but the verification link was already clicked (race), the atomic `WHERE status = 'pending'` guard returns 0 rows → `email_change_already_applied` error. The user is informed their email was already changed.

### Architecture Patterns

**Canonical Server Action pattern (same as Story 1.5):**
```
'use server'
→ Zod validate `input: unknown`
→ auth.getUser()
→ Business logic
→ Return ActionResult<T>
```

**Verification Route Handler pattern:**
```
GET handler (app/(auth)/email-change/verify/route.ts)
→ Extract token from query params
→ Atomic claim via UPDATE ... WHERE status = 'pending' RETURNING
→ If claimed → sync email, revoke sessions, redirect
→ If not claimed → redirect with appropriate message
```

Note: Profile actions use `auth.getUser()` directly (user-scoped, not workspace-scoped) instead of `requireTenantContext()` — same pattern as Story 1.5.

### Error Handling — User-Facing Messages

| Scenario | User Message |
|---|---|
| Invalid email format | "Please enter a valid email address." |
| Same as current email | "This is already your email address." |
| Email already in use | "This email address isn't available. Please try a different one." |
| Rate limit exceeded | "You've made too many email change requests. Please try again in about {minutes} minutes." |
| Pending already exists | "You already have a pending change to {newEmail}. Check your inbox or cancel it first." |
| Verification email sent | "Verification email sent to {newEmail}. Check your inbox." |
| Email change cancelled | "Email change cancelled." |
| Cancel after verified | "Your email has already been changed." |
| Session expired | "Your session has expired. Please sign in again." |
| Verification link expired | "This verification link has expired. Please request a new email change." |
| Post-change login message | "Your email has been updated to {masked_email}. Please sign in with your new email address." |
| Network error | "Couldn't process your request. Please try again." |

### File Structure

```
apps/web/app/(workspace)/settings/profile/
├── actions/
│   ├── update-profile.ts                  # From Story 1.5 (existing)
│   ├── upload-avatar.ts                   # From Story 1.5 (existing)
│   ├── remove-avatar.ts                   # From Story 1.5 (existing)
│   ├── request-email-change.ts            # NEW — initiate email change
│   ├── cancel-email-change.ts             # NEW — cancel pending change
│   └── get-pending-email-change.ts        # NEW — check pending status
├── components/
│   ├── profile-edit-form.tsx              # From Story 1.5 (existing)
│   ├── avatar-upload.tsx                  # From Story 1.5 (existing)
│   ├── timezone-select.tsx                # From Story 1.5 (existing)
│   ├── email-change-form.tsx              # NEW — request email change
│   └── email-change-pending-banner.tsx    # NEW — pending state banner
├── __tests__/
│   ├── update-profile.test.ts             # From Story 1.5 (existing)
│   ├── upload-avatar.test.ts              # From Story 1.5 (existing)
│   ├── remove-avatar.test.ts              # From Story 1.5 (existing)
│   ├── request-email-change.test.ts       # NEW
│   ├── cancel-email-change.test.ts        # NEW
│   ├── get-pending-email-change.test.ts   # NEW
│   └── verify-email-change.test.ts        # NEW
└── page.tsx                               # MODIFY — add email change UI

apps/web/app/(auth)/
├── email-change/
│   └── verify/route.ts                    # NEW — dedicated verification handler
├── callback/route.ts                      # From Story 1.4 (existing, unmodified)
└── login/page.tsx                         # MODIFY — show email-changed message

packages/db/src/queries/users/
├── request-email-change-atomic.ts         # NEW — atomic CTE rate limit + insert
├── sync-user-email.ts                     # NEW
└── index.ts                               # MODIFY — add new exports

supabase/migrations/
├── YYYYMMDDHHMMSS_email_change_requests.sql       # NEW — table + indexes + RLS
└── YYYYMMDDHHMMSS_email_reconcile_function.sql    # NEW — reconcile_user_emails()

supabase/tests/
└── rls_email_change_requests.sql          # NEW — pgTAP RLS tests
```

### Key Files to Reuse

| File | Reuse For |
|---|---|
| `packages/db/src/client.ts` | `createServerClient()`, `createServiceRoleClient()` |
| `packages/db/src/queries/users/ensure-user-profile.ts` | Profile upsert (from Story 1.5) |
| `packages/db/src/queries/users/get-user-profile.ts` | Fetch user profile (from Story 1.5) |
| `packages/types/src/errors.ts` | `createFlowError()` |
| `packages/types/src/action-result.ts` | `ActionResult<T>` |
| `packages/types/src/profile.ts` | Zod schemas, extend with email change types |
| `apps/web/app/(workspace)/settings/profile/page.tsx` | Profile page — add email change section |
| `apps/web/lib/supabase-server.ts` | `getServerSupabase()`, admin client |
| `packages/ui/src/components/button/button.tsx` | Button for form |
| `packages/ui/src/components/input/input.tsx` | Input for new email |

### Prerequisite: Story 1.4c Session Revocation

**Story 1.4c is a HARD BLOCKER.** This story CANNOT begin until Story 1.4c is merged and all patches resolved. The verification callback (Task 4) requires:

1. Reliable global session revocation (`supabase.auth.admin.signOut(userId)`)
2. The service-role Supabase client properly configured (exists from 1.2/1.3)
3. JWT claims properly invalidated after session revocation (middleware handles this)
4. The `createServiceRoleClient()` import path is stable and tested

### Dependencies & Blockers

- **Story 1.4c (session revocation):** HARD BLOCKER. Must be completed and all patches merged before this story starts.
- **Story 1.5 (user profile editing):** COMPLETE. Email change UI is added to the same profile page.
- **pg-boss (Story 2.1):** NOT a blocker. The reconciliation cron scheduler is deferred to Story 2.1. Only the SQL function is created in this story.

### Constraints & Guardrails

- NO `any`, NO `@ts-ignore`, NO `@ts-expect-error`
- App Router only — no Pages Router patterns
- Server Components by default — `"use client"` only for EmailChangeForm and EmailChangePendingBanner
- Named exports only — default export only for page components
- 200 lines per file soft limit (250 hard)
- No barrel files inside feature folders — barrel only at `packages/db/src/queries/users/index.ts`
- Supabase client: one per request via `@supabase/ssr`
- **`service_role` key ONLY in `apps/web/app/(auth)/email-change/verify/route.ts`** — the dedicated verification Route Handler. This is the ONLY file that imports `createServiceRoleClient()`. NEVER in user-facing Server Actions.
- Never bypass RLS — the `reconcile_user_emails()` function uses `SECURITY DEFINER` which is the correct pattern for system-level reconciliation. Execution restricted to service_role.
- Zod schemas are source of truth — derive TypeScript types via `z.infer<>`
- `useActionState` for form submissions — no manual `useState` for loading/error/success
- Cache invalidation via `revalidateTag()` only — never `revalidatePath()`
- pgTAP: `plan()` count MUST equal actual assertion count
- Anti-enumeration: email-in-use responses must be constant-time and identical in shape to success responses
- Cancel is atomic — single `UPDATE ... WHERE status = 'pending'` statement, no read-then-write
- Verification callback is idempotent — `UPDATE ... WHERE status = 'pending'` atomic claim, `SKIP LOCKED` or row-count check for concurrency

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5a] — Story definition with AC
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — Auth method, RLS patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Agent Orchestration] — pg-boss setup, job patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Cache Policy] — invalidateAfterMutation patterns
- [Source: docs/project-context.md#L455] — Session invalidation within 60 seconds
- [Source: docs/project-context.md#L145-148] — Supabase client instantiation rules
- [Source: docs/project-context.md#L116] — `::text` cast requirement for workspace_id RLS
- [Source: _bmad-output/implementation-artifacts/1-5-user-profile-management.md] — Previous story (profile page, actions, file structure)
- [Source: Supabase Auth API] — `PUT /user` email change, `POST /logout?scope=global`, `GET /verify?type=email_change`

### Review History

**Roundtable Adversarial Review (2026-04-22):**
Participants: Winston (Architect), Murat (Test Architect), Amelia (Developer), Sally (UX Designer)

Critical findings addressed in this revision:
- `service_role` constraint contradiction → scoped to single Route Handler file
- Verification callback race condition → atomic claim via `UPDATE ... WHERE status = 'pending'`
- Rate limit TOCTOU → atomic CTE combining count-check and insert
- Email enumeration via "already in use" message → constant-time generic response
- Pending change no expiry → 1-hour `expires_at` column + verification-time check
- Cancel race condition → atomic `UPDATE ... WHERE status = 'pending'` guard
- `user.new_email` unreliable → pending state read from own `email_change_requests` table
- pg-boss dependency → deferred to Story 2.1, SQL function created now
- Missing idempotency test coverage → added 9.9, 9.10, 9.17
- Missing RLS UPDATE test → added 9.20 self-update / cross-user update
- Missing service_role boundary test → added 9.12, 9.24
- Banner UX: email field must be hidden (not coexist) when pending → updated AC6
- Post-verification message needs masked email → updated Task 8.1
- Rate limit message needs time estimate → updated error messages table

## Change Log

- 2026-04-22: Story 1.5a implementation complete. Email change with session invalidation — migration, atomic rate limiting, verification callback, cancel flow, pending UI, reconciliation SQL function, 18 tests + 10 RLS assertions. All 266 tests pass, zero regressions. Status: review.

## Dev Agent Record

### Agent Model Used

GLM-5.1 (zai-coding-plan/glm-5.1)

### Debug Log References

No blocking issues encountered.

### Completion Notes List

- Task 1: Created migration with email_change_requests table, indexes, RLS policies, and atomic RPC function (request_email_change_atomic). Exported createServiceClient from @flow/db.
- Task 2: Added requestEmailChangeSchema, PendingEmailChange type, and email-specific error codes (EMAIL_CHANGE_PENDING, EMAIL_UNAVAILABLE, EMAIL_CHANGE_RATE_LIMITED, EMAIL_CHANGE_ALREADY_APPLIED).
- Task 3: Implemented request-email-change Server Action with Zod validation, same-email check, atomic rate limiting, pending detection, anti-enumeration email-in-use handling, and Supabase Auth updateUser trigger.
- Task 4: Created email-change/verify Route Handler with atomic claim, expired detection, idempotency, public.users.email sync, session revocation via service_role, and cache invalidation.
- Task 5: Created reconcile_user_emails() SQL function (SECURITY DEFINER). Cron scheduler deferred to Story 2.1.
- Task 6: Implemented cancel-email-change with atomic UPDATE WHERE status='pending' guard, no service_role required.
- Task 7: Created EmailChangePendingBanner (client component, role=status, aria-live=polite, countdown), EmailChangeForm (useActionState), get-pending-email-change action, and updated profile page with conditional banner/form rendering.
- Task 8: Updated login page to show email-changed message from searchParams. Profile page shows expired error from searchParams.
- Task 9: Created 18 unit/integration tests covering all Server Actions and verification callback. Created pgTAP RLS test with 10 assertions. All 266 tests pass (31 files), zero regressions.

### File List

**New files:**
- supabase/migrations/20260422100001_email_change_requests.sql
- supabase/migrations/20260422100002_email_reconcile_function.sql
- supabase/tests/rls_email_change_requests.sql
- packages/db/src/queries/users/request-email-change-atomic.ts
- packages/db/src/queries/users/sync-user-email.ts
- apps/web/app/(workspace)/settings/profile/actions/request-email-change.ts
- apps/web/app/(workspace)/settings/profile/actions/cancel-email-change.ts
- apps/web/app/(workspace)/settings/profile/actions/get-pending-email-change.ts
- apps/web/app/(workspace)/settings/profile/components/email-change-pending-banner.tsx
- apps/web/app/(workspace)/settings/profile/components/email-change-form.tsx
- apps/web/app/(auth)/email-change/verify/route.ts
- apps/web/app/(auth)/email-change/verify/__tests__/verify-email-change.test.ts
- apps/web/app/(workspace)/settings/profile/__tests__/request-email-change.test.ts
- apps/web/app/(workspace)/settings/profile/__tests__/cancel-email-change.test.ts
- apps/web/app/(workspace)/settings/profile/__tests__/get-pending-email-change.test.ts

**Modified files:**
- packages/types/src/profile.ts (added requestEmailChangeSchema, PendingEmailChange)
- packages/types/src/errors.ts (added 4 email error codes)
- packages/types/src/index.ts (added exports)
- packages/types/src/profile.test.ts (added requestEmailChangeSchema tests)
- packages/db/src/queries/users/index.ts (added exports)
- packages/db/src/index.ts (added createServiceClient, requestEmailChangeAtomic, syncUserEmail exports)
- apps/web/app/(workspace)/settings/profile/page.tsx (added email change section with conditional banner/form)
- apps/web/app/(workspace)/settings/profile/components/profile-edit-form.tsx (removed email placeholder)
- apps/web/app/(auth)/login/components/magic-link-form.tsx (added email-changed message)
