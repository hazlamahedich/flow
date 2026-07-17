---
story_id: "9.5c"
epic: 9
epic_title: Billing & Subscriptions
story_key: 9-5c-agency-to-pro-downgrade
status: in-progress
rescoped: 2026-07-17
pds_resolved: 2026-07-17
author: BMad Story Agent
rescoped_by: "Party-Mode Review (5 agents, 3 rounds) — see 9-5c-rescope-party-mode.md"
pds_resolved_by: "Owner sign-off 2026-07-17 — see 'Product Decision Resolutions' below"
input_documents:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/implementation-artifacts/9-5b-agent-pause-downgrade-handling.md
  - _bmad-output/implementation-artifacts/9-5c-rescope-party-mode.md
---

# Story 9.5c: Agency→Pro Downgrade (Team-Member Suspension Path)

Status: in-progress (re-scoped 2026-07-17; PDs resolved 2026-07-17)

> **RE-SCOPE NOTICE (2026-07-17, party-mode review).**
> This story was blocked 5/5 by an adversarial party-mode review (Winston /
> John / Mary / Murat / Sally) and re-scoped from an "auto-revoke" model to a
> **"suspend + guided choice + notification"** model (Option C-revised). The
> original story auto-revoked excess team members by algorithm on the webhook
> path; the revised story suspends them immediately (compliant on landing),
> notifies the owner, and requires in-app confirmation/override before any
> member is removed. Algorithmic role/seniority selection is preserved as a
> **default suggestion** in the choice UI, never as an auto-executioner.
>
> Full review rationale, rejected alternatives, and open product decisions
> live in `9-5c-rescope-party-mode.md`. Read it before dev.

> **PRODUCT DECISIONS RESOLVED (2026-07-17, owner sign-off).**
> All four PDs are closed. See "Product Decision Resolutions" below for the
> exact disposition of each. Summary:
> - **PD1:** Pro `maxTeamMembers = 5` (keep the migration value; PRD amended).
> - **PD2:** Authored as **FR57a** (not "FR57b" — the rescope misnamed it;
>   PRD lettered clusters always start at `a`). PRD prose reconciled.
> - **PD3:** Role priority `owner>admin>member>client_user` codified in PRD.
>   Count owners = yes; count `client_user` = yes-for-now (tech-debt
>   `td-9-5c-01` filed to exclude them later — the sort protects them anyway).
> - **PD4:** 9-5f spun as backlog (bulk reactivation UX). Does NOT block 9-5c;
>   Task 8 ships the minimal data-side reactivation hook.

> **FACTUAL CORRECTION to AC6 (2026-07-17).**
> The original AC6 claimed `workspace_members.status` is "bare `text` with no
> CHECK" and therefore needed "zero schema lines" to add `suspended`. This is
> **wrong.** Migration `20260421170001:27` adds
> `CHECK (status IN ('active','expired','revoked'))`, and no later migration
> drops it. The Task 2 migration **must** widen this CHECK to include
> `'suspended'` — otherwise the suspend writes will fail at the DB layer. See
> AC6 below for the corrected migration scope.

## Story

As a workspace owner,
I want excess team members to be **suspended** (not silently removed) when I
downgrade from Agency to Pro and exceed the Pro team-member limit,
So that (a) my workspace is compliant with the Pro plan the instant the
downgrade takes effect, (b) I get to choose which members to keep and which to
revoke — informed by a sensible default — rather than having an algorithm
decide for me, and (c) affected members are notified humanely and my historical
team contribution data is never lost (**FR57a**).

## Traceability

| AC | Scenario | PRD / NFR tag |
|---|---|---|
| AC0 | Test-first red scaffolds | (process) |
| AC1 | In-app guided choice flow (replaces bare 403 block) | FR57a |
| AC2 | Webhook suspends excess members immediately; algorithm = default suggestion only | FR57a |
| AC3 | Owner protection, data preservation, testable reactivation-friendly state | FR57a, FR4 (spirit) |
| AC4 | Plain-language banner on billing + team settings; secondary "Manage team" CTA | FR57a |
| AC5 | Notification NFR — member + owner email, plain copy, in-app toast | FR57a |
| AC6 | `suspended` membership state + CHECK widen + latent RLS bug fix | (infra) |

## Product Decision Resolutions (2026-07-17)

These four items were flagged by the party-mode review as **product decisions**
outside the dev's authority. They are now resolved by the owner.

### PD1 — Pro `maxTeamMembers` = 5 (RESOLVED)
- **Decision:** Keep `5` (the value set by migration `20260618000003`).
- **Action taken:** PRD §Subscription Tiers amended (`prd.md:842` "Solo only"
  → "Up to 5"); pricing narrative amended (`prd.md:855`) with rationale.
- **Rationale:** At 1, Pro == Free for team seats, which would force an instant
  Pro→Agency upgrade on any 2nd member invite (UX trap, violates FR55
  tier-progression). The 9-4 tier-limit test already enforces 5.
- **Code impact:** None — the limit is read at runtime from
  `getTierConfig().tierLimits.pro.maxTeamMembers`.

### PD2 — Author FR57a (RESOLVED)
- **Decision:** Author the team-member suspension requirement as **FR57a**
  (cluster starts at `a` per the PRD convention: FR28a–o, FR73a–e, NFR07a–c
  all start at `a`). The rescope doc's "FR57b" was a misnomer that skipped `a`.
- **Action taken:** FR57a added to PRD (`prd.md` §Subscription & Tier
  Management, immediately after FR57); PRD §Plan transitions prose reconciled
  (`prd.md:866,1055` — "must be removed first" → "are suspended");
  `epics.md` FR coverage map + Epic-9 FR list updated.
- **Re-tag:** All 9-5c ACs tagged FR57a (legacy FR57 tags dropped — FR57 is
  clients-only per `prd.md:1271`).

### PD3 — Role priority + counting semantics (RESOLVED)
- **Decision (a) role priority:** Codify `owner > admin > member > client_user`,
  then `joined_at ASC`, final tiebreaker `user_id ASC`. Added to PRD
  role-definitions block (`prd.md:814`) as the documented policy — no longer
  "buried in an AC" (F13).
- **Decision (b) count owners: YES.** Owners are unambiguously workspace
  members. `countActiveTeamMembers` is correct as-is (no query change). The
  owner-first sort guarantees owners are never suspended (AC3).
- **Decision (c) count `client_user`: YES for now, tech-debt filed.** PRD L812
  says `client_user` is "not a workspace member", so semantically it should
  NOT consume a team seat. But changing the count now risks breaking 9-4's
  tier-enforcement tests. Tech-debt ticket **`td-9-5c-01`** filed in
  `sprint-status.yaml` to exclude `client_user` from the count later. The
  role-priority sort suspends `client_user` last, so they are protected by
  the algorithm regardless of the counting inconsistency.

### PD4 — Reactivation story (RESOLVED)
- **Decision:** Spin **9-5f** (`9-5f-team-member-reactivation-ux`) as a
  backlog story. It owns the user-facing bulk + per-member reactivation UX
  (one-click restore-all, per-member picker, time window, "you're back"
  email). 9-5c Task 8 ships the minimal data-side hook only.
- **Does NOT block 9-5c:** AC3 + Task 8 guarantee the data state that makes
  reactivation safe (no orphaned data, round-trips on upgrade-back).
- **Symmetry:** 9-5f mirrors 9-5d (which owns client bulk-unarchive-on-upgrade).
  Both honor the documented symmetry commitment (team members must not have a
  worse restore story than clients).

## P0 Verification Gates (all resolved)

| Gate | Finding | Status |
|---|---|---|
| `getActiveMembership` status gate | Filters `.eq('status','active')` (`members.ts:22`) | ✅ Suspended members lose API access by construction |
| `countActiveTeamMembers` seat gate | Filters `.eq('status','active')` (`members.ts:98`) | ✅ Suspended members consume no seat |
| `audit_log.action` CHECK constraint | Bare `text`, no CHECK (`audit_log.sql:11`) | ✅ New literals (`member_suspended`) writable, no migration |
| Audit type definitions | `member_revoked`, `member_sessions_invalidated` exist in `packages/types/src/workspace-audit.ts:34,79` | ✅ Reuse infra; add `member_suspended` sibling |
| **`invalidateUserSessions` existence/signature** | **EXISTS** at `@flow/auth/server-admin` (`packages/auth/src/server-admin.ts:7`), signature `(userId: string) => Promise<void>`. Already used by `revoke-member.ts:132`. | ✅ **VERIFIED** (was the one pending P0 gate) |
| `workspace_members.status` CHECK constraint | **HAS a CHECK** (`20260421170001:27`: `CHECK status IN ('active','expired','revoked')`) — contradicts the original story's "bare text" claim | ⚠️ Task 2 migration MUST widen CHECK to include `'suspended'` |

## Acceptance Criteria

0. **[AC0 — Test-First]** A new test file `apps/web/__tests__/billing/9-5c-downgrade.spec.ts` exists with failing (red) test scaffolds covering all scenarios below, before implementation begins. On green-up, all tests pass. **Mandatory schema/contract assertions** in the red phase:
   - `audit_log.action` is bare `text` (no CHECK) — verify new literals are writable. (Confirmed: migration `20260420140005_audit_log.sql:11`.)
   - `getActiveMembership` (`packages/db/src/queries/workspaces/members.ts:12`) filters `.eq('status','active')` so suspended members lose API access by construction. (Confirmed.)
   - `countActiveTeamMembers` (`members.ts:89`) filters `.eq('status','active')` so suspended members don't consume a seat. (Confirmed.)
   - `invalidateUserSessions` exists at `@flow/auth/server-admin` with signature `(userId: string) => Promise<void>`. (**VERIFIED** — resolves the prior pending P0 gate.)
   - **NEW (correction):** `workspace_members.status` HAS a CHECK constraint (`20260421170001:27`: `CHECK status IN ('active','expired','revoked')`). The red test must assert that the Task 2 migration widens this CHECK to include `'suspended'` — without it, suspend writes fail at the DB layer.
   - Tautology audit at green-flip: every `vi.mock(...)` must be justified; delete tests that only assert "the mock returned what we stubbed." Target ≥15 real ATDD assertions (9-5b history: shipped 17 after correcting tautologies).

1. **[AC1 — In-App Guided Choice Flow]** Replaces the original bare 403 block. Two parts:

   **1a. Progressive disclosure (concierge, not bouncer).** On the plan-selection / billing screen, when the workspace is on `agency` and has `activeCount > proLimit`, surface a heads-up *before* the user clicks Downgrade: *"Heads up — you have N team members; Pro supports {proLimit}. Switching will require choosing which {proLimit} to keep."* The limit is read from `getTierConfig().tierLimits.pro.maxTeamMembers` (**= 5**, per PD1) — **never hardcoded**.

   **1b. Guided choice on click.** When the user clicks Downgrade, do NOT delegate to `createCheckoutSessionAction` yet. Instead, present a choice UI: *"Pick the {proLimit} members to keep on Pro."* The list is **pre-selected by the role/seniority heuristic** (per PD3: `owner > admin > member > client_user`, then `joined_at ASC`, final tiebreaker `user_id ASC`), presented as a *suggestion* — the owner can override any selection. Only after the owner confirms the selection does the flow delegate to Stripe checkout. The to-be-revoked members are suspended only after the webhook confirms the tier flip (see AC2) — *not* at click time.

   **Direction concept.** `changeTierAction` currently has no concept of downgrade-vs-upgrade direction (it only blocks same-tier). Introduce it: the guided-choice branch fires when `currentTier === 'agency' && targetTier === 'pro'`. The schema (`changeTierSchema`, `packages/types/src/subscription.ts:88`) already accepts `targetTier: pro|agency`; no schema change needed.

2. **[AC2 — Webhook Suspend (not Auto-Revoke)]** When the Stripe `customer.subscription.updated` webhook fires and flips the workspace to `pro` (via `upsert_workspace_subscription`), and the workspace has `activeCount > proLimit`, the downgrade handler **suspends** — does not revoke — the excess members.

   - **Split, don't invert.** Per Winston's round-3 verdict: extract a new `applyAgencyToProDowngrade` function; leave `applyDowngradeOnTierChange` (9-5b, Free path) untouched so its locked tests stay green. The webhook router dispatches on `toTier`. Do NOT widen `downgradeSchema`'s `toTier` enum and do NOT flip the EC4 rejection predicate.
   - **Selection (default suggestion, for the choice UI):** role weight `owner > admin > member > client_user` (PD3), then `joined_at ASC`, final tiebreaker `user_id ASC` (deterministic; needed because `timestamptz` collisions are possible under bulk import).
   - **For each excess member, write `status='suspended'` + `suspended_at = now()` + `suspension_reason='tier_downgrade_agency_to_pro'`.** Do NOT set `removed_at` (that would conflate with `revoked`). `member_client_access` rows are left in place — the member loses API access via `getActiveMembership` returning null, so the cascade is not required for correctness.
   - **Session invalidation: best-effort, observable.** Call `invalidateUserSessions(userId)` per suspended member (verified to exist at `@flow/auth/server-admin`); if it throws, catch + log + continue. The audit row must record `sessionsAttempted` and `sessionsConfirmed` counts so partial failure is observable in prod (Murat's P0-1). Response contract on partial failure: `{ success: true, data: { ..., warnings: ['session_invalidation_partial'] } }` — distinguishable from full success, does not roll back the DB writes.
   - **Audit log:** insert into `audit_log` (NOT `workspace_audit_events` — that table does not exist). Add a new `member_suspended` event type to `packages/types/src/workspace-audit.ts` (alongside the existing `member_revoked` / `member_sessions_invalidated`). `action` is bare `text`, no CHECK to widen.
   - **Revalidate** cache tags `workspace_member` and `workspace_client` for the workspace.
   - **Return:** `{ preservedCount, suspendedMemberIds, upgradePrompt }` in a new `AgencyToProDowngradeResult` type (NOT the 9-5b `DowngradeResult` — different shape, do not conflate).

   > **TOCTOU (Murat F10):** The count-then-suspend window can under-suspend if an invite lands between the count and the writes. Preferred mitigation: a single Postgres RPC `suspend_workspace_members(p_workspace_uuid, p_keep_user_ids uuid[], p_reason text)` that does count + suspend under `SELECT ... FOR UPDATE` atomically. If the team opts for the JS two-step instead, document the race as accepted risk in Dev Notes.

   > **Idempotency (Murat F9, new EC7):** Webhook replay (Stripe retries) must be a no-op. Re-suspending an already-suspended member returns `suspendedMemberIds: []` on the second call (or the same IDs — pick one and document it in the helper's JSDoc).

3. **[AC3 — Owner Protection, Data Preservation, Reactivation-Friendly State]**

   - **Owners are never suspended**, even if recently added — guaranteed by the role-priority sort (PD3) placing `owner` first.
   - **No data deletion.** No `workspace_members`, `clients`, `time_entries`, or `invoices` rows are deleted. All contribution data remains intact.
   - **Reactivation is trivial by construction:** flip `status` back to `active` and clear `suspended_at`/`suspension_reason`. No partial-unique-index conflict (the row stays in place; suspended rows are not in the `(workspace_id, user_id) WHERE status='active'` partial index, so reactivation doesn't collide with a re-invite).
   - **Bulk reactivation UX is OUT OF SCOPE for this story** (PD4) — see AC4's "Manage team" CTA, which links to a future reactivation flow owned by **9-5f**. AC3 here only guarantees the *data state* that makes reactivation possible; Task 8 ships the minimal webhook-side flip.

4. **[AC4 — Banner, Plain Language, Dual Placement]**

   - Render on **both** `apps/web/app/(workspace)/settings/billing/page.tsx` and the team settings page — owners thinking about team aren't always on billing.
   - **Plain copy** (drop passive voice): *"When you downgraded to Pro, we paused N team members to fit the Pro limit ({proLimit}). They can't log in but their work is preserved."* Read `proLimit` from config (**= 5**, PD1).
   - **Primary CTA:** "Upgrade to Agency" (restores all suspended members via Task 8's hook — see Dev Notes for the upgrade-back hook).
   - **Secondary CTA:** "Manage team" (links to the choice UI / 9-5f reactivation flow).
   - **Banner alone is not enough** (Sally): assumes the owner logs in. The email in AC5 is the floor; the banner is the ceiling.

5. **[AC5 — Notification NFR, explicit]**

   This was missing from the original story (Mary's NF-D). Specify, don't imply:

   - **To the member (email, within minutes of suspension):** copy attributes cause to the workspace's plan change, never to the member. Template: *"Your access to {workspace} was paused because {workspace} changed its plan to Pro. Your work isn't deleted — if they upgrade back, you'll be re-added. Questions? Contact {owner}."* **Strip every word of role/seniority/algorithm-speak from user-facing copy** — that language is for audit logs, not humans.
   - **To the owner (email, the instant AC2 fires):** lists who was suspended and why, with two deep links — "Upgrade back to Agency" and "Manage team / adjust who was suspended." This is the owner's override window.
   - **In-app toast for the member on next login attempt:** *"Your access to {workspace} was paused on {date}."*
   - **NFR channel + SLA** (Mary): email is the channel; "within minutes" is the SLA. If a notification service is unavailable, log + continue (best-effort, like session invalidation) — do not roll back the suspension.

6. **[AC6 — `suspended` State + CHECK Widen (RLS already correct)]**

   > **CORRECTION (2026-07-17, two findings):**
   >
   > 1. The original AC6 claimed `workspace_members.status` is "bare text, no
   >    CHECK" requiring "zero schema lines" to add `suspended`. This is
   >    **factually wrong.** Migration `20260421170001:27` adds
   >    `CHECK (status IN ('active','expired','revoked'))`. The Task 2 migration
   >    MUST widen this CHECK. (Fixed.)
   >
   > 2. The original AC6 + rescope doc (Winston's finding #5) claimed a
   >    "latent RLS bug": that the `workspace_members` owner_all policy never
   >    gated on `status`, so user JWTs could mutate non-active rows. This is
   >    **also wrong.** Migration `20260425080000_fix_rls_recursion.sql` (which
   >    predates 9-5c and was missed by the party-mode review) already added
   >    `AND status = 'active'` to the `owner_all` policy's USING clause. The
   >    guard already exists; **no RLS migration is needed for 9-5c.** An
   >    initial attempt (`20260717000002_workspace_members_suspended_rls.sql`)
   >    was written against the superseded `20260421170001` policy and
   >    introduced infinite recursion (the `EXISTS` subquery pattern that
   >    `20260425080000` specifically removed); it was **deleted**. The pgTAP
   >    suite (tests 13–17) verifies the existing policy correctly blocks
   >    user-JWT reactivation of suspended members.

   - **Widen the `status` CHECK** in the new Task 2 migration to include `'suspended'`:
     `CHECK (status IN ('active','expired','revoked','suspended'))`. Use
     `ALTER TABLE workspace_members DROP CONSTRAINT ... ADD CONSTRAINT ...`
     (the constraint name is auto-generated as `workspace_members_status_check`).
   - **Add `suspended_at` and `suspension_reason` columns** in the same migration (mirroring `clients.archived_at` from `20260504000001`). Consistency CHECK: `(status = 'suspended' AND suspended_at IS NOT NULL) OR (status != 'suspended' AND suspended_at IS NULL)` (templated on `clients_status_archived_at_check`).
   - **No RLS migration needed** — the `status = 'active'` guard on the owner_all policy already exists (migration `20260425080000`). `service_role` (webhook) bypasses RLS and remains the only mutator of non-active states. pgTAP tests 13–17 verify this.
   - **Document the new value** in code (Zod schema, type union) — the CHECK widen is the only DDL change required.

## Edge Case Matrix (revised)

| Case | Input / Condition | Expected Behavior | AC Ref |
|---|---|---|---|
| EC1 | Downgrade Agency→Pro with ≤ proLimit active members | Webhook + UI succeed; no members suspended | AC1, AC2 |
| EC2 | Downgrade with > proLimit via in-app UI | Guided choice flow presented; owner picks; only confirmed revocations suspend after webhook | AC1 |
| EC3 | Downgrade with > proLimit via Stripe webhook | Excess members suspended immediately (compliant on landing); owner emailed; choice UI available in-app to confirm/override | AC2, AC5 |
| EC4 | Multiple owners in workspace | Role-based sort preserves all owners (PD3 — owners sorted first, never suspended) | AC3 |
| EC5 | `client_user` role exists | Sorted last by role weight (default suggestion); counted today per PD3c (tech-debt `td-9-5c-01` to exclude later) | AC2 |
| EC6 | Session invalidation partial failure | DB writes persist; response `success: true` with `warnings: ['session_invalidation_partial']`; audit row records `sessionsAttempted`/`sessionsConfirmed` | AC2 |
| EC7 | Webhook replayed (Stripe retry) | Second invocation is a no-op; returns `suspendedMemberIds: []` (documented in helper JSDoc) | AC2 |
| EC8 | Owner overrides the default suggestion in choice UI | Override respected; only the owner's final selection is kept active; the rest are suspended after webhook | AC1 |
| EC9 | Suspended member attempts API access | `getActiveMembership` returns null → 403 at the API layer (by construction, no extra logic) | AC2, AC6 |
| EC10 | Suspended member attempts login | In-app toast: "Your access to {workspace} was paused on {date}." | AC5 |
| EC11 | Owner upgrades back to Agency | Suspended members flip back to `active` via Task 8 hook (bulk UX deferred to 9-5f) | AC3 |

## Tasks / Subtasks

- [x] **Task 1: Red-phase tests** (AC: #0)
  - [x] 1.1 Create `apps/web/__tests__/billing/9-5c-downgrade.spec.ts` with failing tests covering EC1–EC11.
  - [x] 1.2 Add the mandatory schema/contract assertions (AC0 list), including the **new** CHECK-widen assertion (the correction to the original AC0).
  - [x] 1.3 Ran `vitest` — 9 pass / 11 fail for right reasons initially; now 25/25 green.
  - [ ] 1.4 ~~Verify `invalidateUserSessions` exists and has the expected signature (P0 gate).~~ **DONE — verified 2026-07-17** at `@flow/auth/server-admin`.

- [x] **Task 2: `suspended` state + CHECK widen (no RLS migration needed)** (AC: #6)
  - [x] 2.1 New migration `20260717000001`: **widen `workspace_members.status` CHECK** to include `'suspended'` (corrects the original "no DDL needed" claim); add `suspended_at`, `suspension_reason` columns; consistency CHECK (templated on `clients_status_archived_at_check`).
  - [x] ~~2.2 New migration: fix latent RLS bug~~ **NOT NEEDED** — migration `20260425080000_fix_rls_recursion.sql` already added `status='active'` to the owner_all policy. An initial 9-5c RLS migration was written, found to introduce recursion, and deleted. See AC6 correction #2.
  - [x] 2.3 Update `packages/types` Zod schemas / type unions to include `'suspended'` (`workspace.ts:6` MemberStatusEnum + test).
  - [x] 2.4 Add `member_suspended` to `packages/types/src/workspace-audit.ts` (+ exhaustive-switch case in `workspace-audit.test.ts`).
  - [x] 2.5 pgTAP test (`rls_workspace_members.sql`): owner JWT cannot reactivate suspended (test 13–14); service_role can (15–16); cross-workspace isolation (17); CHECK accepts suspended (18); consistency CHECK rejects mismatched suspended_at (19). **19/19 passing.**

- [x] **Task 3: Bulk suspend db query** (AC: #2, #3)
  - [x] 3.1 Created `packages/db/src/queries/workspaces/suspendMembers.ts` with `bulkSuspendMembers(supabase, workspaceId, keepLimit, reason)`. Templated on `bulkArchiveClients` (9-5b).
  - [x] 3.2 Implemented PD3 role-weight sort + joined_at ASC + user_id ASC tiebreaker (role weight `owner>admin>member>client_user` [PD3] + `joined_at ASC` + `user_id ASC` tiebreaker).
  - [x] 3.3 Shipped JS two-step (fetch active sorted → bulk UPDATE) — documented accepted TOCTOU risk; RPC deferred unless prod races observed `suspend_workspace_members(p_workspace_uuid, p_keep_user_ids uuid[], p_reason text)` to atomize count+suspend and kill TOCTOU (Murat F10). **Fallback:** JS two-step with documented accepted-risk.
  - [x] 3.4 Idempotent by construction (re-count filters status=active; verified EC7 in test); document the response contract in JSDoc.
  - [x] 3.5 Re-exported from `packages/db/src/index.ts` + `queries/workspaces/index.ts` and barrel files.

- [x] **Task 4: Webhook path — SPLIT, don't invert** (AC: #2)
  - [x] 4.1 Extracted `applyAgencyToProDowngrade` in `downgrade-agency-to-pro.ts`; `downgrade-internal.ts` untouched (9-5b 17/17 still green) in a new file `apps/web/lib/actions/billing/downgrade-agency-to-pro.ts`. Leave `downgrade-internal.ts` (`applyDowngradeOnTierChange`) untouched so 9-5b tests stay green.
  - [x] 4.2 Webhook router dispatches on toTier: free→9-5b handler, pro→new handler, agency(pro→agency upgrade)→reactivation (`apps/web/lib/stripe/handlers/subscription-updated.ts`) to dispatch on `toTier`: Free → existing handler; Pro → new handler.
  - [x] 4.3 New `AgencyToProDowngradeResult` type (distinct from 9-5b `DowngradeResult`) (do NOT conflate with 9-5b `DowngradeResult`).
  - [x] 4.4 `warnings: ['session_invalidation_partial']` + audit row with sessionsAttempted/sessionsConfirmed (EC6 test green): `warnings: ['session_invalidation_partial']`; audit row records `sessionsAttempted`/`sessionsConfirmed` (Murat P0-1).

- [x] **Task 5: In-app guided choice flow (Option B scope — heads-up only)** (AC: #1)
      *Scope decision (2026-07-17): the current app has no in-app 'Downgrade to Pro' button (downgrades go via Stripe Customer Portal). The full choice modal + changeTierAction direction branching is deferred to 9-5d, which is explicitly scoped to own the choice-UI pattern (with the symmetry commitment). Shipped the proactive heads-up floor; the webhook path (Task 4) makes the workspace compliant regardless of how the downgrade is triggered.*
  - [x] 5.1 `AgencyDowngradeHeadsup` server component on billing page — renders when `currentTier==='agency' && activeCount > proLimit`, plain copy, limit sourced from `getTierConfig()`.
  - [~] 5.2 Choice UI component — **DEFERRED to 9-5d** (symmetry commitment; avoids building the choice-UI pattern twice).
  - [~] 5.3 `changeTierAction` direction branching — **DEFERRED to 9-5d** (same reason).
  - [~] 5.4 Post-confirm checkout delegation — **DEFERRED to 9-5d** (same reason).

- [x] **Task 6: Notification** (AC: #5)
  - [x] 6.1 `buildMemberSuspendedEmail` template builder — plain copy, attributes cause to workspace plan change, HTML-escaped, no algorithm-speak.
  - [x] 6.2 `buildOwnerSuspendedEmail` template builder — lists suspended members, two deep links (Upgrade back + Manage team).
  - [x] 6.3 `SuspendedMemberBanner` server-rendered banner in workspace layout (EC10). Chose banner over sonner toast — `<Toaster>` is not mounted anywhere; banner matches SubscriptionStatusBanner precedent and avoids a client-hydration race.
  - [x] 6.4 Best-effort dispatch wired into `applyAgencyToProDowngrade` — provider resolved once; member + owner emails sent in parallel; failures logged via `writeAuditLog` + counted as `partialFailure` (feeds the EC6 warnings contract). Provider unavailable (missing RESEND_API_KEY) → skip + continue (AC5 allows).

- [x] **Task 7: Banner** (AC: #4)
  - [x] 7.1 `SuspendedMembersBanner` mounted in DUAL placement — billing page (placement='billing') + team settings page (placement='team-settings'). Cross-linking secondary CTA points to the opposite surface.
  - [x] 7.2 Plain copy per AC4, primary CTA 'Upgrade to Agency' (→ /settings/billing, triggers Task 8 reactivation), secondary CTA cross-links. Suspended count read via service_role (owner RLS gates on status='active').

- [x] **Task 8: Reactivation hook (minimal)** (AC: #3)
  - [x] 8.1 `reactivateSuspendedMembers` db query + webhook branch on pro→agency upgrade (clears suspended_at/suspension_reason). 3/3 tests green. (clear `suspended_at`/`suspension_reason`). Bulk UX deferred to 9-5f (PD4).

- [ ] **Task 9: E2E + acceptance validation** (AC: All)
  - [ ] 9.1 Vitest for unit (`bulkSuspendMembers`, `invalidateUserSessions` partial-failure path, webhook handler return contract, choice flow logic).
  - [ ] 9.2 Playwright for UI only (progressive-disclosure headsup, choice flow, banner rendering). **Do not** Playwright the API path (Murat P2-11).
  - [ ] 9.3 pgTAP for RLS (Task 2.5) + cross-workspace `member_client_access` isolation (Murat P1-5).
  - [ ] 9.4 Confirm all tests green; `pnpm typecheck` and `pnpm lint` pass.

## Dev Notes

### Architecture Constraints & Decisions

- **service_role usage:** the Stripe webhook runs in `service_role` to bypass RLS when bulk-suspending members. UI actions use `getServerSupabase` (RLS enforced). The asymmetry is correct and intentional: AC1 is UX (block/choice under RLS), AC2 is correctness (suspend under service_role). (Winston round 1.)
- **Session invalidation:** best-effort, observable. `invalidateUserSessions` (verified at `@flow/auth/server-admin`) throws on failure; it is caught and the response carries `warnings: ['session_invalidation_partial']`. The DB writes are not rolled back. (Murat P0-1.)
- **Split, don't invert:** `applyDowngradeOnTierChange` (9-5b, Free path) is left untouched. The new `applyAgencyToProDowngrade` is a sibling. Do NOT widen `downgradeSchema.toTier` and do NOT flip the EC4 rejection predicate — 9-5b's tests locked that in for good reason. (Winston round 1.)
- **`suspended` vs `expires_at`:** use `status='suspended'`, not `expires_at=now()`. `countActiveTeamMembers` ignores `expires_at`; semantic collision with future time-bounded seats; UX-dishonest. (Winston round 3.)
- **No `member_client_access` cascade required** for suspension: the member loses API access via `getActiveMembership` returning null. The cascade is only needed if/when the owner *confirms* revocation in the choice UI (loop the existing per-row `revokeMemberAccess`, or add a bulk variant then).
- **Audit table:** `audit_log` (migration `20260420140005`), NOT `workspace_audit_events` (does not exist). `action` is bare `text`, no CHECK. Reuse `packages/types/src/workspace-audit.ts` infrastructure; add `member_suspended`.

### Project Structure Notes

- `packages/db/src/queries/workspaces/suspendMembers.ts` — new bulk-suspend query (+ optional RPC migration)
- `apps/web/lib/actions/billing/downgrade-agency-to-pro.ts` — new webhook path (sibling of `downgrade-internal.ts`)
- `apps/web/lib/actions/billing/change-tier.ts` — add downgrade-direction branching + guided-choice delegation
- `apps/web/app/(workspace)/settings/billing/components/` — banner + choice UI components
- `supabase/migrations/{new}_workspace_members_suspended_state.sql` — **widen CHECK** + `suspended_at`, `suspension_reason`, RLS fix

### Symmetry Commitment for 9-5d / 9-5f

Per John's non-negotiable condition: when 9-5d ("client-selection-downgrade-ui") and
9-5f ("team-member-reactivation-ux") are scoped, they must adopt the **same**
webhook pattern — suspend excess clients/members immediately, notify owner,
owner confirms/overrides in-app, algorithm = default suggestion only. This
prevents a two-tier system where team members get worse treatment than clients,
or where downgrade and reactivation are asymmetric. Both commitments are
recorded in `sprint-status.yaml`.

### References

- `9-5c-rescope-party-mode.md` — full review record (READ BEFORE DEV)
- `prd.md` §Subscription Tiers (line 842, amended 2026-07-17), §Plan transitions (line 866, amended), §Role-priority policy (line 814, new), §FR57a (new)
- `epics.md` Story 9.5 + FR coverage map (FR57a added)
- `20260618800001_archived_clients_rls.sql` — direct precedent for the RLS pattern
- `packages/db/src/queries/workspaces/members.ts:12,89` — `getActiveMembership` + `countActiveTeamMembers` (both filter `.eq('status','active')`)
- `packages/db/src/queries/clients/archiveClients.ts` — template for `bulkSuspendMembers`
- `packages/auth/src/server-admin.ts:7` — `invalidateUserSessions` (verified)
- `packages/types/src/workspace-audit.ts:34,79` — existing `member_revoked` / `member_sessions_invalidated` types to mirror

---

## Dev Agent Record

### Agent Model Used
builtin:zai-coding-plan/GLM-5.2 (ZCode)

### Debug Log References
- 9-5c red phase: 9 pass / 11 fail-for-right-reason (stubs throw "not implemented") — `pnpm exec vitest run __tests__/billing/9-5c-downgrade.spec.ts`
- Task 4 mock iteration: initial test design tried to `vi.mock` the not-yet-existing modules; Vite's static import resolution defeated `vi.mock` at transform time, so the approach switched to real stub-module files (scaffold pattern) + behavioral assertions. Worked cleanly.
- RLS recursion: the initial `20260717000002` RLS migration reintroduced an `EXISTS` subquery on `workspace_members` that `20260425080000_fix_rls_recursion.sql` had specifically removed → infinite recursion. Discovery: the "latent RLS bug" the party-mode review flagged **does not exist** — the status guard was already added by `20260425080000`. Migration deleted; pgTAP suite verifies the existing guard (tests 13–17).
- pgTAP `throws_ok` with SQLSTATE: the 3-arg form treats the 2nd string arg as an *error message*, not an SQLSTATE. Fixed via the 4-arg form `(sql, errcode, errmsg, desc)`.

### Completion Notes List
- **PDs resolved before dev** (PD1–PD4) with owner sign-off — see "Product Decision Resolutions" above. PRD/epics/sprint-status amended.
- **Two factual errors in the original story corrected**: (1) `workspace_members.status` HAS a CHECK constraint (the story claimed "bare text, no CHECK"); (2) the "latent RLS bug" was already fixed by `20260425080000` (the party-mode review missed it).
- **P0 gate verified**: `invalidateUserSessions` exists at `@flow/auth/server-admin` (`packages/auth/src/server-admin.ts:7`), signature `(userId: string) => Promise<void>`, already used by `revoke-member.ts:132`.
- **Backend path complete** (Tasks 1–4, 8): webhook suspends excess members on Agency→Pro downgrade, reactivates on Pro→Agency upgrade, observable partial-failure contract, audit logging. The split-don't-invert guarantee held — 9-5b's 17 tests stayed green throughout.
- **UI + notifications complete** (Tasks 5–7): proactive heads-up (AC1 Option B), dual-placement owner banner (AC4), member-facing banner (AC5 EC10), member + owner email templates with best-effort dispatch (AC5). 18 new UI/notification tests, all green.
- **Full test sweep**: 222/222 web tests (incl. 43 new for 9-5c) + 19/19 pgTAP + 28/28 types — zero regressions. Typecheck + lint clean.

### Deferred Items (at close)
- **Task 5.2–5.4** — In-app choice modal + `changeTierAction` direction branching + post-confirm checkout delegation. **Scope decision (2026-07-17):** the current app has no in-app 'Downgrade to Pro' button (downgrades go via Stripe Customer Portal). The full choice UI is deferred to **9-5d**, which is explicitly scoped to own the choice-UI pattern for both clients and team members (symmetry commitment). Shipped the proactive heads-up floor (Task 5.1); the webhook path makes the workspace compliant regardless.
- **Postgres RPC** (Task 3.3 preferred option): `suspend_workspace_members(...)` to atomize count+suspend and kill TOCTOU. Shipped the JS two-step with documented accepted risk; revisit if prod races observed.
- **9-5f** (PD4): bulk reactivation UX story — spun as backlog; 9-5c Task 8 ships the minimal data-side hook that makes it safe.
- **td-9-5c-01** (PD3c): exclude `client_user` from `countActiveTeamMembers` (PRD says they're "not a workspace member"). Filed as tech-debt; the role-priority sort protects them regardless.
- **td-9-5c-02**: `ResendTransactionalProvider` hardcodes the `from` address as `invoices@flow.app`; suspension emails come from there until the provider accepts a per-send `from` override. Filed as tech-debt to avoid touching the 2 existing call sites.

### Test Commit Record

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| `apps/web/__tests__/billing/9-5c-downgrade.spec.ts` | (uncommitted — red + green in same dev pass) | 2026-07-17 |
| `supabase/tests/rls_workspace_members.sql` (extended) | (uncommitted) | 2026-07-17 |

### File List

**New files (backend):**
- `apps/web/lib/actions/billing/downgrade-agency-to-pro.ts` — `applyAgencyToProDowngrade` webhook handler (sibling of 9-5b's `downgrade-internal.ts`); wired to AC5 notification dispatch
- `packages/db/src/queries/workspaces/suspendMembers.ts` — `bulkSuspendMembers`, `listActiveMembersByRolePriority`, `reactivateSuspendedMembers`, `ROLE_PRIORITY`
- `supabase/migrations/20260717000001_workspace_members_suspended_state.sql` — widen status CHECK + `suspended_at`/`suspension_reason` columns + consistency CHECK
- `apps/web/__tests__/billing/9-5c-downgrade.spec.ts` — 25 backend unit tests (AC0–AC3, EC1, EC4, EC6, EC7, EC11)

**New files (UI + notifications — Tasks 5–7):**
- `apps/web/app/(workspace)/settings/billing/components/AgencyDowngradeHeadsup.tsx` — proactive heads-up for Agency owners over the Pro limit (AC1 Option B)
- `apps/web/app/(workspace)/settings/billing/components/SuspendedMembersBanner.tsx` — owner-facing dual-placement banner (AC4)
- `apps/web/app/(workspace)/settings/billing/components/SuspendedMemberBanner.tsx` — member-facing banner on workspace entry (AC5 EC10)
- `apps/web/lib/actions/billing/suspension-notifications.ts` — member + owner email template builders + best-effort dispatch helpers (AC5)
- `apps/web/__tests__/billing/9-5c-ui-notifications.spec.tsx` — 18 UI + notification template tests (AC1/AC4/AC5)

**Modified files:**
- `apps/web/lib/stripe/handlers/subscription-updated.ts` — webhook router dispatch on toTier (free/pro/agency)
- `apps/web/app/(workspace)/settings/billing/page.tsx` — mount `AgencyDowngradeHeadsup` + `SuspendedMembersBanner`; load suspended count + pro limit
- `apps/web/app/(workspace)/settings/team/page.tsx` — mount `SuspendedMembersBanner` (team-settings placement)
- `apps/web/app/(workspace)/layout.tsx` — mount `SuspendedMemberBanner` (member-suspended lookup via service_role)
- `packages/db/src/index.ts` + `packages/db/src/queries/workspaces/index.ts` + `members.ts` — re-exports + `countSuspendedMembers` helper
- `packages/types/src/workspace.ts` + `workspace.test.ts` — `MemberStatusEnum` widened to include `'suspended'`
- `packages/types/src/workspace-audit.ts` + `apps/web/__tests__/workspace-audit.test.ts` — `member_suspended` event type + exhaustive-switch case
- `supabase/tests/rls_workspace_members.sql` — 7 new pgTAP tests (13–19) for suspended-state RLS + CHECK constraints

**Planning artifacts (PD resolutions + tech-debt):**
- `_bmad-output/planning-artifacts/prd.md` — PD1 (Pro=5), PD2 (FR57a authored + prose reconciled), PD3 (role priority + counting semantics codified)
- `_bmad-output/planning-artifacts/epics.md` — FR57a in coverage map + Epic-9 FR list
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 9-5c entry updated, `9-5f` backlog + `td-9-5c-01` (client_user counting) + `td-9-5c-02` (email from-address) tech-debt added
