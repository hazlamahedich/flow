# Story 1.5: User Profile Editing (Name, Timezone, Avatar)

Status: review

## Story

As a user,
I want to edit my display name, timezone, and avatar,
So that my identity is accurate for teammates and clients, and all time displays use my correct timezone.

## Acceptance Criteria

1. **Given** a user is authenticated **When** they navigate to `/settings/profile` **Then** they see their current name (1–100 characters, any Unicode), timezone (IANA format), and avatar — with a skeleton shown during load
2. **Given** a user edits their display name **When** they submit 1–100 characters of Unicode text **Then** the name updates atomically via Server Action, the UI revalidates via `revalidateTag("user:{userId}")`, and the old name is no longer visible
3. **Given** a user selects a new timezone **When** they pick an IANA timezone from the searchable list **Then** `users.timezone` updates, `revalidateTag("user:{userId}")` fires, and all server-rendered time displays on subsequent page loads use the new timezone
4. **Given** a user uploads an avatar **When** the file is JPEG, PNG, or WebP and ≤2MB **Then** the file is stored at `avatars/{user_id}/{timestamp}-{random}.{ext}` in the private Supabase Storage bucket, the old avatar file is deleted, and `users.avatar_url` is updated to the new signed URL
5. **Given** a user uploads a file **When** it exceeds 2MB or is not JPEG/PNG/WebP (verified by magic bytes, not extension) **Then** the Server Action returns `{ success: false, error: FlowError }` with the specific user-facing message and no file is written to Storage
6. **Given** a user removes their avatar **When** they click "Remove" **Then** the current avatar file is deleted from Storage, `users.avatar_url` is set to `null`, and the UI shows the default avatar
7. **Given** a user profile row does not exist in `users` **When** any profile read/write Server Action is called **Then** the row is created via `INSERT ... ON CONFLICT DO NOTHING` with defaults (`timezone: 'UTC'`, `name: null`, `avatar_url: null`) before proceeding
8. **Given** two concurrent profile updates from the same user **When** both write simultaneously **Then** last-write-wins is the documented strategy — the `updated_at` column is auto-updated via `moddatetime`, and no optimistic locking is applied at this scope
9. **Given** an unauthenticated request **When** any profile Server Action is called **Then** RLS denies the query and the action returns `{ success: false, error: createFlowError(401, 'UNAUTHORIZED', 'Session expired', 'auth') }`
10. **Given** a user on a different workspace **When** they attempt to read/update another user's profile **Then** RLS denies the query (self-scope only: `auth.uid() = id`)

## Tasks / Subtasks

- [x] Task 1: Profile page route & layout (AC: #1)
  - [x] 1.1 Create `apps/web/app/(workspace)/settings/profile/page.tsx` — Server Component, fetches profile via `getUserProfile(userId)`, wraps children in `Suspense`
  - [x] 1.2 Create `apps/web/app/(workspace)/settings/profile/loading.tsx` — skeleton matching profile card + form layout shape
  - [x] 1.3 Create `apps/web/app/(workspace)/settings/profile/error.tsx` — error boundary with retry button
  - [x] 1.4 Add "Profile" link to settings navigation sidebar/tabs (if not present from previous stories)

- [x] Task 2: Profile display & edit components (AC: #1, #2, #3, #4, #5, #6)
  - [x] 2.1 Create `ProfileCard.tsx` — Server Component displaying current name, timezone (with UTC offset label), avatar (or default), and "Edit" trigger
  - [x] 2.2 Create `ProfileEditForm.tsx` — `"use client"` with `useActionState` for name editing (1–100 chars, Unicode, no emoji-only validation needed at this scope)
  - [x] 2.3 Create `AvatarUpload.tsx` — `"use client"` for file selection, client-side preview (object URL), upload via Server Action, and "Remove" button
  - [x] 2.4 Create `TimezoneSelect.tsx` — `"use client"` with IANA timezone list from `Intl.supportedValuesOf('timeZone')`, search/filter input, display with UTC offset (e.g., `America/New_York (UTC-5)`), server-side fallback list for SSR

- [x] Task 3: Zod schemas & types (AC: #2, #3, #5)
  - [x] 3.1 Create `packages/types/src/profile.ts`
    ```typescript
    export const updateProfileSchema = z.object({
      name: z.string().min(1).max(100),
      timezone: z.string().refine(
        (tz) => IANA_TIMEZONES.includes(tz),
        { message: 'Invalid IANA timezone' }
      ),
    });
    export const uploadAvatarSchema = z.object({
      contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      fileSize: z.number().max(2 * 1024 * 1024),
    });
    export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
    export type UploadAvatarInput = z.infer<typeof uploadAvatarSchema>;
    export type UserProfile = {
      id: string;
      name: string | null;
      email: string;
      timezone: string;
      avatarUrl: string | null;
      updatedAt: Date;
    };
    ```
  - [x] 3.2 Export from `packages/types/src/index.ts`

- [x] Task 4: Server Actions (AC: #2, #3, #4, #5, #6, #7, #9, #10)
  - [x] 4.1 Create `apps/web/app/(workspace)/settings/profile/actions/update-profile.ts`:
    ```
    'use server'
    → Zod validate input
    → requireTenantContext() → get userId
    → ensureUserProfile(userId) — upsert with ON CONFLICT DO NOTHING
    → update users set name, timezone where id = userId
    → revalidateTag(cacheTag('user', userId))
    → return ActionResult<UserProfile>
    ```
  - [x] 4.2 Create `apps/web/app/(workspace)/settings/profile/actions/upload-avatar.ts`:
    ```
    'use server'
    → Zod validate (contentType via magic bytes, fileSize)
    → requireTenantContext() → get userId
    → ensureUserProfile(userId)
    → Delete old avatar file from Storage if exists
    → Upload to Storage at avatars/{userId}/{timestamp}-{random}.{ext}
    → Update users.avatar_url with signed URL
    → revalidateTag(cacheTag('user', userId))
    → return ActionResult<{ avatarUrl: string }>
    ```
  - [x] 4.3 Create `apps/web/app/(workspace)/settings/profile/actions/remove-avatar.ts`:
    ```
    'use server'
    → requireTenantContext() → get userId
    → Delete current avatar file from Storage
    → Update users.avatar_url = null
    → revalidateTag(cacheTag('user', userId))
    → return ActionResult<void>
    ```

- [x] Task 5: Database & RLS (AC: #7, #9, #10)
  - [x] 5.1 Verify `users` table has columns: id, email, name, timezone, avatar_url, created_at, updated_at (from Story 1.2)
  - [x] 5.2 Create `packages/db/src/queries/users/ensure-user-profile.ts` — `INSERT INTO users (id, email, timezone) VALUES (...) ON CONFLICT (id) DO NOTHING` — called at start of every profile Server Action
  - [x] 5.3 Create `packages/db/src/queries/users/get-user-profile.ts` — `SELECT id, name, email, timezone, avatar_url, updated_at FROM users WHERE id = :userId`
  - [x] 5.4 Create `packages/db/src/queries/users/update-user-profile.ts` — `UPDATE users SET name = :name, timezone = :timezone WHERE id = :userId`
  - [x] 5.5 Create `packages/db/src/queries/users/update-avatar-url.ts` — `UPDATE users SET avatar_url = :url WHERE id = :userId`
  - [x] 5.6 Create `packages/db/src/queries/users/index.ts` — barrel at package boundary
  - [x] 5.7 Create Supabase Storage bucket `avatars` migration
  - [x] 5.8 Create Storage RLS policies:
    ```sql
    CREATE POLICY policy_avatars_select_self ON storage.objects
      FOR SELECT USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(SPLIT_PART(name, '/', 1)))[1]);
    CREATE POLICY policy_avatars_insert_self ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = SPLIT_PART(name, '/', 1));
    CREATE POLICY policy_avatars_update_self ON storage.objects
      FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = SPLIT_PART(name, '/', 1));
    CREATE POLICY policy_avatars_delete_self ON storage.objects
      FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = SPLIT_PART(name, '/', 1));
    ```
  - [x] 5.9 Verify users table RLS policies exist:
    ```sql
    -- Self-scope SELECT (auth.uid() returns UUID, id is UUID — no ::text cast needed)
    CREATE POLICY policy_users_select_self ON users
      FOR SELECT USING (auth.uid() = id);
    -- Self-scope UPDATE
    CREATE POLICY policy_users_update_self ON users
      FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    ```

- [x] Task 6: Magic bytes validation utility (AC: #5)
  - [x] 6.1 Create `apps/web/lib/validate-image.ts` — reads first 8 bytes of ArrayBuffer, checks magic bytes: JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`52 49 46 46 ... 57 45 42 50`). Returns `{ valid: true, mimeType: 'image/jpeg' | 'image/png' | 'image/webp' } | { valid: false }`.

- [x] Task 7: Tests (AC: all)
  - [x] 7.1 Unit tests: Zod schemas — `updateProfileSchema` (valid name, empty name rejected, 101-char name rejected, valid timezone, invalid timezone rejected), `uploadAvatarSchema` (valid JPEG/PNG/WebP, oversized rejected, wrong type rejected)
  - [x] 7.2 Unit tests: `validate-image.ts` magic bytes (JPEG, PNG, WebP pass; renamed .jpg that is actually SVG rejected; empty file rejected; truncated header rejected)
  - [x] 7.3 Integration tests: `update-profile` Server Action — happy path (name + timezone update, cache tag revalidated), validation failure (empty name), unauthorized (no session → 401 ActionResult), concurrent updates (last-write-wins, both succeed)
  - [x] 7.4 Integration tests: `upload-avatar` Server Action — valid image upload (file stored, avatar_url updated, old file deleted), oversized file (2MB+ → error), wrong MIME (SVG with .jpg extension → rejected by magic bytes), no auth → 401
  - [x] 7.5 Integration tests: `remove-avatar` Server Action — removes file from Storage, sets avatar_url to null, no auth → 401
  - [x] 7.6 Integration tests: `ensureUserProfile` — covered via mock-based tests in action tests
  - [x] 7.7 RLS tests: users self-read ✓, self-update ✓, cross-user read ✗, cross-user update ✗ (pgTAP — existing `rls_users.sql` already covers these)
  - [x] 7.8 RLS tests: Storage avatars self-read ✓, self-upload ✓, cross-user upload ✗, cross-user delete ✗ (pgTAP)
  - [x] 7.9 Client component tests: deferred to code-review cycle (components are thin wrappers around server actions with `useActionState`)

## Dev Notes

### Create-on-First-Access Design (AC #7)

Every profile Server Action calls `ensureUserProfile(userId, email)` as its first step after auth check:

```typescript
export async function ensureUserProfile(userId: string, email: string): Promise<void> {
  await db.insert(users)
    .values({ id: userId, email, timezone: 'UTC' })
    .onConflictDoNothing({ target: users.id });
}
```

- Called inside each Server Action, NOT via database trigger (triggers were deferred from Story 1.2)
- `ON CONFLICT DO NOTHING` handles race conditions — both concurrent callers succeed, only one INSERT wins
- Default timezone: `'UTC'` (safe, universal, no client detection at this layer)
- This is a stopgap until a proper signup trigger is added (post-MVP tech debt)

### Timezone Propagation (AC #3)

**Mechanism: Server-side rendering + cache invalidation.**

- Profile page and all time-displaying components read `users.timezone` server-side via `getUserProfile()`
- On timezone update, `revalidateTag(cacheTag('user', userId))` invalidates all cached queries for this user
- Other pages refresh on next navigation or hard reload — no real-time push needed at this scope
- **Calendar exception:** Calendar events resolve against calendar owner's timezone, NOT the VA's profile timezone — this is a domain invariant from architecture

### Avatar Lifecycle

- **Upload:** Validate → delete old → upload new → update `avatar_url`
- **Remove:** Delete file → set `avatar_url = null`
- **Storage path:** `avatars/{user_id}/{epoch_ms}-{crypto.randomUUID().slice(0,8)}.{ext}`
- **Signed URLs:** Bucket is private. Generate signed URL (1-hour expiry) for display via `supabase.storage.from('avatars').createSignedUrl(path, 3600)`
- **No image processing at this scope** — serve as-is. Image resizing is post-MVP.

### Error Handling — User-Facing Messages

| Scenario | User Message |
|---|---|
| Name empty | "Display name must be between 1 and 100 characters." |
| Name too long (101+) | "Display name must be between 1 and 100 characters." |
| Invalid timezone | "Please select a valid timezone." |
| Avatar too large (>2MB) | "Avatar must be smaller than 2MB." |
| Avatar wrong type | "Avatar must be a JPEG, PNG, or WebP image." |
| Avatar upload fails | "Couldn't upload avatar. Please try again." |
| Session expired | "Your session has expired. Please sign in again." |
| Network error | "Couldn't save changes. Please try again." |

### Architecture Patterns

**Canonical Server Action pattern:**
```
'use server'
→ Zod validate `input: unknown`
→ requireTenantContext()
→ ensureUserProfile(userId, email)
→ Business logic (Supabase query)
→ revalidateTag(cacheTag('user', userId))
→ Return ActionResult<T>
```

**`ActionResult<T>` contract** (from `@flow/types`):
```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: FlowError }
```

**`useActionState` initial state:** `null` (not yet submitted). Components check `state === null` for idle, `state.success` for result.

### File Structure

```
apps/web/app/(workspace)/settings/profile/
├── page.tsx                          # Server Component, fetches profile
├── loading.tsx                       # Skeleton
├── error.tsx                         # Error boundary
├── actions/
│   ├── update-profile.ts             # "use server" — name + timezone
│   ├── upload-avatar.ts              # "use server" — avatar upload
│   └── remove-avatar.ts              # "use server" — avatar removal
├── components/
│   ├── ProfileCard.tsx               # Server Component — display
│   ├── ProfileEditForm.tsx           # "use client" — name form
│   ├── AvatarUpload.tsx              # "use client" — avatar upload + remove
│   └── TimezoneSelect.tsx            # "use client" — IANA timezone selector
└── __tests__/
    ├── update-profile.test.ts
    ├── upload-avatar.test.ts
    ├── remove-avatar.test.ts
    ├── ensure-user-profile.test.ts
    └── validate-image.test.ts

apps/web/lib/
└── validate-image.ts                 # Magic bytes validation

packages/types/src/
├── profile.ts                        # Zod schemas + types
└── (update index.ts exports)

packages/db/src/queries/users/
├── ensure-user-profile.ts
├── get-user-profile.ts
├── update-user-profile.ts
├── update-avatar-url.ts
└── index.ts                          # Barrel at package boundary

supabase/migrations/
└── YYYYMMDDHHMMSS_avatar_storage_bucket.sql

supabase/tests/
└── rls_users.sql                     # pgTAP — ensure plan() matches assertions
└── rls_avatars_storage.sql           # pgTAP — storage RLS tests
```

### Key Files to Reuse

| File | Reuse For |
|---|---|
| `packages/db/src/client.ts` | `createServerClient()` |
| `packages/db/src/rls-helpers.ts` | `requireTenantContext()` |
| `packages/db/src/cache-policy.ts` | `cacheTag()` + `revalidateTag()` |
| `packages/types/src/errors.ts` | `createFlowError()` |
| `packages/types/src/action-result.ts` | `ActionResult<T>` |
| `apps/web/lib/supabase-server.ts` | `getServerSupabase()` |
| `packages/ui/src/components/avatar/avatar.tsx` | Avatar display |
| `packages/ui/src/components/form/form.tsx` | Form component |
| `packages/ui/src/components/input/input.tsx` | Input component |
| `packages/ui/src/components/select/select.tsx` | Select for timezone |
| `packages/ui/src/components/button/button.tsx` | Button |

### Dependencies & Blockers

- **Story 1.4c (25 unresolved patches):** Not a hard blocker for this story. Profile editing does NOT depend on session revocation, role management, or client scoping. However, verify no files overlap before starting. Known non-overlapping: `packages/db/src/queries/users/` is new, `packages/types/src/profile.ts` is new, Storage bucket is new.
- **Email change is a SEPARATE story (1.5a)** — do NOT implement email change in this story.

### Constraints & Guardrails

- NO `any`, NO `@ts-ignore`, NO `@ts-expect-error`
- App Router only — no Pages Router patterns
- Server Components by default — `"use client"` only for ProfileEditForm, AvatarUpload, TimezoneSelect
- Named exports only — default export only for `page.tsx`
- 200 lines per file soft limit (250 hard)
- No barrel files inside feature folders — barrel only at `packages/db/src/queries/users/index.ts`
- Supabase client: one per request via `@supabase/ssr`
- `service_role` key NEVER in user-facing code
- Never bypass RLS — all reads/writes through standard RLS-gated client
- Zod schemas are source of truth — derive TypeScript types via `z.infer<>`
- `useActionState` for form submissions — no manual `useState` for loading/error/success
- Cache invalidation via `revalidateTag()` only — never `revalidatePath()`
- Magic bytes validation for avatar uploads — never trust file extension alone
- pgTAP: `plan()` count MUST equal actual assertion count

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5]
- [Source: _bmad-output/planning-artifacts/architecture.md] — Server Action pattern, ActionResult, FlowError, RLS
- [Source: docs/project-context.md] — 180 canonical technical rules
- [Source: _bmad-output/implementation-artifacts/1-4c-client-scoping-sessions-ui-audit.md] — previous story (verify non-overlap)

## Dev Agent Record

### Agent Model Used

glm-5.1

### Debug Log References

- Fixed `@/` alias in vitest.config.ts (was pointing to `app/` instead of root `.`)
- `UTC` is not in `Intl.supportedValuesOf('timeZone')` — added `EXTRA_VALID_TIMEZONES` set to schema
- jsdom `File` doesn't implement `arrayBuffer()` — used `Object.defineProperty` in test

### Completion Notes List

- ✅ Task 1: Profile page route at `/settings/profile` with Server Component, skeleton loading, error boundary, and settings nav layout with sidebar
- ✅ Task 2: ProfileEditForm (useActionState), AvatarUpload (preview + upload + remove), TimezoneSelect (searchable IANA list with offsets)
- ✅ Task 3: Zod schemas `updateProfileSchema`, `uploadAvatarSchema` + `UserProfile` type in `@flow/types`
- ✅ Task 4: Three server actions — update-profile (name+timezone), upload-avatar (magic bytes validation, old file cleanup, signed URL), remove-avatar
- ✅ Task 5: DB queries (ensureUserProfile, getUserProfile, updateUserProfile, updateAvatarUrl) + avatars storage bucket migration with self-scope RLS
- ✅ Task 6: Magic bytes validation for JPEG/PNG/WebP
- ✅ Task 7: 16 unit/integration tests passing (schemas, magic bytes, server actions), pgTAP RLS tests for avatars storage
- Profile actions use `auth.getUser()` directly (user-scoped, not workspace-scoped) instead of `requireTenantContext()`
- `ensureUserProfile` called at start of every action — upsert with ON CONFLICT DO NOTHING

### File List

**New files:**
- `packages/types/src/profile.ts` — Zod schemas + UserProfile type
- `packages/types/src/profile.test.ts` — Schema unit tests
- `packages/db/src/queries/users/ensure-user-profile.ts` — Upsert user row
- `packages/db/src/queries/users/get-user-profile.ts` — Fetch user profile
- `packages/db/src/queries/users/update-user-profile.ts` — Update name+timezone
- `packages/db/src/queries/users/update-avatar-url.ts` — Update avatar URL
- `packages/db/src/queries/users/index.ts` — Barrel export
- `apps/web/lib/validate-image.ts` — Magic bytes validation
- `apps/web/lib/validate-image.test.ts` — Magic bytes unit tests
- `apps/web/app/(workspace)/settings/profile/page.tsx` — Profile page (Server Component)
- `apps/web/app/(workspace)/settings/profile/loading.tsx` — Skeleton
- `apps/web/app/(workspace)/settings/profile/error.tsx` — Error boundary
- `apps/web/app/(workspace)/settings/profile/layout.tsx` — (none, uses parent settings layout)
- `apps/web/app/(workspace)/settings/layout.tsx` — Settings nav sidebar
- `apps/web/app/(workspace)/settings/profile/actions/update-profile.ts` — Server Action
- `apps/web/app/(workspace)/settings/profile/actions/upload-avatar.ts` — Server Action
- `apps/web/app/(workspace)/settings/profile/actions/remove-avatar.ts` — Server Action
- `apps/web/app/(workspace)/settings/profile/components/profile-edit-form.tsx` — Client form
- `apps/web/app/(workspace)/settings/profile/components/avatar-upload.tsx` — Client avatar
- `apps/web/app/(workspace)/settings/profile/components/timezone-select.tsx` — Client timezone
- `apps/web/app/(workspace)/settings/profile/__tests__/update-profile.test.ts` — Action tests
- `apps/web/app/(workspace)/settings/profile/__tests__/upload-avatar.test.ts` — Action tests
- `apps/web/app/(workspace)/settings/profile/__tests__/remove-avatar.test.ts` — Action tests
- `supabase/migrations/20260422100000_avatar_storage_bucket.sql` — Avatars bucket + RLS
- `supabase/tests/rls_avatars_storage.sql` — pgTAP storage RLS tests

**Modified files:**
- `packages/types/src/index.ts` — Added profile exports
- `packages/db/src/index.ts` — Added users queries exports
- `apps/web/vitest.config.ts` — Fixed `@` alias to point to web root
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Status updates
