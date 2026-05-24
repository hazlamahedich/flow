---
name: bmad-code-review
description: 'Review code changes adversarially using parallel review layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) with structured triage into actionable categories. Use when the user says "run code review" or "review this code"'
---

Follow the instructions in ./workflow.md.

## Pitfalls

### Phantom DB column detection (top-3 subagent defect)

When the diff contains DB-interacting code (inserts, updates, selects, Drizzle queries), the Blind Hunter layer MUST cross-reference every column name against the Drizzle schema files (packages/db/src/schema/*.ts) or migration files (supabase/migrations/*.sql). Phantom columns -- referenced in app code but nonexistent in the DB schema -- are the #1 defect pattern from subagent-generated code.

**Detection checklist for the Blind Hunter:**
1. Extract all column names from insert/update objects in the diff
2. Extract all columns from select strings (e.g., `'id, email_address, is_primary'`)
3. Extract all fields from Zod schemas that map to DB rows
4. Cross-reference against the actual Drizzle schema columns
5. Any column in the diff but NOT in the schema = CRITICAL finding

**Common phantom column patterns:**
- `email_address` when the schema only has `email` or no email column at all
- `provider_calendar_id` when the schema already has `calendar_id` serving the same purpose
- `error_message` that was never added to the migration
- Column name mismatches like `event_source` vs `source`

### Non-functional withTimeout / abort-without-reject pattern

The Blind Hunter should flag any `withTimeout` or timeout wrapper that calls `controller.abort()` without also rejecting the promise. This is a silent-killer bug: tests pass (mocks reject on their own) but production hangs forever on stalled providers. See `references/common-defect-patterns.md` for the correct `Promise.race` implementation.

### Missing workspace_id with service client

Any query using `createServiceClient()` (bypasses RLS) that looks up workspace-scoped records by ID must also filter by `workspace_id`. Without it, a misrouted UUID leaks cross-workspace data. Flag as HIGH severity.

### safeParse vs parse in worker catch blocks

Workers that do `const { workspaceId } = Schema.parse(data)` inside a try block, then reference `workspaceId` in catch for audit logging, will crash on malformed payloads. Flag `.parse()` in worker entry points and recommend `safeParse()` with early return.

### Agent run status never transitions

Workers that receive `runId` but never call `updateRunStatus()` leave runs in `queued` forever. Check every worker for status transitions: `queued -> running -> completed/failed`.

**See also:** `references/common-defect-patterns.md` for a full catalog of recurring defects with severity, pattern description, and fix code.

### LiveView vs Controller expectation drift (Phoenix 1.8 gen.auth)

When reviewing Phoenix 1.8 projects, verify whether auth ATDD scaffolds in `test/<app>_web/live/` reference generated controller code instead of nonexistent LiveView modules. `phx.gen.auth` generates controllers regardless of `--live`. Stale LiveView scaffolds should be removed. See `references/elixir-phoenix-defect-patterns.md` "LiveView vs Controller expectation drift".

### Session cookie missing http_only in endpoint.ex
Phoenix `Endpoint` defines `@session_options` for cookie-backed sessions. If `http_only: true` is omitted, the session cookie is readable by JavaScript via `document.cookie`, exposing it to XSS theft. See `references/elixir-phoenix-defect-patterns.md` "Missing http_only on session cookie".

### Secure flag absence on remember-me cookie
Phoenix-generated `user_auth.ex` cookie options may omit `secure: true`. In production this leaves the cookie vulnerable on unencrypted connections. See `references/elixir-phoenix-defect-patterns.md` "Secure flag missing on remember-me cookie in production".

### Missing rate limiter on auth endpoints
Auth routes (registration, login, password reset) are prime targets for brute-force and credential stuffing. A lightweight fixed-window plug should be wired into the router for `/users/*` scopes. See `references/elixir-phoenix-defect-patterns.md` "Missing rate limiter on auth and session routes".

### Stale ATDD scaffolds after implementation complete

Red-phase scaffolds that retain `@moduletag :skip` after a story is completed mislead reviewers about actual coverage. Cross-reference skip-tagged tests against sprint status and remove or activate them. See `references/elixir-phoenix-defect-patterns.md` "Stale ATDD scaffolds after implementation complete".

### Elixir / Phoenix Defects

When reviewing Phoenix / Elixir projects, cross-reference `references/elixir-phoenix-defect-patterns.md` for OTP supervision, configuration alignment, migration primary-key type, asset build, boot-versus-test gap, and the Phoenix-specific security patterns listed above. **Also check the "Workspace Multi-Tenancy & RBAC" section** for workspace-scoped apps: transaction wrapping, dead RBAC plugs, UUID/slug redirect mismatches, role enforcement gaps, and invitation email ownership.
