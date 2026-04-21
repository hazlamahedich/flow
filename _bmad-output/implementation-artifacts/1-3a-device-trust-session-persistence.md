# Story 1.3a: Device Trust & Session Persistence

Status: backlog

Depends on: Story 1.3 (Magic Link Authentication), Story 1.4 (Google OAuth — recommended but not blocking)

## Story

As a returning user,
I want to stay signed in on my trusted devices,
So that I don't have to re-authenticate via magic link every time I open Flow OS.

## Context

This story was extracted from Story 1.3 during an adversarial party mode review. The "remember this device" feature was removed from 1.3 because:

1. Story 1.3 ships with magic-link-only auth — no OAuth safety net, no session management UI, no device management. Adding device trust without those safeguards creates attack surface in a first auth story.
2. VAs (primary persona) frequently work from shared devices — client offices, coworking spaces, internet cafes. Device trust in that context needs deliberate UX (device naming, visible trusted device list, one-click revocation) that deserves its own story.
3. The original implementation (SHA-256 of User-Agent) was security theater. Correct implementation (UUID cookie + `user_devices` table) adds ~300 LOC, 13+ test cases, and an entire new attack surface. Story 1.3 was already large.

This story ships AFTER Story 1.3 establishes the auth foundation, and ideally alongside or after Story 1.4 (Google OAuth) so the auth system has multiple methods and users have an auth fallback if device trust fails.

[Source: Party Mode Round 3 — Winston, Sally, John, Amelia debate]

## Acceptance Criteria

1. **Given** a user has authenticated successfully, **When** they opt in to "Trust this device", **Then** a random UUID is generated and stored as an `httpOnly`, `Secure`, `SameSite=Lax` cookie named `flow_device` with a 30-day expiry, and a corresponding record is created in the `user_devices` table
2. **And** on subsequent visits, if the `flow_device` cookie matches a trusted device record for that user, the session is seamlessly extended (no magic link required) for up to 7 days per trust grant, with refresh token rotation continuing as normal
3. **And** if the `flow_device` cookie is absent or does not match any trusted device record, the user must authenticate normally via magic link or OAuth — no error shown, no degraded trust level, just standard auth
4. **And** a maximum of 5 trusted devices per user are enforced — attempting to trust a 6th device prompts the user to revoke an existing device first
5. **And** a "Your Devices" settings page exists showing all trusted devices with: device label (user-provided name), last active timestamp, browser/device info, and a "Revoke" button for each device
6. **And** revoking a device immediately invalidates its `flow_device` cookie on next request (middleware checks against revoked list) and terminates any active sessions associated with that device
7. **And** a "Sign out everywhere" option revokes ALL trusted devices and terminates ALL active sessions for the user
8. **And** when a user first trusts a device, they are prompted to name it (e.g., "MacBook Pro — Home Office") with a sensible default derived from the User-Agent string
9. **And** the login form shows a "Trust this device" checkbox — default unchecked. The label changes to "This is a shared or public device? Sign in without trusting" when an incognito/private browsing context is detected (via `navigator` checks — best-effort, not guaranteed)
10. **And** all device trust operations (trust, revoke, sign-out-everywhere) are logged to `audit_log` with events: `device_trusted`, `device_revoked`, `all_devices_revoked`, `device_trust_rejected` (cookie mismatch)
11. **And** concurrent device trust operations are atomic — no race conditions on device count or revocation
12. **And** the existing session timeout from Story 1.3 (24h absolute / 4h idle) continues to apply. Device trust extends the **absolute** session max from 24h to 7 days for trusted devices. Idle timeout remains at 4h regardless of trust status

## Tasks / Subtasks

- [ ] Task 1: Create `user_devices` table and types (AC: #1, #4)
  - [ ] 1.1 Create migration `supabase/migrations/<timestamp>_user_devices.sql` — `user_devices` table: `id` uuid PK DEFAULT gen_random_uuid(), `user_id` uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, `device_token_hash` text NOT NULL (SHA-256 of the UUID cookie value — never store raw token), `label` text NOT NULL (user-provided name), `user_agent_hint` text (browser/device info for display, NOT for fingerprinting), `last_seen_at` timestamptz NOT NULL DEFAULT now(), `created_at` timestamptz NOT NULL DEFAULT now(), `is_revoked` boolean NOT NULL DEFAULT false. Unique constraint on `(user_id, device_token_hash)`. Index on `user_id`. RLS: users can only read/write their own devices (using `auth.uid()`)
  - [ ] 1.2 Create `packages/auth/types.ts` — shared types: `DeviceRecord`, `TrustDeviceResult`, `RevokeDeviceResult`. Branded types: `DeviceId`, `DeviceTokenHash`

- [ ] Task 2: Implement device trust on login (AC: #1, #8, #9)
  - [ ] 2.1 Add "Trust this device" checkbox to `magic-link-form.tsx` — default unchecked. When checked, pass `trustDevice: true` to the Server Action
  - [ ] 2.2 In `send-magic-link.ts` — when `trustDevice` is true, generate `crypto.randomUUID()` as the device token. Store the SHA-256 hash in a short-lived cookie (`flow_device_pending`, httpOnly, Secure, SameSite=Lax, max-age 10min — matches magic link expiry). The raw UUID is NOT stored server-side at this point — only the hash
  - [ ] 2.3 In auth callback route — on successful authentication, check for `flow_device_pending` cookie. If present: hash the value, check device count for this user (< 5), insert into `user_devices` (hash of cookie value as `device_token_hash`, User-Agent string as `user_agent_hint`, label = "New Device" as placeholder). Set the actual `flow_device` cookie with the raw UUID (httpOnly, Secure, SameSite=Lax, 30-day expiry). Delete `flow_device_pending`. If device count >= 5, skip trust and show a message: "You've reached the maximum number of trusted devices. Remove one in Settings to add this device."
  - [ ] 2.4 After trust, redirect to a device naming screen or show an inline prompt: "We'll remember this device. Give it a name?" with a text input and a default derived from User-Agent parsing (e.g., "Chrome on macOS"). Save to `user_devices.label`

- [ ] Task 3: Implement seamless session extension (AC: #2, #3)
  - [ ] 3.1 Modify `middleware.ts` — on each request, after session validation, check for `flow_device` cookie. If present: hash the cookie value, query `user_devices` WHERE `device_token_hash` = hash AND `user_id` = session.user.id AND `is_revoked` = false. If match found: extend absolute session timeout from 24h to 7 days. If no match or revoked: standard 24h/4h timeout. Do NOT show any error for mismatch — just use standard session policy
  - [ ] 3.2 Update `last_seen_at` on the matched device record on each middleware check (debounced — not on every single request, perhaps on a session refresh interval)

- [ ] Task 4: Implement "Your Devices" settings page (AC: #5, #6, #7)
  - [ ] 4.1 Create `app/(workspace)/settings/devices/page.tsx` — Server Component listing all trusted devices for the current user. Each device shows: label, last active (relative time), browser/device hint, "Revoke" button
  - [ ] 4.2 Create `app/(workspace)/settings/devices/actions/revoke-device.ts` — Server Action: sets `is_revoked = true` on the device record. Logs `device_revoked` to audit_log. The cookie is not deleted server-side — middleware will detect the revoked status on next request and treat as untrusted
  - [ ] 4.3 Create `app/(workspace)/settings/devices/actions/revoke-all-devices.ts` — Server Action: sets `is_revoked = true` on ALL device records for the user. Calls `invalidateUserSessions()` from `packages/auth/server-admin.ts` to terminate all active sessions. Logs `all_devices_revoked` to audit_log. User must re-authenticate
  - [ ] 4.4 Add "Sign out everywhere" button to the devices page — calls `revoke-all-devices`. Confirm dialog before action

- [ ] Task 5: Update session timeout for trusted devices (AC: #12)
  - [ ] 5.1 Modify middleware session timeout logic: if device is trusted, absolute max = 7 days from initial trust grant. If not trusted (or no cookie), absolute max = 24h (Story 1.3 default). Idle timeout remains 4h regardless
  - [ ] 5.2 The 7-day absolute max resets when the user explicitly re-authenticates (not on each session refresh — that would create an infinite session)

- [ ] Task 6: Wire audit logging for device events (AC: #10)
  - [ ] 6.1 Add to `auth-audit.ts` — four new events: `device_trusted` (user_id, device_label, ip_hmac), `device_revoked` (user_id, device_id, ip_hmac), `all_devices_revoked` (user_id, ip_hmac), `device_trust_rejected` (user_id, reason='cookie_mismatch'|'device_revoked'|'count_exceeded', ip_hmac)

- [ ] Task 7: Write tests (AC: #11)
  - [ ] 7.1 Create `apps/web/__tests__/device-trust.test.ts` — trust device on login, cookie set correctly, device record created, device count enforced (max 5), reject 6th device
  - [ ] 7.2 Create `apps/web/__tests__/device-trust-session.test.ts` — trusted device gets 7-day session, untrusted device gets 24h session, revoked device falls back to 24h, mismatch cookie = standard session (no error)
  - [ ] 7.3 Create `apps/web/__tests__/device-trust-replay.test.ts` — stolen cookie on different device (same UUID, different IP) — system logs `device_trust_rejected` if additional server-side validation is added later (Phase 2). For MVP, cookie alone is sufficient — IP check is a future enhancement
  - [ ] 7.4 Create `apps/web/__tests__/device-trust-concurrency.test.ts` — two simultaneous trust requests from same user, device count remains accurate, no race conditions
  - [ ] 7.5 Create `apps/web/__tests__/device-revoke.test.ts` — revoke single device, revoke all devices, revoked device cookie no longer extends session, "Sign out everywhere" terminates all sessions
  - [ ] 7.6 Create `apps/web/__tests__/device-audit.test.ts` — all four device events logged with correct details
  - [ ] 7.7 Update middleware tests from Story 1.3 — add cases for trusted device session extension, revoked device fallback, mismatch cookie handling

- [ ] Task 8: Final verification (AC: all)
  - [ ] 8.1 `pnpm build` — all packages + apps/web build successfully
  - [ ] 8.2 `pnpm test` — all existing + new tests pass
  - [ ] 8.3 `pnpm lint` — zero errors
  - [ ] 8.4 `pnpm typecheck` — zero errors
  - [ ] 8.5 Manual smoke test: login → trust device → name device → close browser → reopen → session still active (no re-auth required)
  - [ ] 8.6 Verify device count: trust 6 devices → 6th rejected with message
  - [ ] 8.7 Verify revocation: revoke device → close and reopen browser → prompted for magic link (session terminated)
  - [ ] 8.8 Verify "Sign out everywhere": click button → all devices revoked → must re-authenticate on all devices
  - [ ] 8.9 Verify "Your Devices" page shows all trusted devices with correct info

## Dev Notes

### What This Story Builds On

This story extends the auth foundation from Story 1.3:
- Uses the `rate_limits` atomic upsert pattern (adapt for device count check)
- Uses `packages/auth/server-admin.ts` for `invalidateUserSessions()` (created in 1.3)
- Uses `packages/auth/errors.ts` for `AppError` types (created in 1.3)
- Uses `packages/auth/env.ts` for environment validation (created in 1.3)
- Extends middleware from Story 1.3 with device trust session logic
- Extends audit logging from Story 1.3 with 4 new device events
- Extends login form from Story 1.3 with "Trust this device" checkbox

### Device Token Security Model

The device token is a random UUID (`crypto.randomUUID()`) — NOT a fingerprint derived from User-Agent or IP. This means:

- **Uniqueness**: Each trust grant produces a unique token. Two browsers on the same laptop get different tokens.
- **Revocability**: Deleting the device record or setting `is_revoked = true` immediately invalidates trust.
- **No tracking**: The token identifies a trust relationship, not a device. Clearing cookies = new trust required.
- **Storage**: Only the SHA-256 hash of the token is stored in the database. Even a DB leak doesn't expose cookie values.
- **Limitations**: Cookie theft allows impersonation until revocation. Mitigated by: httpOnly, Secure, SameSite=Lax, and the "Your Devices" page for manual revocation. Future enhancement: IP geolocation anomaly detection (Phase 2).

### Why UUID Cookie, Not User-Agent Fingerprint

The original Story 1.3 spec used SHA-256(User-Agent) as a device fingerprint. This was identified as security theater by all four party mode agents because:

- Every Chrome user on macOS has the same User-Agent string
- User-Agent is trivially spoofed (1 line of code)
- Corporate managed browsers behind the same proxy have identical User-Agents
- It provides zero ability to revoke a specific device (there's no unique identifier)

The UUID cookie approach provides: cryptographic uniqueness, server-side revocation, device count enforcement, and user-visible device management.

### UX Design for Device Trust

Per party mode UX designer (Sally):

1. **Default to untrusted.** The "Trust this device" checkbox is unchecked by default. Users opt in.
2. **Name your devices.** After trust, prompt: "We'll remember this device. Give it a name?" Default from User-Agent parsing. Mental model of trust.
3. **Shared device detection.** When incognito/private browsing detected (best-effort), show: "This is a shared or public device? Sign in without trusting."
4. **Visible device list.** "Your Devices" in settings — see everything, revoke anything, one click.
5. **Fast re-auth.** When device trust expires or is revoked, the re-auth flow should be under 10 seconds: "Hi Sarah! Click to send a new link."

### Known Limitations

- **No IP geolocation anomaly detection.** A stolen cookie used from a different country will not be flagged. Future enhancement.
- **No hardware attestation.** Device trust is cookie-based, not hardware-bound. Clearing cookies = untrusted. Acceptable for MVP.
- **No device trust for OAuth users.** Google OAuth sessions have their own session management. Device trust applies to magic link sessions only (for now). OAuth device trust can reuse the same infrastructure.
- **Middleware device check on every request.** Performance concern at scale. Debounce `last_seen_at` updates — don't write on every single request. Consider: only update on session refresh (which happens ~hourly).
- **No cookie rotation.** The `flow_device` cookie value doesn't rotate. If stolen and used before revocation, it's valid. Future: rotate on each session refresh (like refresh tokens).

### References

- [Source: Story 1.3] — auth foundation, middleware, audit logging, rate limiting patterns
- [Source: PRD#FR7] — "remember this device" with 7-day session extension
- [Source: PRD#FR10] — active session management (view/revoke sessions)
- [Source: ux-design-specification.md#Form Patterns] — form UX, checkbox patterns
- [Source: ux-design-specification.md#Settings] — settings page patterns
- [Source: Party Mode Round 3] — Winston (keep with UUID fix), Sally (UX guardrails), John (defer to separate story), Amelia (cost analysis)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
