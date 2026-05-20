# Story 6.1: Google Calendar OAuth & Connection

Status: ready-for-dev

## Story

As a VA (agency owner),
I want to connect client Google Calendars via OAuth,
so that the Calendar Agent can manage scheduling on my behalf.

## Acceptance Criteria

0. **[AC0 -- Test-First]** Unit test stubs exist and are red before implementation begins. Story cannot be marked `in-progress` until test file with failing tests is created.

1. **[AC1 -- OAuth Flow]** Given a client record exists and the Calendar Agent is activated, when the user clicks "Connect Google Calendar", then a PKCE OAuth 2.0 flow completes with the requested scopes (`calendar.readonly` or `calendar.events`), redirecting back to the app with valid tokens per FR28i.

2. **[AC2 -- Incremental Consent]** Given the VA has already connected Gmail via the Inbox Agent, when the user connects Google Calendar, then the existing OAuth tokens are extended with calendar scopes via `include_granted_scopes=true` -- no second full OAuth dance required per FR28i.

3. **[AC3 -- Configurable Access]** Given the user has completed OAuth, when setting up a client calendar, then the user can choose access type: `owner`, `read_write`, or `read_only` per calendar per FR28i.

4. **[AC4 -- Token Encryption]** Given OAuth tokens are obtained, when stored in the database, then tokens are encrypted at rest using Supabase Vault (TCE with libsodium AEAD) or application-level AES-256-GCM, with refresh token rotation on every use per NFR16c.

5. **[AC5 -- API Timeout]** Given any external Google Calendar API call, when executed, then it times out within 30 seconds per NFR49.

6. **[AC6 -- Auto-Disconnect]** Given 3 consecutive token refresh failures, when the system attempts to refresh, then the calendar connection status changes to `disconnected` (using existing `integrationHealthEnum: 'disconnected'`) and the VA is notified.

7. **[AC7 -- Client Calendar Record]** Given a successful OAuth connection, when the user selects calendars to connect, then a `client_calendars` record is created per calendar with sync_status `connected`, linked to the workspace and client per the data schema.

8. **[AC8 -- Initial Sync]** Given a calendar is connected, when the connection completes, then the system pulls the last 90 days of events and stores them in `calendar_events` with `created_via = 'external'` and a sync cursor for incremental sync.

9. **[AC9 -- RLS Enforcement]** Given calendar tables exist, when any query is executed, then RLS policies enforce workspace scoping via `workspace_members` join with `status = 'active'` check, using `::text` JWT cast pattern. Policy names follow `policy_{table}_{operation}_{role}` convention.

## Pre-Dev Dependency Scan

- [x] Graphify query run -- key dependencies listed below
- [x] Dependencies: packages/agents/providers/calendar-provider.ts, google-calendar-provider.ts, existing Gmail OAuth routes, Supabase Vault
- [x] UX AC review -- Calendar Agent identity (Violet), keyboard-driven triage, inline proposals
- [x] Architect sign-off: Provider abstraction pattern, agent module isolation confirmed
- [x] Story validated against calendar-agent-spec.md, project-context.md (180 rules), existing codebase patterns

### Dependencies (all resolved)

| Dependency | Status | Source |
|------------|--------|--------|
| Inbox Agent OAuth (Epic 4, Story 4-1) | done | Gmail OAuth flow to extend |
| Agent Orchestrator (Epic 2) | done | Calendar Agent plugs into mesh |
| Client records (Epic 3) | done | Calendars linked to clients |
| calendar-provider-spike | done | Interface + Google impl exist |
| RLS enforcement | done | Pattern established in epics 1-5 |

## Tasks / Subtasks

- [ ] Task 1: Database Migration -- Calendar Tables (AC: #7, #9)
  - [ ] 1.1 Create migration `YYYYMMDDNNNN_calendar_tables.sql`
  - [ ] 1.2 Create `client_calendars` table with encrypted `oauth_state` JSONB column, `updated_at` for optimistic locking
  - [ ] 1.3 Create `calendar_events` table with BOTH conflict detection indexes (time range AND partial index)
  - [ ] 1.4 Add RLS policies using canonical `workspace_members` join pattern with `policy_{table}_{operation}_{role}` naming
  - [ ] 1.5 Add Drizzle schema definitions in `packages/db/src/schema/` (source of truth, generate migration from Drizzle)

- [ ] Task 2: OAuth Route Handlers + Server Action (AC: #1, #2, #5)
  - [ ] 2.1 Create Server Action `apps/web/app/(workspace)/settings/integrations/calendar/actions/connect-calendar.ts` -- mirrors Gmail `initiate-oauth.ts` pattern: PKCE generation, iron-session state cookie, returns OAuth URL
  - [ ] 2.2 Create callback route `apps/web/app/api/auth/calendar/callback/route.ts` -- follows Gmail interstitial pattern: GET returns HTML auto-POST form, POST exchanges code + stores tokens
  - [ ] 2.3 Extend `CalendarOAuthUrlParams` interface to add `includeGrantedScopes?: boolean` and `additionalScopes?: string[]`; update `GoogleCalendarProvider.getOAuthUrl()` to pass `include_granted_scopes` and merge scopes
  - [ ] 2.4 Implement incremental consent: in Server Action, query existing `client_inboxes` for Gmail tokens, extract granted scopes, pass combined Gmail + Calendar scopes with `include_granted_scopes=true`
  - [ ] 2.5 Add 30-second timeout to all Google API calls (AbortController with 30s signal on fetch)
  - [ ] 2.6 CSRF protection: state parameter in iron-session cookie named `oauth_pkce_${state}`, maxAge 600s, sameSite lax, httpOnly true, same as Gmail pattern

- [ ] Task 3: Token Management (AC: #4, #6)
  - [ ] 3.1 Create `packages/db/src/vault/calendar-tokens.ts` -- mirrors `inbox-tokens.ts` exactly: AES-256-GCM with `CALENDAR_ENCRYPTION_KEY` env var (64 hex chars), same `{ encrypted, iv, version }` shape
  - [ ] 3.2 Create `packages/agents/providers/google-calendar/token-manager.ts` -- imports from `@flow/db/vault/calendar-tokens`, handles full rotation sequence: call refresh -> decrypt old state -> encrypt new tokens -> update DB in single transaction
  - [ ] 3.3 Implement refresh token rotation: on every API call that refreshes, persist the new refresh token (existing `GoogleCalendarProvider.refreshToken` does NOT persist -- this layer must)
  - [ ] 3.4 Implement auto-disconnect: track consecutive refresh failures per `client_calendars` record, set `sync_status = 'disconnected'` and agent health to `integrationHealthEnum.disconnected` after 3 failures

- [ ] Task 4: Calendar Connection UI (AC: #1, #3)
  - [ ] 4.1 Server Action `connectCalendar` -- PKCE flow initiation (see Task 2.1), validates input with Zod, requires tenant context with role check
  - [ ] 4.2 Server Action `selectCalendars` -- post-OAuth calendar selection, creates `client_calendars` records per selected calendar
  - [ ] 4.3 Connection page/component with access type selection (owner/read_write/read_only), Server Component by default
  - [ ] 4.4 Connection status display in agent settings using existing `integrationHealthEnum` values

- [ ] Task 5: Initial Sync (AC: #8)
  - [ ] 5.1 Enqueue initial sync via `agent_runs` insert (follow Gmail callback pattern): `agent_id: 'calendar'`, `action_type: 'initial_sync'`, then fire-and-forget sync function
  - [ ] 5.2 Pull last 90 days of events per calendar, store in `calendar_events` with `created_via = 'external'`
  - [ ] 5.3 Save sync cursor (nextSyncToken) for incremental sync
  - [ ] 5.4 Classify events by type (meeting/focus_block/travel/personal/deadline/unknown) and source (va_created/client_created/third_party/auto_generated/unknown) per spec Section 4.3
  - [ ] 5.5 All events from initial sync get `source = 'unknown'` and `created_via = 'external'` (MVP heuristic -- source classification refined in Story 6-3)

- [ ] Task 6: Agent Configuration (AC: #7)
  - [ ] 6.1 Insert Calendar Agent config in `agent_configurations` table using existing `agentIdTypeEnum` (already includes `'calendar'` -- no enum migration needed)
  - [ ] 6.2 Set ALL default config values per spec Section 3.5: `default_meeting_duration`, `buffer_minutes`, `working_hours`, `working_days` (array), `timezone`, `auto_detect_bypass`, `bypass_alert_threshold`, `travel_buffer_minutes`
  - [ ] 6.3 Set trust levels for ALL action types per spec: `find_available_slots: 0`, `propose_booking: 0`, `detect_conflict: 0`, `detect_bypass: 0`, `resolve_cascade: 1`, `create_event: 3`, `cancel_event: 3`
  - [ ] 6.4 Set initial agent status to `setup_required`

- [ ] Task 7: Provider Registry Wiring
  - [ ] 7.1 Register Google Calendar provider in provider registry: `registerProvider('calendar', 'google_calendar', () => new GoogleCalendarProvider(config))`
  - [ ] 7.2 Verify `getProvider('calendar', workspaceId)` resolves correctly

- [ ] Task 8: Tests (AC: #0)
  - [ ] 8.1 Provider unit tests: `packages/agents/providers/google-calendar/__tests__/google-calendar-provider.test.ts` -- OAuth URL generation, code exchange, incremental consent scope merging
  - [ ] 8.2 Vault unit tests: `packages/db/src/vault/__tests__/calendar-tokens.test.ts` -- encrypt/decrypt roundtrip, rotation sequence
  - [ ] 8.3 RLS tests: `supabase/tests/calendar-rls.sql` -- cover Owner/Admin/Member/ClientUser roles per project-context standard, use `policy_{table}_{operation}_{role}` names
  - [ ] 8.4 Acceptance tests: `apps/web/__tests__/acceptance/epic-6/6-1-calendar-oauth.spec.ts` -- full OAuth flow mock -> token storage -> calendar listing
  - [ ] 8.5 Create test factory: `apps/web/__tests__/acceptance/epic-6/test-factories.ts` using faker (follow epic-4 pattern)
  - [ ] 8.6 Zod validation schemas for ALL Supabase row mapping functions (project-context hard rule)

## Dev Notes

### Architecture Patterns to Follow

- **Provider abstraction**: Use `CalendarProvider` interface from spike. Never import `googleapis` directly outside `packages/agents/providers/google-calendar/`. Provider resolution via registry: `getProvider('calendar', workspaceId)` [Source: architecture.md -- Provider Abstraction]

- **Server Action for OAuth initiation**: Follow Gmail `initiate-oauth.ts` pattern exactly. The initiate step is a Server Action (NOT a route handler). Signature: `export async function connectCalendar(input: unknown): Promise<ActionResult<OAuthInitResult>>`. Use Zod validation, `requireTenantContext`, PKCE via `randomBytes`, iron-session cookie `oauth_pkce_${state}`. [Source: apps/web/app/(workspace)/clients/[clientId]/actions/inbox/initiate-oauth.ts]

- **Route handler for OAuth callback**: Follow Gmail `app/api/auth/gmail/callback/route.ts` pattern. GET returns HTML interstitial with auto-POSTing JS + noscript fallback. POST exchanges code, stores encrypted tokens. ALWAYS `session.destroy()` before redirecting. [Source: apps/web/app/api/auth/gmail/callback/route.ts]

- **Server Actions colocated**: `connectCalendar` and `selectCalendars` colocated with the calendar settings route group, NOT in a shared root `actions/` folder. [Source: project-context.md rule]

- **Agent module isolation**: Calendar Agent at `packages/agents/calendar/`. Zero cross-agent imports. Communication via database records (signals) only. [Source: architecture.md -- Agent Modules]

- **PKCE OAuth flow**: `randomBytes(16)` for state, `randomBytes(32)` for verifier, SHA-256 base64url for challenge. State stored in iron-session cookie. [Source: initiate-oauth.ts]

- **Token encryption**: Follow `packages/db/src/vault/inbox-tokens.ts` pattern exactly. AES-256-GCM, 12-byte IV, env var `CALENDAR_ENCRYPTION_KEY` (64 hex chars). Output shape: `{ encrypted: string, iv: string, version: number }` stored in `jsonb('oauth_state')`. Do NOT duplicate encryption logic in the agents package -- import from `@flow/db/vault/calendar-tokens`. [Source: inbox-tokens.ts]

- **Zod at DB boundaries**: Every Supabase row mapping function MUST use a Zod schema to validate incoming data. No exceptions. [Source: project-context.md rule]

- **PII tokenization**: Calendar events contain PII (attendee emails, locations, titles). `raw_data JSONB` stores all PII. Design storage layer to support future PII scanner/token vault integration. [Source: project-context.md PII rule]

### Existing Code to Build Upon

| File | What It Provides | How 6-1 Uses It |
|------|------------------|------------------|
| `packages/agents/providers/calendar-provider.ts` (124 lines) | CalendarProvider interface, `CalendarCodeExchangeResult` (note: `connectedEmail` not `emailAddress`) | Use as-is -- interface is production-ready |
| `packages/agents/providers/google-calendar/google-calendar-provider.ts` (322 lines) | Full Google Calendar OAuth + CRUD. **NOTE**: `getOAuthUrl` does NOT pass `include_granted_scopes` and scopes are hardcoded as `CALENDAR_SCOPES` | Extend: add `includeGrantedScopes` to `CalendarOAuthUrlParams`, pass to Google client |
| `apps/web/app/(workspace)/clients/[clientId]/actions/inbox/initiate-oauth.ts` | Server Action pattern: PKCE, iron-session, `ActionResult<T>`, Zod validation, `requireTenantContext` | Mirror exactly for calendar initiate |
| `apps/web/app/api/auth/gmail/callback/route.ts` | Interstitial HTML pattern (GET shows page, POST processes), code exchange, token storage, `session.destroy()` | Mirror exactly for calendar callback |
| `packages/db/src/vault/inbox-tokens.ts` | AES-256-GCM encryption with `GMAIL_ENCRYPTION_KEY` | Create parallel `calendar-tokens.ts` with `CALENDAR_ENCRYPTION_KEY` |
| `packages/db/src/schema/client-inboxes.ts` | Drizzle schema pattern: `jsonb('oauth_state').notNull().default({})`, `syncStatus`, `syncCursor`, indexes | Mirror for `client-calendars.ts` -- adapt field names and CHECK constraints |
| `packages/shared/` | Trust client, audit writer, PII tokenizer | Use for agent trust levels, audit logging |

### Scope Strategy

```
Calendar Scopes (additive to Gmail):
  https://www.googleapis.com/auth/calendar.readonly   -- default
  https://www.googleapis.com/auth/calendar.events     -- when write access needed

Existing Gmail Scopes (preserved via include_granted_scopes=true):
  https://www.googleapis.com/auth/gmail.readonly
  https://www.googleapis.com/auth/gmail.modify
  https://www.googleapis.com/auth/gmail.settings.basic
  openid
  https://www.googleapis.com/auth/userinfo.email

Incremental consent flow:
  1. Server Action queries client_inboxes for existing Gmail connection
  2. If found: extract granted scopes from stored tokens
  3. Pass combined Gmail + Calendar scopes to getOAuthUrl with include_granted_scopes=true
  4. If no Gmail: standard Calendar-only OAuth (no include_granted_scopes)
```

### Data Schema: client_calendars

```sql
CREATE TABLE client_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,  -- NULL for VA personal calendar (deviation from spec NOT NULL -- architect approved)
  provider TEXT NOT NULL DEFAULT 'google_calendar'
    CHECK (provider IN ('google_calendar', 'outlook')),
  calendar_id TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'read_only'
    CHECK (access_type IN ('owner', 'read_write', 'read_only')),
  oauth_state JSONB NOT NULL DEFAULT '{}',  -- stores { encrypted, iv, version } from calendar-tokens.ts
  sync_cursor TEXT,
  sync_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (sync_status IN ('connected', 'syncing', 'error', 'disconnected')),
  consecutive_refresh_failures INTEGER NOT NULL DEFAULT 0,
  color_tag TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, calendar_id)
);

-- Indexes
CREATE INDEX idx_client_calendars_workspace_client
  ON client_calendars (workspace_id, client_id);
CREATE INDEX idx_client_calendars_workspace
  ON client_calendars (workspace_id);

-- RLS (canonical pattern per project-context.md)
ALTER TABLE client_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_client_calendars_select_member
  ON client_calendars FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_client_calendars_insert_member
  ON client_calendars FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_client_calendars_update_member
  ON client_calendars FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_client_calendars_delete_member
  ON client_calendars FOR DELETE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );
```

### Data Schema: calendar_events

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_calendar_id UUID NOT NULL REFERENCES client_calendars(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  provider_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  attendees JSONB NOT NULL DEFAULT '[]',
  event_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (event_type IN ('meeting', 'focus_block', 'travel', 'personal', 'deadline', 'unknown')),
  source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('va_created', 'client_created', 'third_party', 'auto_generated', 'unknown')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_rule TEXT,
  created_via TEXT,  -- 'flow_os' or 'external'
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_calendar_id, provider_event_id)
);

-- Conflict detection indexes (BOTH required per spec)
CREATE INDEX idx_calendar_events_time_range
  ON calendar_events (client_calendar_id, start_at, end_at);
CREATE INDEX idx_cal_events_conflicts
  ON calendar_events (workspace_id, start_at, end_at)
  WHERE end_at > now();  -- partial index for live conflict detection performance
CREATE INDEX idx_calendar_events_workspace
  ON calendar_events (workspace_id);

-- RLS (canonical pattern per project-context.md)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_calendar_events_select_member
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_calendar_events_insert_member
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_calendar_events_update_member
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_calendar_events_delete_member
  ON calendar_events FOR DELETE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );
```

### Project Structure Notes

New files to create:

```
apps/web/app/api/auth/calendar/
  callback/route.ts         -- GET: interstitial HTML, POST: code exchange + token storage

apps/web/app/(workspace)/settings/integrations/calendar/
  page.tsx                  -- Calendar connection page (Server Component)
  actions/
    connect-calendar.ts     -- Server Action: PKCE + OAuth URL generation (mirrors initiate-oauth.ts)
    select-calendars.ts     -- Server Action: post-OAuth calendar selection

packages/db/src/schema/
  client-calendars.ts       -- Drizzle schema (source of truth, mirrors client-inboxes.ts pattern)
  calendar-events.ts        -- Drizzle schema

packages/db/src/vault/
  calendar-tokens.ts        -- AES-256-GCM encryption (mirrors inbox-tokens.ts, uses CALENDAR_ENCRYPTION_KEY)
  __tests__/
    calendar-tokens.test.ts -- Encrypt/decrypt roundtrip tests

packages/agents/providers/google-calendar/
  token-manager.ts          -- Rotation + auto-disconnect logic (imports from @flow/db/vault/calendar-tokens)
  __tests__/
    google-calendar-provider.test.ts  -- OAuth URL, code exchange, scope merging tests

packages/agents/calendar/
  types.ts                  -- Calendar Agent types
  config.ts                 -- Default agent config (all 8 fields per spec)

apps/web/__tests__/acceptance/epic-6/
  test-factories.ts         -- Faker-based test data (mirrors epic-4 pattern)
  6-1-calendar-oauth.spec.ts -- Full flow acceptance test

supabase/migrations/
  YYYYMMDDNNNN_calendar_tables.sql
supabase/tests/
  calendar-rls.sql          -- RLS tests covering Owner/Admin/Member/ClientUser roles
```

### Agent Configuration (spec Section 3.5 -- ALL fields)

```json
{
  "default_meeting_duration": 30,
  "buffer_minutes": 15,
  "working_hours": { "start": "09:00", "end": "17:00" },
  "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "timezone": "America/New_York",
  "auto_detect_bypass": true,
  "bypass_alert_threshold": 0.8,
  "travel_buffer_minutes": 30
}
```

### Trust Levels (spec Section 3.5 + Section 6.1)

| Action Type | Default Trust Level | Notes |
|---|---|---|
| find_available_slots | 0 (auto) | No risk |
| propose_booking | 0 (auto) | Proposal only |
| detect_conflict | 0 (auto) | Read-only detection |
| detect_bypass | 0 (auto) | Read-only detection |
| resolve_cascade | 1 (suggest) | Cascading reschedule |
| create_event | 3 (approve) | Creates on calendar |
| cancel_event | 3 (approve) | Removes from calendar |

### Signals Produced (for downstream stories)

Story 6-1 establishes the connection and initial sync. It does NOT emit signals. The following signals will be emitted by later stories (reference: spec Section 5):

| Signal | Emitted By | Consumed By |
|---|---|---|
| calendar.connected | 6-1 (this story) | Agent Orchestrator |
| calendar.sync_complete | 6-1 (this story) | Agent Orchestrator |
| calendar.conflict_detected | Story 6-2 | VA Dashboard |
| calendar.booking_proposed | Story 6-3 | VA Dashboard |
| calendar.bypass_detected | Story 6-4 | VA Dashboard |

### References

- [Source: _bmad-output/planning-artifacts/calendar-agent-spec.md#Section 3] -- Data schemas, agent config
- [Source: _bmad-output/planning-artifacts/calendar-agent-spec.md#Section 3.5] -- Agent config defaults, trust levels
- [Source: _bmad-output/planning-artifacts/calendar-agent-spec.md#Section 4.1] -- OAuth + Calendar Access
- [Source: _bmad-output/planning-artifacts/calendar-agent-spec.md#Section 4.2] -- Sync Strategy
- [Source: _bmad-output/planning-artifacts/calendar-agent-spec.md#Section 4.3] -- Source classification system
- [Source: _bmad-output/planning-artifacts/calendar-agent-spec.md#Section 5] -- Signal Catalog
- [Source: _bmad-output/planning-artifacts/calendar-agent-spec.md#Section 6.1] -- Action Types + trust levels
- [Source: _bmad-output/planning-artifacts/calendar-agent-spec.md#Section 9.3] -- OAuth Scope Minimization
- [Source: _bmad-output/planning-artifacts/architecture.md -- Provider Abstraction] -- CalendarProvider pattern
- [Source: _bmad-output/planning-artifacts/research/technical-gmail-oauth-research-2026-05-04.md] -- OAuth patterns, token encryption, Supabase coexistence
- [Source: packages/agents/providers/calendar-provider.ts] -- Production-ready interface (note: `connectedEmail` not `emailAddress`)
- [Source: packages/agents/providers/google-calendar/google-calendar-provider.ts] -- Full Google impl (needs `include_granted_scopes` extension)
- [Source: apps/web/app/(workspace)/clients/[clientId]/actions/inbox/initiate-oauth.ts] -- Server Action pattern to mirror
- [Source: apps/web/app/api/auth/gmail/callback/route.ts] -- Interstitial + callback pattern to mirror
- [Source: packages/db/src/vault/inbox-tokens.ts] -- Encryption pattern to mirror for calendar-tokens.ts
- [Source: packages/db/src/schema/client-inboxes.ts] -- Drizzle schema pattern to mirror
- [Source: docs/project-context.md] -- 180 technical rules (RLS pattern line 119, policy naming line 293, Zod validation line 311, PII line 477)

### Previous Story Learnings (from 5-4a)

- Schema decisions documented with rationale (INTEGER vs TIMESTAMPTZ -- chose what matches existing interfaces)
- Both-or-neither validation via Zod `.refine()` at schema level
- Migration naming: `YYYYMMDDNNNN_descriptive_name.sql`
- Test files co-located with their package per monorepo boundary
- Adversarial review caught 50+ findings -- run validate before dev
- Deferred items tracked explicitly with story references

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Deferred Items (at close)

_Count recorded at each code review pass. If >5, require Architect + PM approval (see scope-check-gate.md step 7)._

| Item | Reason | Deferred to | Spec Section |
|------|--------|-------------|-------------|
| Incremental sync (webhook/poll) | Out of scope for OAuth connection story | Story 6-2 | Spec 4.2 |
| Recurring event expansion | MVP: detect only | Story 6-3 | Spec 4.4 |
| Travel time calculation | MVP: simple buffer detection only | Story 6-4 | Spec 3.5 |
| Calendly/Acuity link detection | Deferred to Growth phase | Post-MVP | Spec 6.2 |
| PII tokenization for calendar data | Storage designed to support it, scanner deferred | Story 6-3 | project-context.md line 477 |

### Test Commit Record

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| | | |

### File List

(To be populated during implementation)
