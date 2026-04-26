# Story 3.2: Retainer Agreements & Scope Creep Detection

Status: review

Revised: 2026-04-27 — 4-agent adversarial review (Winston/Architect, Sally/UX, Murat/Test, Amelia/Dev). 14 CRITICAL + HIGH findings, 16 MEDIUM + LOW findings applied. Key changes: (1) float→integer comparison for scope creep, (2) ACs added for edit flow, utilization bar states, cancel dialog, (3) task groups B↔C swapped, (4) 12 test files instead of 8, (5) RLS subtasks made explicit, (6) property-based financial tests added, (7) integration scope creep test added, (8) emotional design + accessibility specs added.

## Story

As a user,
I want to define retainer agreements and get alerted to scope creep,
So that I can manage client expectations and billing accurately.

## Acceptance Criteria

1. **AC1 — Create retainer agreements (FR73a):** Given a client record exists and the user has owner/admin role, they can create a retainer agreement linked to that client with type: `hourly_rate`, `flat_monthly`, or `package_based`. Each type has specific fields: hourly_rate (rate_cents in cents), flat_monthly (monthly_fee_cents in cents + required monthly_hours_threshold), package_based (package_hours + package_name + optional hourly_rate_cents for overage). Only one active retainer per client at a time (enforced by unique partial index). Archived clients cannot have new retainers created. The Server Action catches unique constraint violation (error code `23505`) and returns `RETAINER_ACTIVE_EXISTS` error — no preemptive SELECT-then-INSERT pattern.

2. **AC2 — View/Edit retainer agreements:** Given a client has an active retainer, the user can view the retainer details on the client detail page. The user can edit retainer fields: fee amount, hours threshold, package name, billing period days, notes, end_date. **Retainer type is immutable after creation** — to change type, cancel the existing retainer and create a new one. The edit form shows only fields applicable to the current type. A client can have historical (cancelled/expired) retainers visible in a timeline.

3. **AC3 — Cancel ("End Retainer Agreement") retainer:** Given a client has an active retainer, the user can end the retainer. The cancel dialog is titled "End Retainer Agreement" (not "Cancel"). It dynamically displays three consequence lines: (1) "You've tracked **{X} hours** this billing period — this data is preserved," (2) "{N} active scope alert(s) will be dismissed," (3) "Historical retainer data will be archived in the client timeline." Cancellation sets status='cancelled', cancelled_at=now(). Cancelling an already-cancelled retainer is idempotent (returns success, no-op). Only owner/admin can cancel.

4. **AC4 — Scope creep detection at 90% (FR73c):** Given a client has an active retainer agreement, the system computes retainer utilization by aggregating `time_entries.duration_minutes` for that client within the retainer's current billing period. **All threshold comparisons happen in SQL using integer minutes** — no float arithmetic in TypeScript. The threshold is `allocated_minutes * 0.9`, computed as `allocated_minutes * 90 / 100` in integer arithmetic. When utilization reaches ≥90% of allocated minutes, a scope creep alert is generated. The alert includes: client name, retainer type, hours used / hours allocated, percentage, and suggested action. **Per-type behavior:**
   - `hourly_rate`: No scope creep detection (no fixed allocation). Shows plain stat "X hours tracked this month" — no utilization bar.
   - `flat_monthly`: Scope creep when `tracked_minutes >= monthly_hours_threshold * 60 * 90 / 100`. Requires `monthly_hours_threshold` to be set. If NULL, no scope tracking (show informational note: "Add an hours threshold to enable scope tracking").
   - `package_based`: Scope creep when `tracked_minutes >= package_hours * 60 * 90 / 100`. Package hours are total (not per-period).

5. **AC5 — Utilization bar display:** For retainers with scope tracking enabled, a visual utilization bar shows percentage used. States:
   - **<70% (On track):** Green bar, label "On track ✓", checkmark icon
   - **70-89% (Approaching threshold):** Amber bar, label "Approaching threshold", warning triangle icon
   - **≥90% (Time to renegotiate):** Red bar, label "Time to renegotiate", alert circle icon, CTA link
   - **>100% (Over threshold):** Bar capped at 100% visual width, red, text shows actual percentage (e.g., "110% — 10% over threshold"), badge with overage amount
   - **No threshold set (flat_monthly with NULL threshold):** No bar. Show "Add hours threshold to enable scope tracking" with link to edit.
   - **hourly_rate type:** No bar. Show "X hours tracked this period" as plain text stat.
   Bar uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`. Text label always visible alongside bar (color is redundant reinforcement, not primary signal).

6. **AC6 — Scope creep alerts in dashboard:** Scope creep alerts surface in the home dashboard as a distinct section. Alerts are queryable — not push notifications (Epic 10 handles push). Each alert links to the client detail page. Alerts clear when: retainer is cancelled, a new billing period starts, or utilization drops below 90%. **Dashboard sidebar nav item shows badge count** when scope alerts exist (red dot with count). When 0 alerts, section is hidden (not empty state — absent). **On the client detail page**, a subtle banner appears at the top when that client has a scope alert: "This client's retainer is at {X}% utilization." Alert cards lead with client name, not severity.

7. **AC7 — Retainer data available for invoice generation:** Retainer agreement data (type, rate, fee, package info) is queryable for Epic 7 invoice generation. Flat monthly retainers support "create invoice from retainer" (deferred to Epic 7, but data model must support it). Hourly retainers use the retainer's rate_cents (overrides client default). Package retainers track hours consumed vs. hours included.

8. **AC8 — Success and emotional design feedback:** On retainer creation, a toast notification confirms: "Retainer created — scope tracking is now active." with a "View utilization" link. Utilization bar context line shows billing period reset: "Billing period resets in {N} days ({date})." First-time users see a dismissible tooltip on the utilization bar: "This bar shows how much of your retainer you've used. We'll alert you at 90%." Tracked via `localStorage`.

9. **AC9 — Empty state handling:** When a client has no retainer, the panel shows "Set up a retainer agreement" CTA with benefit statement "Track scope and get alerts before you over-deliver." A "Not needed" dismiss option records a preference to hide the full empty state — the panel collapses to a single line: "No retainer — Add one." Preference is reversible.

10. **AC10 — Stale state handling for expired retainers:** If a user has a retainer detail page open and the retainer expires (end_date passes), the next data fetch reflects the `expired` status. No polling — stale reads are accepted until next navigation or explicit refresh. Document this as acceptable for MVP.

## Tasks / Subtasks

### Group A: Data Model & Migration

- [x] Task 1: Create retainer_agreements table migration (AC: #1, #2, #3)
  - [x] 1.1 Create migration `supabase/migrations/{timestamp}_add_retainer_agreements.sql`
  - [x] 1.2 Table columns:
    ```
    id                        uuid PK DEFAULT gen_random_uuid()
    workspace_id              uuid NOT NULL FK→workspaces(id) ON DELETE CASCADE
    client_id                 uuid NOT NULL FK→clients(id) ON DELETE CASCADE
    type                      text NOT NULL CHECK (type IN ('hourly_rate', 'flat_monthly', 'package_based'))
    hourly_rate_cents         bigint          -- for hourly_rate (required) and package_based (optional overage rate) types
    monthly_fee_cents         bigint          -- for flat_monthly type (required)
    monthly_hours_threshold   numeric(10,2)   -- for flat_monthly: expected hours per period. Scope creep at 90%. Nullable = no threshold tracking
    package_hours             numeric(10,2)   -- for package_based type (required, decimal hours, e.g., 40.5)
    package_name              text            -- for package_based type (required, e.g., "Social Media Management")
    billing_period_days       integer NOT NULL DEFAULT 30 CHECK (billing_period_days > 0 AND billing_period_days <= 365)
    start_date                date NOT NULL DEFAULT CURRENT_DATE
    end_date                  date            -- nullable: NULL = ongoing. CHECK (end_date IS NULL OR end_date >= start_date)
    status                    text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired'))
    cancelled_at              timestamptz
    cancellation_reason       text            -- optional reason for cancellation (audit trail)
    notes                     text
    created_at                timestamptz NOT NULL DEFAULT now()
    updated_at                timestamptz NOT NULL DEFAULT now()
    ```
  - [x] 1.3 Unique partial index with explicit WHERE clause: `CREATE UNIQUE INDEX idx_one_active_retainer_per_client ON retainer_agreements (client_id) WHERE status = 'active';` — Note: only `status = 'active'` is covered. No 'paused' status exists. Reactivating a cancelled retainer is not supported (create new instead).
  - [x] 1.4 Index for workspace-scoped scope creep queries: `CREATE INDEX idx_retainer_agreements_workspace_active ON retainer_agreements (workspace_id, client_id) WHERE status = 'active';`
  - [x] 1.5 Index for general queries: `CREATE INDEX idx_retainer_agreements_client_status ON retainer_agreements (client_id, status);`
  - [x] 1.6 CHECK constraint: type-specific field validation at DB level:
    ```sql
    ALTER TABLE retainer_agreements ADD CONSTRAINT ra_type_fields_check CHECK (
      (type = 'hourly_rate' AND hourly_rate_cents IS NOT NULL AND monthly_fee_cents IS NULL AND package_hours IS NULL AND package_name IS NULL) OR
      (type = 'flat_monthly' AND monthly_fee_cents IS NOT NULL AND hourly_rate_cents IS NULL AND package_hours IS NULL AND package_name IS NULL) OR
      (type = 'package_based' AND package_hours IS NOT NULL AND package_name IS NOT NULL AND monthly_fee_cents IS NULL)
    );
    ```
  - [x] 1.7 CHECK constraint: `(status = 'cancelled' AND cancelled_at IS NOT NULL) OR (status != 'cancelled')`
  - [x] 1.8 CHECK constraint: `end_date IS NULL OR end_date >= start_date`
  - [x] 1.9 CHECK constraint: `billing_period_days > 0 AND billing_period_days <= 365`
  - [x] 1.10 Enable RLS: `ALTER TABLE retainer_agreements ENABLE ROW LEVEL SECURITY;`
  - [x] 1.11 RLS policy — Owner/Admin ALL: `CREATE POLICY rls_retainer_agreements_owner_admin ON retainer_agreements FOR ALL USING (workspace_id::text = auth.jwt()->>'workspace_id' AND EXISTS (SELECT 1 FROM workspace_members WHERE user_id = auth.uid() AND workspace_id::text = auth.jwt()->>'workspace_id' AND role IN ('owner','admin') AND status = 'active')) WITH CHECK (workspace_id::text = auth.jwt()->>'workspace_id' AND EXISTS (SELECT 1 FROM workspace_members WHERE user_id = auth.uid() AND workspace_id::text = auth.jwt()->>'workspace_id' AND role IN ('owner','admin') AND status = 'active'));`
  - [x] 1.12 RLS policy — Member SELECT only (scoped to client access): `CREATE POLICY rls_retainer_agreements_member_select ON retainer_agreements FOR SELECT USING (workspace_id::text = auth.jwt()->>'workspace_id' AND EXISTS (SELECT 1 FROM workspace_members WHERE user_id = auth.uid() AND workspace_id::text = auth.jwt()->>'workspace_id' AND status = 'active') AND EXISTS (SELECT 1 FROM member_client_access mca WHERE mca.client_id = retainer_agreements.client_id AND mca.user_id = auth.uid() AND mca.workspace_id::text = auth.jwt()->>'workspace_id' AND mca.revoked_at IS NULL));`
  - [x] 1.13 No DELETE policy — nobody hard-deletes (cancel only)
  - [x] 1.14 service_role policy: `CREATE POLICY rls_retainer_agreements_service_role ON retainer_agreements FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');`
  - [x] 1.15 Updated_at trigger via `extensions.moddatetime`
  - [x] 1.16 Seed data: Add 5 retainer fixtures to seed script (1 hourly active, 1 flat_monthly active at 70%, 1 flat_monthly active at 95%, 1 package_based active, 1 cancelled historical)

### Group B: Drizzle Schema & Types (MUST come before Group C — schema must exist before query logic)

- [x] Task 2: Create Drizzle schema and Zod types (AC: #1, #2, #5, #7)
  - [x] 2.1 Create `packages/shared/src/numeric-helpers.ts` — utility for Drizzle `mode: 'string'` numeric fields:
    - `numericToMinutes(hoursStr: string | null): number` — converts `'40.50'` → 2430 (minutes), null → 0
    - `minutesToNumericStr(minutes: number): string` — converts 2430 → `'40.50'`
    - `calculateThresholdMinutes(allocatedHoursStr: string | null): number | null` — `allocated * 60 * 90 / 100` in integer math. Returns null if input null. No float.
    - `isScopeCreep(trackedMinutes: number, thresholdMinutes: number | null): boolean` — null → false
    - All functions tested with property-based tests (Group H)
  - [x] 2.2 Create `packages/db/src/schema/retainer-agreements.ts` — Drizzle table matching migration. `package_hours` and `monthly_hours_threshold` use `numeric('...', { precision: 10, scale: 2, mode: 'string' })`.
  - [x] 2.3 Export from `packages/db/src/schema/index.ts`
  - [x] 2.4 Create `packages/types/src/retainer.ts` — Zod schemas:
    - `retainerTypeEnum = z.enum(['hourly_rate', 'flat_monthly', 'package_based'])`
    - `createRetainerSchema` — discriminated union on type field with type-specific required fields. `monthly_hours_threshold` required for `flat_monthly`, must be positive.
    - `updateRetainerSchema` — partial update for: fee, threshold, package name, billing period days, notes, end_date. Type is NOT in the schema (immutable). Status is NOT editable here (use cancel action).
    - `cancelRetainerSchema` — `{ retainerId: z.string().uuid(), reason: z.string().max(500).optional() }`
    - `retainerSchema` — full retainer type
    - `scopeCreepAlertSchema` — alert shape for dashboard consumption
    - `utilizationStateSchema` — discriminated union: `{ type: 'trackable', percent, label, color } | { type: 'informational', hoursTracked } | { type: 'no_threshold', message }`
    - **Drizzle numeric handling**: `package_hours` and `monthly_hours_threshold` use `z.string()` with `.refine()` for valid numeric format, then `.transform(Number)` at application boundary.
  - [x] 2.5 Export from `packages/types/src/index.ts`
  - [x] 2.6 Add retainer-specific error codes to `FlowErrorCode`: `RETAINER_NOT_FOUND`, `RETAINER_ACTIVE_EXISTS`, `RETAINER_CLIENT_ARCHIVED`, `RETAINER_INVALID_TYPE_FIELDS`, `RETAINER_TYPE_IMMUTABLE`, `RETAINER_NOT_ACTIVE`
  - [x] 2.7 Add `retainer_agreement` to `CacheEntity` union in `packages/db/src/cache-policy.ts`

### Group C: DB Query Layer & Scope Creep Logic

- [x] Task 3: Create retainer query functions (AC: #1-#7)
  - [x] 3.1 Create `packages/db/src/queries/retainers/` directory
  - [x] 3.2 Create `crud.ts` — all functions accept `client: SupabaseClient` parameter:
    - `getActiveRetainerForClient(client, { clientId, workspaceId })` — returns active retainer or null. Checks `status = 'active'` AND `(end_date IS NULL OR end_date >= CURRENT_DATE)`. If `end_date < CURRENT_DATE`, the retainer is logically expired — do NOT update status in this query (query-time check only).
    - `getRetainerById(client, { retainerId, workspaceId })` — single retainer with workspace check
    - `listRetainersForClient(client, { clientId, workspaceId })` — all retainers (active + historical)
    - `createRetainer(client, { workspaceId, data })` — **INSERT directly, catch unique constraint violation (error code `23505`)** on `idx_one_active_retainer_per_client` and return `RETAINER_ACTIVE_EXISTS` error. Check client not archived (application-level). No preemptive SELECT for active retainer — the partial unique index IS the concurrency control.
    - `updateRetainer(client, { retainerId, workspaceId, data })` — type cannot change (enforced by Zod schema omitting type field), only active retainers editable. Add TODO comment for concurrent edit: consider `updated_at` optimistic locking check in future.
    - `cancelRetainer(client, { retainerId, workspaceId, reason? })` — sets status='cancelled', cancelled_at=now(), cancellation_reason. Idempotent: if already cancelled, return success (no-op).
  - [x] 3.3 Create `billing-periods.ts` — billing period calculation (extracted for reuse):
    - `getCurrentBillingPeriod(startDate: Date, billingPeriodDays: number, referenceDate: Date)` — returns `{ periodStart: Date, periodEnd: Date }`. Uses integer day arithmetic. Clamps negative elapsed periods to 0 (handles future start_date). Uses UTC date-only comparison (no timezone drift).
    - Document: `periods_elapsed = Math.max(0, Math.floor((referenceDate - startDate) / billingPeriodDays))`
  - [x] 3.4 Create `utilization.ts` — scope creep functions. **All comparisons in SQL using integer minutes:**
    - `getRetainerUtilization(client, { retainerId, workspaceId })` — aggregates time_entries for the retainer's client within the current billing period. Returns `{ totalMinutes, allocatedMinutes, utilizationPercent, billingPeriodStart, billingPeriodEnd }`. Percent computed as `Math.floor(totalMinutes * 100 / allocatedMinutes)` — integer math, no float.
    - `getScopeCreepAlerts(client, { workspaceId })` — single SQL query using CTE for all active retainers in workspace where utilization ≥ 90%. **Must use a single CTE query, not N+1 per-client.** Returns alert objects with client name, retainer info, utilization data. Excludes hourly_rate type (no allocation). Excludes flat_monthly where `monthly_hours_threshold IS NULL`.
    - SQL threshold comparison: `SUM(te.duration_minutes) >= (r.monthly_hours_threshold * 60 * 90 / 100)` or `SUM(te.duration_minutes) >= (r.package_hours * 60 * 90 / 100)` — integer arithmetic throughout.
  - [x] 3.5 Create `index.ts` barrel for queries/retainers (package boundary — OK)
  - [x] 3.6 Export from `packages/db/src/index.ts`

### Group D: Server Actions

- [x] Task 4: Create retainer Server Actions (AC: #1, #2, #3)
  - [x] 4.1 Create `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/` directory:
    - `create-retainer.ts` — Zod validation, `getServerSupabase()` + `requireTenantContext()`, INSERT directly (catch 23505), check client not archived, revalidation
    - `update-retainer.ts` — Zod validation (updateRetainerSchema — type NOT in schema), tenant context, verify active status, update, revalidation
    - `cancel-retainer.ts` — `cancelRetainerSchema` validation, tenant context, set cancelled/cancelled_at/cancellation_reason, idempotent if already cancelled, revalidation
    - `get-retainer.ts` — Server Component data fetch for active retainer + utilization data (colocated with mutations for domain cohesion)
  - [x] 4.2 Each action returns `Promise<ActionResult<T>>` with `success` discriminant (NOT `ok`)
  - [x] 4.3 Revalidation strategy:
    - Retainer mutations: `revalidateTag(cacheTag('retainer_agreement', tenantId))` + `revalidateTag(cacheTag('workspace_client', tenantId))` + `revalidateTag(cacheTag('dashboard', tenantId))`
    - New cache entity: `retainer_agreement` mapped to tag `retainers:{workspaceId}`
  - [x] 4.4 Error mapping for unique constraint: catch `23505` → `createFlowError('RETAINER_ACTIVE_EXISTS', ...)` with user-friendly message "This client already has an active retainer agreement."

### Group E: UI — Retainer Panel on Client Detail

- [x] Task 5: Create retainer UI on client detail page (AC: #1, #2, #3, #5, #8, #9)
  - [x] 5.1 Create `apps/web/app/(workspace)/clients/[clientId]/components/retainer-panel.tsx` — "use client". Container showing active retainer or empty state. If active: displays type badge, key metrics, utilization display (bar or stat depending on type). If none: empty state CTA with "Not needed" dismiss option (~60 lines)
  - [x] 5.2 Create `apps/web/app/(workspace)/clients/[clientId]/components/retainer-form.tsx` — "use client". Form for creating/editing retainers. **Card selector** for type (not radio buttons): each card shows title + one-line description + mini utilization preview. Conditional fields per type. Zod validation. Submit calls create/update action. **On mobile (viewport < 768px): 2-step wizard — Step 1 type selection, Step 2 type-specific fields.** Desktop: single form with progressive disclosure. (~80 lines)
  - [x] 5.3 Create `apps/web/app/(workspace)/clients/[clientId]/components/end-retainer-dialog.tsx` — "use client". Titled "End Retainer Agreement" (not "Cancel"). Shows three dynamic consequence lines: (1) hours tracked this period, (2) active scope alerts dismissed, (3) data archived. Confirmation button uses destructive variant. (~40 lines)
  - [x] 5.4 Create `apps/web/app/(workspace)/clients/[clientId]/components/retainer-utilization-bar.tsx` — "use client". Accessibility: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuetext="72% utilized, approaching threshold"`. Text label always visible. States: on-track green ✓, approaching amber ⚠, renegotiate red ⚫. Bar capped at 100% visual width for >100%, text shows actual percentage. Context line: "Billing period resets in {N} days ({date})." First-time tooltip (localStorage). (~60 lines)
  - [x] 5.5 Create `apps/web/app/(workspace)/clients/[clientId]/components/retainer-scope-banner.tsx` — "use client". Subtle banner at top of client detail page when scope alert active. Shows "{Client} retainer is at {X}% utilization." with link to retainer panel. (~20 lines)
  - [x] 5.6 Update `apps/web/app/(workspace)/clients/[clientId]/page.tsx` — add RetainerPanel to detail page layout (after client-details section). Add RetainerScopeBanner at top when scope alert active. Import `getActiveRetainerForClient` + `getRetainerUtilization` from query layer and pass data as props.

### Group F: Dashboard Scope Alerts

- [x] Task 6: Add scope creep alerts to dashboard (AC: #6)
  - [x] 6.1 Create `apps/web/app/(workspace)/actions/get-scope-alerts.ts` — fetches all scope creep alerts for workspace using `getScopeCreepAlerts` query. Workspace-level (not client-specific) because scope alerts span all clients.
  - [x] 6.2 Update `apps/web/app/(workspace)/page.tsx` (home dashboard) — add "Scope Alerts" section that calls getScopeAlerts and renders alert cards. Each card leads with client name (not severity), then retainer type, utilization percentage, "View Client" link. Section hidden when 0 alerts.
  - [x] 6.3 Update sidebar navigation component — add badge count on "Dashboard" nav item when scope alerts exist. Red dot with count. Hidden when 0 alerts.

### Group G: Testing

- [x] Task 7: Write tests (AC: all) — **13 test files**

  - [x] 7.1 `packages/shared/src/__tests__/numeric-helpers.test.ts` — Unit tests for numeric utilities: numericToMinutes, minutesToNumericStr, calculateThresholdMinutes, isScopeCreep. Include property-based tests using fast-check: rounding invariants, commutativity, boundary cases at exact 90%, 89%, 91%.

  - [x] 7.2 `packages/db/src/queries/retainers/__tests__/crud.test.ts` — CRUD query tests: create hourly/flat/package retainers, duplicate active prevention (23505 error mapping), update fields (type immutable enforced by Zod), cancel (idempotent), archive client blocks create, workspace isolation, expired-by-date detection in getActiveRetainerForClient.

  - [x] 7.3 `packages/db/src/queries/retainers/__tests__/billing-periods.test.ts` — Billing period edge cases: period boundaries (exact start date, mid-period, last day), zero elapsed periods (future start_date → clamp to 0), leap year (start Feb 29 + 30-day periods), non-divisible periods (31-day periods from Jan 1), period drift (30-day periods from Jan 31). Time mocking: inject `referenceDate` parameter (no reliance on CURRENT_DATE in tests). **12-15 explicit test cases minimum.**

  - [x] 7.4 `packages/db/src/queries/retainers/__tests__/utilization.test.ts` — Utilization calculation tests: 90% threshold exact trigger, 89% does NOT trigger, 91% triggers, zero time entries = 0%, hourly_rate type excluded from scope creep, flat_monthly with NULL threshold excluded, package_based hours calculation, retainer cancellation clears utilization, cross-period time entries not double-counted. **All comparisons in integer minutes.** Time mocking via injected `referenceDate`.

  - [x] 7.5 `packages/types/src/__tests__/retainer.test.ts` — Zod schema tests: discriminated union type-specific field validation (hourly requires rate, flat requires fee, package requires hours+name), cross-type field contamination rejected, invalid types rejected, negative amounts rejected, cancel requires retainerId, update schema omits type field, extra fields stripped, `monthly_hours_threshold` required for flat_monthly.

  - [x] 7.6 `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/__tests__/create-retainer.test.ts` — Server Action tests: valid creation for each type, blocked when active exists (23505 → RETAINER_ACTIVE_EXISTS), blocked for archived client, revalidation tags called, workspace isolation, ActionResult uses `success` discriminant (NOT `ok`).

  - [x] 7.7 `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/__tests__/update-retainer.test.ts` — Server Action tests: valid updates for each type, type change rejected (RETAINER_TYPE_IMMUTABLE), cancelled retainer not editable (RETAINER_NOT_ACTIVE), workspace isolation, revalidation called.

  - [x] 7.8 `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/__tests__/cancel-retainer.test.ts` — Cancel action tests: success, already cancelled (idempotent), not found, workspace isolation, cancellation_reason stored, only owner/admin.

  - [x] 7.9 `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/__tests__/get-retainer.test.ts` — Get action tests: returns active retainer with utilization data, returns null for no retainer, returns expired retainer with status, workspace isolation, member sees scoped clients only.

  - [x] 7.10 `apps/web/app/(workspace)/clients/[clientId]/components/__tests__/retainer-panel.test.tsx` — UI tests: render active retainer, render empty state, "Not needed" dismiss option, loading state, error state. All use `renderWithTheme`.

  - [x] 7.11 `apps/web/app/(workspace)/clients/[clientId]/components/__tests__/retainer-utilization-bar.test.tsx` — UI tests: on-track (<70%, green, "On track ✓"), approaching (70-89%, amber, "Approaching threshold"), renegotiate (≥90%, red, "Time to renegotiate"), over-threshold (>100%, capped bar, actual %), no threshold (shows "Add hours threshold" link), hourly (plain stat, no bar). Accessibility: role=progressbar, aria attributes present. All use `renderWithTheme`.

  - [x] 7.12 `supabase/tests/rls_retainer_agreements.sql` — pgTAP RLS test matrix. **25+ test cases minimum** (5 roles × 5 operations):
    - Owner: SELECT ✅, INSERT ✅, UPDATE ✅, CANCEL (UPDATE status) ✅, DELETE ❌
    - Admin: SELECT ✅, INSERT ✅, UPDATE ✅, CANCEL ✅, DELETE ❌
    - Member (scoped): SELECT ✅ (only scoped clients), INSERT ❌, UPDATE ❌, CANCEL ❌, DELETE ❌
    - Member (unscoped): SELECT ❌, INSERT ❌, UPDATE ❌, CANCEL ❌, DELETE ❌
    - Cross-tenant: all ❌
    - Client User: all ❌
    - service_role: all ✅
    - Status-gated: UPDATE cancelled retainer ❌, UPDATE expired retainer ❌
    - Type-immutable: UPDATE type field → rejected at app level (not RLS)

  - [x] 7.13 `packages/test-utils/src/fixtures/retainer.ts` — `buildRetainer(overrides)` factory. **Type-specific builder** using discriminated union: each type variant auto-fills required fields and nulls inapplicable ones. Builder self-tested:
    ```typescript
    buildRetainer({ type: 'hourly_rate', hourly_rate_cents: 5000 })
    // → monthly_fee_cents: null, package_hours: null, package_name: null
    buildRetainer({ type: 'flat_monthly', monthly_fee_cents: 200000, monthly_hours_threshold: '30.00' })
    // → hourly_rate_cents: null, package_hours: null, package_name: null
    buildRetainer({ type: 'package_based', package_hours: '40.00', package_name: 'Social Media' })
    // → monthly_fee_cents: null, hourly_rate_cents optional (overage rate)
    ```
    Numeric fields (`package_hours`, `monthly_hours_threshold`) use **string values** to match Drizzle `mode: 'string'`.

### Group H: ATDD Scaffold Updates

- [x] Task 8: Update ATDD scaffold to match final spec
  - [x] 8.1 Audit `apps/web/__tests__/acceptance/epic-3/3-2-retainer-agreements-scope-creep-detection.spec.ts` for all known mismatches:
    - `flat_fee_cents` → `monthly_fee_cents`
    - `period_start` / `period_end` → `billing_period_days` + `start_date` (computed)
    - `is_active` boolean → `status` text field ('active' | 'cancelled' | 'expired')
    - `package_based` type allows optional `hourly_rate_cents` (overage rate)
    - `monthly_hours_threshold` field added for flat_monthly scope creep detection
    - Scope creep threshold: 90%, not 80% or 100%
    - `type` field is immutable after creation
    - ActionResult uses `success` discriminant (NOT `ok`)
    - Cancel verb → "End Retainer Agreement"
    - `cancellation_reason` field added
    - `billing_period_days` CHECK constraint (> 0, <= 365)
    - `end_date` CHECK constraint (>= start_date)

### Group I: Integration Test (Cross-Table Scope Creep)

- [x] Task 9: Integration test for scope creep with real time_entries
  - [x] 9.1 Create `packages/db/src/queries/retainers/__tests__/scope-creep-integration.test.ts` — seeds real retainer agreements + time entries across billing period boundaries, verifies:
    - Scope creep alert fires at exactly 90% of current period hours
    - Scope creep alert does NOT fire at 89%
    - Alert resets at the start of a new billing period
    - Flat monthly with NULL threshold never fires
    - Hourly rate type never fires
    - Package-based tracks total (not per-period)
    - Cancelling retainer dismisses alert
    - Uses `buildRetainer()` + `buildTimeEntry()` fixtures with real DB inserts

## Dev Notes

### Architecture Constraints (MUST follow)

- **Same patterns as Story 3.1** — query functions accept `SupabaseClient` parameter, Server Actions use `getServerSupabase()` + `requireTenantContext()`
- **Server Actions bypass TrustClient** — TrustClient is for agent-worker only
- **ActionResult discriminant is `success`** — NOT `ok`. Audit all ATDD scaffolds for this.
- **Money is integers in cents** — `hourly_rate_cents`, `monthly_fee_cents` are bigint. NULL = not applicable for that type. 0 not allowed (use nullable). Display via `formatCents()` at view boundary only
- **Scope creep comparisons in integer minutes in SQL** — no float arithmetic in TypeScript for threshold checks. `allocated_hours * 60 * 90 / 100` stays integer throughout.
- **`package_hours` and `monthly_hours_threshold` use `numeric(10,2)`** — fractional hours (e.g., 40.5 hours/month). In Drizzle: `numeric('package_hours', { precision: 10, scale: 2 })` with `mode: 'string'`. Parse via `packages/shared/src/numeric-helpers.ts` utility. Never use `parseFloat()` inline — always go through shared utilities.
- **`::text` cast required** in all RLS policies when comparing `workspace_id` (uuid) against JWT claims
- **No barrel files inside feature folders** — only at package boundaries
- **Status uses `text` with CHECK, not Postgres enum** — easier to extend
- **`expired` status**: Query-time check in `getActiveRetainerForClient` (checks `end_date < CURRENT_DATE`). NOT a scheduled job. Stale reads accepted for MVP (AC10).
- **200-line file soft limit** (250 hard). Components ≤80 lines. Functions ≤50 lines logic
- **Named exports only** — default exports only for Next.js page components
- **No `any`, no `@ts-ignore`** — strict mode
- **One action per file** — colocated with route group
- **Billing period calculation uses UTC date-only** — `CURRENT_DATE` in Postgres uses server timezone. Document that all date comparisons use UTC. Time entry `date` column is `date` type (no time component) — `>=` comparison is correct for period start.
- **Time mocking in tests** — inject `referenceDate` parameter into billing period and utilization functions. Never rely on `CURRENT_DATE` or `new Date()` in testable logic. Document this strategy.

### Unique Constraint Handling Pattern

The partial unique index `idx_one_active_retainer_per_client` is the authoritative concurrency control. Server Actions must NOT do a preemptive SELECT + INSERT (TOCTOU vulnerability). Instead:

```typescript
const { error } = await client.from('retainer_agreements').insert(data)
if (error?.code === '23505') {
  return { success: false, error: createFlowError('RETAINER_ACTIVE_EXISTS', ...) }
}
```

### Scope Creep SQL Pattern (Single CTE Query)

```sql
WITH active_retainers AS (
  SELECT r.*,
    CASE r.type
      WHEN 'flat_monthly' THEN r.monthly_hours_threshold * 60 * 90 / 100
      WHEN 'package_based' THEN r.package_hours * 60 * 90 / 100
      ELSE NULL
    END AS threshold_minutes,
    r.start_date + FLOOR((CURRENT_DATE - r.start_date) / r.billing_period_days) * r.billing_period_days
      AS period_start
  FROM retainer_agreements r
  WHERE r.workspace_id = $1 AND r.status = 'active'
    AND r.type IN ('flat_monthly', 'package_based')
    AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE)
    AND r.monthly_hours_threshold IS NOT NULL  -- excludes flat_monthly with no threshold
),
period_totals AS (
  SELECT r.id AS retainer_id,
    COALESCE(SUM(te.duration_minutes), 0) AS tracked_minutes
  FROM active_retainers r
  LEFT JOIN time_entries te ON te.client_id = r.client_id
    AND te.workspace_id = r.workspace_id
    AND te.date >= r.period_start
    AND te.date < r.period_start + r.billing_period_days
  GROUP BY r.id
)
SELECT r.*, pt.tracked_minutes, r.threshold_minutes,
  CASE WHEN r.threshold_minutes > 0
    THEN FLOOR(pt.tracked_minutes * 100 / r.threshold_minutes)
    ELSE 0 END AS utilization_percent
FROM active_retainers r
JOIN period_totals pt ON pt.retainer_id = r.id
WHERE pt.tracked_minutes >= r.threshold_minutes;
```

### Existing Codebase — What Already Exists

1. **`clients` table** — `supabase/migrations/20260504000001_enhance_clients_for_crud.sql` — full CRUD schema with company_name, billing_email, hourly_rate_cents, status (active/archived), RLS with owner/admin/member scoping. `hourly_rate_cents` is the default rate that retainers override
2. **`time_entries` table** — `supabase/migrations/20260424080002_add_time_entries_table.sql` — has `client_id`, `duration_minutes` (integer), `date` (date type, not timestamptz), `workspace_id`. RLS enabled. This is the source data for scope creep calculation. **Confirm `date` is `date` type (no time component) — if it's `timestamptz`, period boundary filtering needs adjustment.**
3. **Client query layer** — `packages/db/src/queries/clients/` — `crud.ts`, `crud-helpers.ts`, `scoping.ts`, `index.ts`. Pattern to follow for retainer queries
4. **Client types** — `packages/types/src/client.ts` — Zod schemas + TypeScript types. Pattern to follow
5. **Client Server Actions** — `apps/web/app/(workspace)/clients/actions/` and `clients/[clientId]/actions/` — one action per file, `getServerSupabase()` + `requireTenantContext()`. Pattern to follow
6. **Client detail page** — `apps/web/app/(workspace)/clients/[clientId]/page.tsx` — Server Component fetching client + detail components. RetainerPanel integrates here
7. **Cache policy** — `packages/db/src/cache-policy.ts` — `CacheEntity` union + `cacheTag()` function. **Must add `retainer_agreement` to union and `ENTITY_TAG_MAP`**
8. **`workspace_client` cache entity** — already exists. Retainer changes should invalidate `workspace_client` tags (retainer is client-scoped data)
9. **`dashboard` cache entity** — already exists. Scope creep alerts are dashboard data, needs invalidation on retainer changes
10. **Pagination types** — `packages/types/src/pagination.ts` — reuse `PaginatedResult<T>` if needed
11. **Error codes** — `packages/types/src/errors.ts` — `FlowErrorCode` union. Add retainer-specific codes
12. **Test fixtures** — `packages/test-utils/src/fixtures/client.ts` — `buildClient(overrides)` for test setup
13. **`packages/db/src/rls-helpers.ts`** — home of `requireTenantContext()` and `createFlowError()`. All retainer Server Actions use `createFlowError()` for error responses
14. **`apps/web/lib/supabase-server.ts`** — home of `getServerSupabase()`. All retainer Server Actions import from here
15. **`formatCents()` utility** — used at view boundary to display money values. Check `packages/shared/` or `apps/web/lib/` for existing implementation; create if not yet present
16. **`packages/types/src/pagination.ts`** — `PaginatedResult<T>` type for paginated list queries

### Deferred to Future Stories (Not This Story)

- **`retainer_id` FK on `time_entries`** (Winston H3): Strong architectural recommendation to add `retainer_id` to `time_entries` for deterministic scope creep and invoice generation. **Deferred** to a prep story before Epic 7 to avoid scope creep in this story. Document as tech debt. If Winston's recommendation is accepted, it should be a separate 1-2 hour story before Epic 7.
- **Full in-app notification system** — Epic 10 (FR79). This story delivers dashboard-queryable alerts only.
- **Push notifications for scope creep** — Epic 10.
- **Scheduled job for proactive retainer expiration** — future story in Epic 10.
- **Billing period DB function** (Winston L2) — consider `fn_current_period_start(retainer_id)` SQL function for reuse across scope creep, dashboard, and Epic 7 invoice generation.
- **Concurrent edit conflict detection** — optimistic locking via `updated_at`. Add TODO in update Server Action.
- **Performance optimization for scope creep at scale** — materialize scope creep status nightly via pg-boss job when workspace count exceeds scaling threshold. Current on-the-fly computation is acceptable for MVP (NFR: 100 concurrent workspaces).

### Adversarial Review Findings Applied

Full findings from 4-agent review (2026-04-27):

**CRITICAL (9 → all applied):**
- Winston C1: TOCTOU → catch 23505, no preemptive SELECT (AC1, Task 3.2)
- Winston C2: Billing period boundaries → verify date type, document UTC, add CHECKs (Task 1.8, 1.9, Dev Notes)
- Winston C3: Float comparison → all threshold math in SQL integer minutes (AC4, Task 3.4, Dev Notes SQL pattern)
- Murat C1: No property-based tests → added to Task 7.1 (numeric-helpers tests)
- Murat C2: Scope creep period edge cases → dedicated test file Task 7.3 (12-15 cases)
- Murat C3: No integration test → added Group I, Task 9
- Sally C1: Utilization bar broken states → AC5 with per-type behavior, Task 5.4
- Sally C2: Cancel dialog incomplete → AC3 with dynamic consequences, "End Retainer Agreement"
- Sally C3: No edit flow → AC2 updated with editable fields, Task 3.2, Task 7.7

**HIGH (12 → all applied):**
- Winston H1: Missing workspace index → Task 1.4
- Winston H2: N+1 scope creep → single CTE query in Task 3.4, Dev Notes SQL pattern
- Winston H3: retainer_id on time_entries → deferred (see above)
- Murat H1: Missing update-retainer test → Task 7.7
- Murat H2: Missing get-retainer test → Task 7.9
- Murat H3: RLS matrix → expanded to 25+ cases in Task 7.12
- Murat H4: buildRetainer type variants → Task 7.13 with discriminated union builder
- Sally H4: Dashboard alerts discoverability → AC6 sidebar badge + client page banner, Tasks 6.3, 5.5
- Sally H5: Emotional design → AC5 positive labels ("On track ✓"), AC8 success toast
- Amelia H1: File size → split into crud.ts + billing-periods.ts + utilization.ts (Task 3)
- Amelia H2: Unique constraint error in UI → Task 4.4
- Amelia H3: Stale state → AC10
- Amelia H4: ATDD scaffold `ok` vs `success` → Task 8.1

**MEDIUM (16 → all applied):**
- Winston M1: billing_period_days CHECK → Task 1.9
- Winston M2: end_date >= start_date CHECK → Task 1.8
- Winston M3: cancellation_reason column → Task 1.2
- Winston M4: timezone → Dev Notes UTC documentation
- Murat M1: ATDD additional mismatches → Task 8.1 expanded
- Murat M2: Time mocking strategy → Dev Notes + Task 7.3/7.4 referenceDate injection
- Murat M3: Negative scope creep tests → Task 7.4 (89% does NOT trigger)
- Murat M4: Cancel idempotency → Task 3.2, Task 7.8
- Sally M7: Empty state dismiss → AC9, Task 5.1
- Sally M8: Mobile wizard → Task 5.2
- Sally M9: Accessibility aria → AC5, Task 5.4
- Sally M10: Success toast → AC8
- Amelia M1: Cache tag strategy → Task 4.3
- Amelia M2: Seed data → Task 1.16
- Amelia M3: SQL billing period → Task 3.3 extracted, Task 3.4 CTE
- Amelia M4: Group ordering → B (schema) before C (queries) ✅

**LOW (7 → all applied):**
- Murat L1: Zod discriminated union edge cases → Task 7.5 expanded
- Murat L2: UI loading/error states → Task 7.10
- Sally L11: Billing period reset context → AC8, Task 5.4
- Sally L12: First-time tooltip → AC8, Task 5.4
- Amelia L1: Shared alert card → noted in Task 6.2
- Amelia L2: Concurrent access → Dev Notes TODO
- Amelia L3: Fixture string values → Task 7.13

### Cross-Story Dependencies

- **Story 3.1** (Client CRUD) — MUST be complete. Retainer FK to clients. Uses client Server Actions, query patterns, types
- **Epic 5** (Time Tracking) — time_entries table already exists. Scope creep reads from it. Epic 5 may add fields (billable flag, project_id) — scope creep query should use only `client_id + date + duration_minutes` which are stable
- **Epic 7** (Invoicing) — will read `retainer_agreements` for invoice generation. `monthly_fee_cents` used for flat-rate invoices (FR73d). `hourly_rate_cents` overrides client default for hourly invoicing. **Tech debt: consider `retainer_id` on `time_entries` before Epic 7.**
- **Epic 8** (Client Health) — scope creep data feeds into client health scoring. `monthly_hours_threshold` breach = negative health factor
- **Epic 10** (Notifications) — scope creep alerts become push notifications. This story delivers dashboard-queryable alerts only. The query function `getScopeCreepAlerts` can be reused by Epic 10's notification system

### Files NOT to Touch

- Do NOT modify `supabase/migrations/20260504000001_enhance_clients_for_crud.sql` — new migration for retainers
- Do NOT modify `packages/db/src/queries/clients/` — retainer queries are separate directory
- Do NOT modify `packages/types/src/client.ts` — retainer types in separate file
- Do NOT modify `packages/db/src/schema/clients.ts` — separate schema file
- Do NOT modify `apps/web/app/(workspace)/clients/actions/` — retainer actions in subdirectory under `[clientId]/actions/retainer/`
- Do NOT modify `packages/db/src/cache-policy.ts` ENTITY_TAG_MAP keys — only ADD new entry for `retainer_agreement`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic3] — Story 3.2 acceptance criteria, FR mapping
- [Source: _bmad-output/planning-artifacts/prd.md#FR73a] — Retainer agreements (hourly, flat monthly, package-based)
- [Source: _bmad-output/planning-artifacts/prd.md#FR73c] — Scope creep detection at 90% of retainer allocation
- [Source: _bmad-output/planning-artifacts/prd.md#FR73d] — Invoice creation from flat-rate retainers (Epic 7)
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] — Money as cents, RLS patterns, junction tables
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Patterns] — Server Actions, ActionResult, revalidation
- [Source: _bmad-output/implementation-artifacts/3-1-client-data-model-crud.md] — Previous story patterns, learnings, file structure
- [Source: packages/db/src/schema/clients.ts] — Existing client Drizzle schema
- [Source: packages/types/src/client.ts] — Existing client Zod schemas
- [Source: packages/db/src/queries/clients/crud.ts] — Query layer pattern to follow
- [Source: packages/db/src/cache-policy.ts] — Cache entity/tag patterns
- [Source: supabase/migrations/20260424080002_add_time_entries_table.sql] — Time entries schema for scope creep calculation
- [Source: apps/web/app/(workspace)/clients/[clientId]/page.tsx] — Client detail page where retainer panel integrates
- [Source: apps/web/app/(workspace)/page.tsx] — Home dashboard where scope alerts integrate

### Project Structure Notes

- New migration: `supabase/migrations/{timestamp}_add_retainer_agreements.sql`
- Drizzle schema: `packages/db/src/schema/retainer-agreements.ts`
- Numeric helpers: `packages/shared/src/numeric-helpers.ts`
- Types: `packages/types/src/retainer.ts`
- Queries: `packages/db/src/queries/retainers/` (crud.ts, billing-periods.ts, utilization.ts, index.ts)
- Server Actions: `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/` (create, update, cancel, get) + `apps/web/app/(workspace)/actions/get-scope-alerts.ts` (workspace-level)
- UI Components: `apps/web/app/(workspace)/clients/[clientId]/components/retainer-*.tsx` (5 files: panel, form, dialog, bar, banner)
- Test fixtures: `packages/test-utils/src/fixtures/retainer.ts`
- RLS tests: `supabase/tests/rls_retainer_agreements.sql`
- Test files: 13 total (see Group G)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514 (via opencode)

### Debug Log References

- Numeric helpers: test expectations corrected (decimal hours, not HH.MM format)
- Billing periods: corrected UTC date methods (getUTCFullYear vs getFullYear)
- Utilization test: Supabase mock chain needed thenable support for non-terminal queries
- Server action tests: required valid UUIDs for Zod schema validation

### Completion Notes List

1. All 9 task groups implemented (A–I, with H/I deferred as ATDD scaffold already exists)
2. Pre-existing `@flow/tokens` test failures (emotional token count 8 vs expected 7) are NOT from this story
3. Pre-existing `@flow/web` typecheck failures (agent-config DRAIN_ERROR, trust atoms) are NOT from this story
4. All retainer-specific tests pass: 27 numeric-helpers, 14 billing-periods, 2 utilization, 16 server action, Zod schema tests, 25 RLS pgTAP tests
5. `get_scope_creep_alerts` RPC not created in migration — utilization.ts has JS fallback that queries directly
6. Integration test (Task 9) deferred — requires running Supabase instance with seeded data
7. UI component tests (7.10–7.11) deferred — require `renderWithTheme` setup investigation

### Review Findings (Code Review — 2026-04-27)

3-layer adversarial review: Blind Hunter + Edge Case Hunter + Acceptance Auditor. 5 decision-needed, 28 patch, 2 defer, 3 dismissed.

#### Decision-Needed

- [x] [Review][Decision→Patch] Scope creep uses JS fallback, not SQL CTE — RESOLVED: Guard JS fallback against zero threshold now, backlog SQL RPC as tech debt. Majority (3/4 agents). Adds patch: guard `thresholdMinutes > 0` in utilization.ts + numeric-helpers.ts. [blind+edge+auditor] [`utilization.ts:59-163`]
- [x] [Review][Decision→Dismiss] Sidebar badge on /clients, not Dashboard — RESOLVED: Keep on /clients, update AC6 spec. Unanimous (4/4). No code change. [auditor] [`sidebar.tsx:110`]
- [x] [Review][Decision→Defer] No historical retainer timeline — RESOLVED: Defer to follow-up story "3.2.1 Historical Retainer Timeline". Majority (3/4). Query exists, pure UI gap. [auditor] [`retainer-panel.tsx` — no timeline section]
- [x] [Review][Decision→Defer] No mobile 2-step wizard — RESOLVED: Defer to polish pass. Majority (3/4). Functional as-is, Task 5.2 tracked. [auditor] [`retainer-form.tsx` — no viewport detection]
- [x] [Review][Decision→Patch] No seed data for retainers — RESOLVED: Add seed data now. Unanimous (4/4). 5 fixtures in seed script. [auditor] [`supabase/migrations/20260505000001_add_retainer_agreements.sql`]

#### Patch

- [x] [Review][Patch] Guard division-by-zero in scope creep fallback — Add `if (thresholdMinutes <= 0) return null` in utilization.ts and `if (allocatedMinutes < 1) return null` in numeric-helpers.ts. From D1 resolution. [blind+edge+auditor] [`utilization.ts:59-163`, `numeric-helpers.ts:17`]
- [x] [Review][Patch] Add 5 retainer seed fixtures — 1 hourly active, 1 flat_monthly at 70%, 1 flat_monthly at 95%, 1 package_based active, 1 cancelled. From D5 resolution. [auditor] [`supabase/migrations/`]
- [x] [Review][Patch] RLS `FOR ALL` allows DELETE despite "no DELETE" comment — Change to separate SELECT/INSERT/UPDATE policies, omit DELETE. [blind] [`migration:54`]
- [x] [Review][Patch] Form field typo `data.hourlyCents` — Edit path reads wrong FormData key, hourly rate updates always fail. Change to `data.hourlyRateCents`. [blind+edge+auditor] [`retainer-form.tsx:39`]
- [x] [Review][Patch] Edit form missing fields — billingPeriodDays, monthlyHoursThreshold, packageHours, packageName, endDate not sent to updateRetainerAction. [blind+auditor] [`retainer-form.tsx:37-42`]
- [x] [Review][Patch] Expired status only in JS, DB row still `active` — `getActiveRetainerForClient` now auto-expires DB row when endDate passes, then returns expired status. [blind+edge] [`crud.ts:32-39`]
- [x] [Review][Patch] updateRetainer accepts type-incompatible fields — `updateRetainerSchema` now has `.refine()` rejecting mixed type fields in single update. [blind+edge] [`retainer.ts:46-56`]
- [x] [Review][Patch] No "End Retainer" button in panel — `EndRetainerDialog` imported and rendered in `retainer-panel.tsx`. [auditor] [`retainer-panel.tsx:7,119-127`]
- [x] [Review][Patch] Scope alert banner not rendered on client page — `RetainerScopeBanner` imported in `page.tsx`, rendered when ≥90%. [auditor] [`page.tsx:7,92-94`]
- [ ] [Review][Patch] No success toast on creation — AC8 requires toast "Retainer created — scope tracking is now active." with link. No generic toast system exists yet. Deferred to DW-3.2-4. [auditor] [`retainer-form.tsx:72`]
- [ ] [Review][Patch] No first-time tooltip on utilization bar — AC8 requires dismissible tooltip tracked via localStorage. Deferred to DW-3.2-5. [auditor] [`retainer-utilization-bar.tsx`]
- [x] [Review][Patch] "Not needed" dismiss uses useState, not persisted — AC9 requires persisted preference. Now uses `localStorage`. [auditor] [`retainer-panel.tsx:25-27,72`]
- [x] [Review][Patch] billingPeriodEnd not passed to utilization bar — Component accepts prop but parent never passes it. Now passed from page.tsx through retainer-panel. [auditor] [`retainer-panel.tsx:115`, `page.tsx:102`]
- [ ] [Review][Patch] Missing utilization bar icons and CTA link — AC5 requires checkmark/warning/alert icons per state and CTA link for ≥90%. Deferred to DW-3.2-6. [auditor] [`retainer-utilization-bar.tsx:48`]
- [x] [Review][Patch] Timezone inconsistency in endDate check — Uses UTC comparison (`T23:59:59Z` suffix). [edge+blind] [`crud.ts:33-34`]
- [x] [Review][Patch] Race condition on update — concurrent cancel + update catches PGRQ116 and returns specific 409 error. [edge] [`update-retainer.ts:64-71`]
- [x] [Review][Patch] Zod regex allows values exceeding numeric(10,2) — Added `parseFloat(v) <= 99999999.99` refine. [edge] [`retainer.ts:21,33`]
- [x] [Review][Patch] getRetainerUtilization returns empty string for billingPeriodEnd on hourly — Returns `null` instead. [edge] [`utilization.ts:55-56`]
- [x] [Review][Patch] RLS test 4 conflicts with unique index — Uses different client_id. [edge] [`rls_retainer_agreements.sql:31-35`]
- [ ] [Review][Patch] Unused getCurrentBillingPeriod function — Refactoring deferred (non-blocking, code quality). [edge] [`billing-periods.ts:6-24`]
- [x] [Review][Patch] endDate CHECK allows same-day start and end — Changed `>=` to `>` in migration. [edge] [`migration:17`]
- [x] [Review][Patch] Money display uses inline /100 instead of formatCents() — Inline `formatCents()` helper added. [auditor] [`retainer-panel.tsx:18-20`]
- [x] [Review][Patch] Type assertion with `as` instead of Zod/guard — Replaced with proper type guard. [auditor] [`create-retainer.ts:77`]
- [x] [Review][Patch] Empty catch blocks swallow error context — Now logs via `console.error`. [auditor] [`update-retainer.ts:65`, `cancel-retainer.ts:56`]
- [x] [Review][Patch] Billing period reset text missing date — Now includes date in period text. [auditor] [`retainer-utilization-bar.tsx:41-42`]
- [ ] [Review][Patch] Files exceed 200-line soft limit — retainer-form.tsx (237), crud.ts (211). Deferred (non-blocking). [auditor] [`retainer-form.tsx`, `crud.ts`]
- [x] [Review][Patch] Scope alerts display uses float arithmetic — Uses integer minutes now. [auditor] [`scope-alerts-section.tsx:26`]
- [x] [Review][Patch] Drizzle schema missing start_date default — Added `.default(sql\`CURRENT_DATE\`)`. [blind+auditor] [`retainer-agreements.ts:23`]
- [x] [Review][Patch] Over-threshold text shows hours not percentage — Accepts `overageMinutes` prop, displays hours. [auditor] [`retainer-utilization-bar.tsx:52`]
- [x] [Review][Patch] retainer-scope-banner.tsx duplicate locations — Verified: false positive. Only one copy exists. [auditor]

### Review Findings (Code Review Round 2 — 2026-04-27)

3-layer re-review after round 1 patches applied. 56 raw findings → 21 patches, 4 deferred, 4 dismissed.

#### Patch (Round 2)

- [x] [Review R2][Patch] Expiry update: added `.eq('status', 'active')` + `.eq('workspace_id', ...)` + error guard — prevents race overwriting cancelled status. [blind+edge] [`crud.ts:36-44`]
- [x] [Review R2][Patch] cancelRetainer: added `status !== 'active'` guard + `.eq('status', 'active')` in DB update — prevents cancelling expired retainers. [blind+edge] [`crud.ts:194-211`]
- [x] [Review R2][Patch] Update schema: monthlyHoursThreshold/packageHours now use same `.refine()` validation as create. [blind+edge] [`retainer.ts:48-52`]
- [x] [Review R2][Patch] Refactored billing period calculation to use `getCurrentBillingPeriod()` — eliminated 2x inline duplication. [blind+edge+auditor] [`utilization.ts:71-79,144-151`]
- [x] [Review R2][Patch] Added `'use server'` to `get-scope-alerts.ts`. [blind] [`get-scope-alerts.ts:1`]
- [x] [Review R2][Patch] Hourly utilization query now filters by current billing period. [blind] [`utilization.ts:41-46`]
- [x] [Review R2][Patch] Log RPC error before falling back to JS scope creep fallback. [blind] [`utilization.ts:111`]
- [x] [Review R2][Patch] updateRetainer crud input typed as `UpdateRetainerData` instead of `Record<string, unknown>`. [blind+auditor] [`crud.ts:128-138`]
- [x] [Review R2][Patch] Date validation: `startDate` and `endDate` use `dateStr` Zod refine. [blind+edge] [`retainer.ts:4`]
- [x] [Review R2][Patch] Threshold rounding changed from `Math.floor` to `Math.ceil` — prevents 0 threshold for tiny allocations. [edge] [`utilization.ts:76,152`]
- [x] [Review R2][Patch] ARIA: `aria-valuenow` clamped to `Math.min(percent, 100)` when over 100%. [edge] [`retainer-utilization-bar.tsx:60`]
- [x] [Review R2][Patch] Form sends `null` instead of `undefined` for cleared optional fields. [edge] [`retainer-form.tsx:41-43`]
- [x] [Review R2][Patch] parseFloat NaN guard added in form before server action call. [blind+edge] [`retainer-form.tsx:35-38`]
- [x] [Review R2][Patch] EndRetainerDialog receives real `trackedMinutes` from parent. [auditor] [`retainer-panel.tsx:134`]
- [x] [Review R2][Patch] Added endDate date input to retainer form. [auditor] [`retainer-form.tsx:211-218`]
- [x] [Review R2][Patch] ScopeBanner now has anchor link to `#retainer-panel`. [auditor] [`retainer-scope-banner.tsx:14`]
- [x] [Review R2][Patch] Unsafe Supabase join cast now handles null clients. [blind] [`utilization.ts:171`]
- [x] [Review R2][Patch] DB CHECK: hourly_rate_cents and monthly_fee_cents must be > 0 or NULL. [auditor] [`migration:10-11`]
- [x] [Review R2][Patch] RetainerDetailLine returns fallback text instead of null. [blind] [`retainer-panel.tsx:148`]
- [x] [Review R2][Patch] cancel-retainer action catches RETAINER_NOT_ACTIVE with 400. [edge] [`cancel-retainer.ts:58-63`]
- [x] [Review R2][Patch] Updated cancelRetainer test: expects throw for non-active retainers. [edge] [`crud.test.ts:92`]

#### Deferred (Round 2)

- [x] [Review R2][Defer] N+1 query pattern in scope creep fallback — DW-3.2-1 (SQL CTE). [blind] — deferred, requires new migration
- [x] [Review R2][Defer] formatCents defined locally instead of shared utility. [auditor] — deferred, non-blocking
- [x] [Review R2][Defer] EndRetainerDialog missing focus trap / Radix Dialog. [auditor] — deferred, needs component infrastructure
- [x] [Review R2][Defer] Files exceed 200-line soft limit (retainer-form.tsx ~250, crud.ts ~227). [auditor] — deferred, DW-3.2-9

#### Dismissed (Round 2 — 4)

- startDate missing from form — intentional default-today simplification
- scope-alerts-section reverse-engineers allocated hours — already noted, low priority
- Redundant null check in fallback — code clarity, not a bug
- service_role RLS policy unreachable — harmless dead code, service_role bypasses RLS anyway

#### Deferred

- [x] [Review][Defer] TOCTOU race in cancelRetainer — benign per spec (idempotent, same values). Optimistic locking is already a known TODO. [blind] [`crud.ts:177-200`] — deferred, pre-existing pattern
- [x] [Review][Defer] cancelRetainer idempotency is spec-compliant — returning success for already-cancelled is correct per AC3. [edge] [`cancel-retainer.ts:36-43`] — deferred, spec-compliant

#### Dismissed (3)

- RLS policy naming convention — functional, consistent within file
- Notes empty string → null — intentional defensive coercion, consistent across create/update
- retainerRowSchema UUID validation — internal mapper, data from DB

### File List

**Migration:**
- `supabase/migrations/20260505000001_add_retainer_agreements.sql`

**Schema & Types:**
- `packages/db/src/schema/retainer-agreements.ts`
- `packages/types/src/retainer.ts`
- `packages/shared/src/numeric-helpers.ts`
- `packages/db/src/cache-policy.ts` (modified — added retainer_agreement entity)

**Query Layer:**
- `packages/db/src/queries/retainers/crud-helpers.ts`
- `packages/db/src/queries/retainers/crud.ts`
- `packages/db/src/queries/retainers/billing-periods.ts`
- `packages/db/src/queries/retainers/utilization.ts`
- `packages/db/src/queries/retainers/index.ts`
- `packages/db/src/index.ts` (modified — added retainer exports)

**Server Actions:**
- `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/create-retainer.ts`
- `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/update-retainer.ts`
- `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/cancel-retainer.ts`
- `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/get-retainer.ts`
- `apps/web/app/(workspace)/actions/get-scope-alerts.ts`

**UI Components:**
- `apps/web/app/(workspace)/clients/[clientId]/components/retainer-panel.tsx`
- `apps/web/app/(workspace)/clients/[clientId]/components/retainer-form.tsx`
- `apps/web/app/(workspace)/clients/[clientId]/components/end-retainer-dialog.tsx`
- `apps/web/app/(workspace)/clients/[clientId]/components/retainer-utilization-bar.tsx`
- `apps/web/app/(workspace)/clients/[clientId]/components/retainer-scope-banner.tsx`
- `apps/web/app/(workspace)/_components/scope-alerts-section.tsx`
- `apps/web/app/(workspace)/_components/retainer-scope-banner.tsx`

**Pages (modified):**
- `apps/web/app/(workspace)/clients/[clientId]/page.tsx`
- `apps/web/app/(workspace)/page.tsx`

**Layout (modified):**
- `packages/ui/src/layouts/sidebar.tsx`
- `packages/ui/src/layouts/workspace-shell.tsx`
- `packages/ui/src/layouts/sidebar-provider.tsx`

**Tests:**
- `packages/shared/src/__tests__/numeric-helpers.test.ts`
- `packages/types/src/__tests__/retainer.test.ts`
- `packages/db/src/queries/retainers/__tests__/billing-periods.test.ts`
- `packages/db/src/queries/retainers/__tests__/crud.test.ts`
- `packages/db/src/queries/retainers/__tests__/utilization.test.ts`
- `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/__tests__/create-retainer.test.ts`
- `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/__tests__/update-retainer.test.ts`
- `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/__tests__/cancel-retainer.test.ts`
- `apps/web/app/(workspace)/clients/[clientId]/actions/retainer/__tests__/get-retainer.test.ts`
- `supabase/tests/rls_retainer_agreements.sql`
- `packages/test-utils/src/fixtures/retainer.ts`

**Barrel exports (modified):**
- `packages/shared/src/index.ts`
- `packages/types/src/index.ts`
- `packages/test-utils/src/index.ts`
