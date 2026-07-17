---
story_id: "9.5c"
epic: 9
title: "Party-Mode Adversarial Review — Re-Scope Record"
status: superseded-by-story
created: 2026-07-17
review_method: bmad-party-mode (5 agents, 3 rounds)
agents: [Winston (Architect), John (PM), Mary (Analyst), Murat (Test Architect), Sally (UX)]
verdict: "5/5 BLOCK → consensus re-scope to Option C-revised (suspend + choice UI + notification)"
---

# Story 9-5c Party-Mode Re-Scope Record

This document captures the **consensus output** of a three-round adversarial
party-mode review of Story 9-5c (Agency→Pro Downgrade: Team-Member Removal Path),
run 2026-07-17. It is the authoritative source for the changes folded into the
story file. The story itself (`9-5c-agency-to-pro-downgrade.md`) has been
rewritten to reflect this record; this file exists to preserve the rationale,
the rejected alternatives, and the open product decisions that remain outside
the story's scope.

---

## TL;DR

The original `ready-for-dev` story was blocked by all five agents on three root
causes: (1) the spec layer was missing — AC2's algorithmic auto-revoke had no
parent requirement; (2) the "5" was an unresolved product decision silently
introduced by a 9-4 migration; (3) the UX was self-contradictory (in-app path
blocks, webhook path auto-revokes). The roundtable resolved the *architectural*
fork decisively (ship a `suspended` membership state — cheap, precedented,
compliant) and left three *product* decisions for the owner.

**Recommended path (locked):** Option C-revised —
- In-app path: guided choice UI ("pick the N members to keep on Pro").
- Webhook path: suspend excess members immediately (compliant on landing),
  notify owner, owner confirms/overrides in-app, algorithm is a default
  *suggestion* in the choice UI, never an auto-executioner.
- No silent auto-revoke at any layer.

---

## Round 1 — Five-Agent Adversarial Pass

Five agents (Winston, John, Mary, Murat, Sally) reviewed the story in parallel
against the actual codebase. Consensus: **5/5 BLOCK or re-scope**.

### Converged findings

| # | Finding | Raised by | Status |
|---|---|---|---|
| F1 | **FR57 is misattributed.** FR57 is about *clients* + *user choice*; 9-5c is about *team members* + *algorithm*. AC2 has no parent requirement. | Mary, John | **Open — needs new FR** |
| F2 | **The "5" is unresolved.** PRD §Subscription Tiers says Pro = "Solo only" (1). Migration `20260618000003` silently overwrote `pro.maxTeamMembers` 1→5 in a 9-4 code-review patch. Story hardcodes "5" in user-facing copy. | Winston, John, Mary | **Open — needs PRD decision** |
| F3 | **`changeTierAction` has no direction concept.** AC1 ("block Agency→Pro") requires introducing downgrade-direction into a path that currently only checks same-tier. Story under-specifies where the check lives relative to `createCheckoutSessionAction`. | Winston | Folded into revised AC1 |
| F4 | **The EC4 inversion breaks 9-5b's locked tests.** `applyDowngradeOnTierChange` currently *rejects* `toTier:'pro'|'agency'` as EC4. "Widening the schema" is not a one-liner — it's a function decomposition. | Winston | Folded into revised Task 3 (split, don't invert) |
| F5 | **Hardcoded "5" is a latent production bug.** If config and copy disagree, users see lies. Source from `getTierConfig().tierLimits.pro.maxTeamMembers` everywhere. | Winston | Folded into revised ACs |
| F6 | **AC3 (reactivation) is an untestable promise.** No backlog story owns bulk reactivation; no `reactivated_at`; no UI spec. | Mary, Sally | Folded into AC3 + flagged as new story |
| F7 | **Audit event enum unverified.** (RESOLVED post-round — see §"P0 gates resolved".) | Mary, Murat | Resolved |
| F8 | **EC6 ("best-effort" session invalidation) has no observable contract.** No transaction spans the writes; partial failure is silent. | Murat | Folded into revised EC6 |
| F9 | **Idempotency on webhook replay is unspecified.** | Murat | Folded into new EC7 |
| F10 | **TOCTOU on count-then-revoke.** Count window can under-revoke if an invite lands mid-flight. | Murat | Folded into Task 2 (RPC option) |
| F11 | **AC1/AC2 UX asymmetry.** In-app blocks, webhook auto-revokes. User is rewarded for taking the lower-control path. | John, Sally | Resolved via Option C-revised |
| F12 | **Notification NFR missing.** Silently locking members out on a billing event is a support-ticket generator. | Mary, Sally | Folded into new AC5 (notification) |
| F13 | **Role-priority is unstated product policy.** "owner>admin>member>client_user" appears nowhere in PRD. | Mary | Open — needs product sign-off |
| F14 | **Does the limit count owners? client_users?** Undefined. | Mary | Open — needs product decision |

### Round-1 patches that survived all agents

1. Source Pro limit from `getTierConfig()` everywhere; no hardcoded "5".
2. Verify `audit_log.action` accepts new literals (or widen) — **RESOLVED: bare `text`, no CHECK.**
3. Verify `invalidateUserSessions` exists and has the right shape.
4. Split `applyDowngradeOnTierChange` rather than inverting EC4.
5. Add `user_id ASC` deterministic tiebreaker + `removal_reason`/`suspension_reason` enum.
6. Make "best-effort" an observable contract (audit row, structured log, count attempted/confirmed).
7. Rewrite AC3 to testable data-preservation; defer bulk reactivation to a new story.
8. Resolve NF-B/NF-C (owner/client_user counting) before test design.

---

## Round 2 — Sally's UX Deepening

Sally (UX) was dispatched to pressure-test the asymmetry and the notification
gap. She agreed on BLOCK but reframed the diagnosis:

- **The asymmetry is forced by physics** (Stripe portal is not our surface).
  AC2 must exist as a safety net. *Conceded by John in Round 3.*
- **AC1 wastes its chance to be better.** "Block + go remove members first"
  is a dead-end. AC1 should offer a guided choice flow. → Folded into revised AC1.
- **Auto-revoke is not the sin; *silent* auto-revoke is.** FR4 owner-revoke is
  equally algorithmic. Fix = notification + recourse.
- **Reactivation is a ghost town.** No spec for one-click restore, per-member,
  time window, or "you're back" email. → New story needed.
- **Progressive disclosure:** AC1's 403-after-click is a bouncer; a concierge
  surfaces the overage *before* the click. → Folded into revised AC1.
- **AC4 banner copy is weasel-y.** Plain language, dual placement (billing +
  team settings), secondary "Manage team" CTA. → Folded into revised AC4.

Sally also raised the **grace-window question** that became the synthesis lever
for Round 3.

---

## Round 3 — John vs. Sally on the Webhook Fork, Winston on `suspended`

### The fork

| | John (Option B) | Sally (Option C-revised) |
|---|---|---|
| Webhook during decision | Full access for 24h, then auto-revoke on silence | Suspend excess immediately; owner decides; algorithm = suggestion, never executioner |
| Compliance | Tolerates over-entitlement for 24h (gift-factoring) | Compliant the moment webhook lands |
| Default-on-silence | Algorithm executes the removal | Algorithm never executes — suspend persists until owner acts |
| New infra | None (delayed job + email) | `suspended` membership state |

### Convergence

- **John conceded** AC2 must exist (Stripe portal is physics).
- **Sally conceded** her original 24h grace window is broken (workspace already
  on Pro when webhook fires → over-entitlement gap) and that default-on-silence
  means the algorithm still picks badly for most owners.
- **Both agreed** the in-app guided choice UI must ship in 9-5c, not be deferred.
- **Both agreed** notification (member + owner email, plain copy) is non-negotiable.

### Winston's architectural verdict (the decisive input)

Winston was dispatched to answer: is `suspended` in scope for 9-5c, or does it
need its own infrastructure ticket?

**Verdict: in scope. Incremental cost ≈ 1 day, mostly shared work.**

Ground-truth findings from the codebase:

1. **`workspace_members.status` has NO CHECK constraint** (migration
   `20260421170001` added it as bare `text`). Adding `suspended` requires
   **zero schema lines** to widen an enum.
2. **`countActiveTeamMembers` already filters `.eq('status','active')`**
   (`packages/db/src/queries/workspaces/members.ts:98`). A suspended member
   stops consuming a seat *by construction*, with no query change.
3. **`getActiveMembership` also filters `.eq('status','active')`**
   (`members.ts:22`). A suspended member's request resolves to "no membership"
   → they lose access at the API layer automatically. (Verified post-round.)
4. **Direct precedent: archived clients (9-5b).** Migration
   `20260618800001_archived_clients_rls.sql` established the exact pattern
   (`status='active'` in UPDATE policy USING + WITH CHECK, service_role
   mutates / user JWT reads). `suspended` for members is the structural twin.
5. **Latent RLS bug surfaced.** `workspace_members` RLS (migration
   `20260420140007`) gates on `removed_at IS NULL`, never amended for `status`.
   Any non-active, non-removed state passes the gate today. Option C-revised
   *retires this debt as a side effect*; Option B inherits it silently.
6. **Third option considered and rejected: `expires_at`.** Setting
   `expires_at=now()` would not consume a seat in `countActiveTeamMembers`
   (which ignores `expires_at`), creates semantic collision with future
   time-bounded-seat features, and is UX-dishonest ("expired" vs "suspended").
   Use the right column for the right concept.

Cost breakdown (delta only):

| Deliverable | Option B | Option C-revised | Delta |
|---|---|---|---|
| service_role webhook path | ✓ | ✓ | 0 |
| In-app choice UI | ✓ | ✓ | 0 (both agree) |
| Audit logging | ✓ | ✓ (event name changes) | ~0 |
| Session invalidation | ✓ | ✓ | 0 |
| `status` value | existing `revoked` | adds `suspended` | 0 schema lines |
| RLS migration | needed anyway (bug fix) | needed anyway | 0 between options |
| Bulk db query | `bulkRevokeMembers` | `bulkSuspendMembers` | ~same size |
| Reactivation (AC3) | messy (partial unique index) | trivial (flip status back) | **C is cheaper** |

### Locked decision

**Option C-revised.** Ship `suspended` in 9-5c. The fork collapsed because
Sally's path is compliant-on-landing, costs the same as John's, retires a
latent RLS bug, and makes reactivation trivial.

---

## P0 Verification Gates (resolved post-round)

Winston and Murat flagged three P0 verifications. All three were resolved by
the orchestrator against the actual codebase:

| Gate | Finding | Impact |
|---|---|---|
| `getActiveMembership` status gate | Filters `.eq('status','active')` (`members.ts:22`) | ✅ Suspended members lose API access by construction. No refactor needed. |
| `audit_log.action` CHECK constraint | Bare `text`, no CHECK (`audit_log.sql:11`) | ✅ New literals (`member_suspended`) require no migration. |
| Audit type definitions | `member_revoked`, `member_sessions_invalidated` already defined in `packages/types/src/workspace-audit.ts:34,79` and already used by `apps/web/.../team/actions/revoke-member.ts:142,154` | ✅ Reuse existing infrastructure. Add `member_suspended` type definition. |

**Correction to the original story:** the story referenced a
`workspace_audit_events` table. **No such table exists.** The actual audit
table is `audit_log` (migration `20260420140005`). The revised story uses
`audit_log` and the existing `WorkspaceAuditEvent` type infrastructure in
`packages/types/src/workspace-audit.ts`.

**Secondary finding:** `revokeMemberAccess` (`packages/db/src/queries/clients/scoping.ts:47`)
operates per-(user,client), not per-user-bulk. Under Option C-revised, a
suspended member loses API access via `getActiveMembership` returning null, so
the `member_client_access` rows can remain in place — the cascade is *not*
required for correctness. (If/when the owner confirms revocation in the choice
UI, the existing per-row `revokeMemberAccess` can be looped, or a new bulk
variant added at that time.)

---

## Open Product Decisions (outside story scope, must be resolved by owner)

These four items were flagged by the roundtable but are **product decisions**,
not implementation details. They must be resolved before or during dev, but the
story can begin Task 1 (red-phase tests) without them.

### PD1 — The "5" (PRD ↔ migration discrepancy)

- **PRD §Subscription Tiers (line 842):** Pro = "Solo only" → reads as 1.
- **PRD §Plan transitions (line 866):** "team members beyond Solo limit must be
  removed first."
- **Migration `20260618000003`** (9-4 code-review patch): `pro.maxTeamMembers = 5`.
- **Story 9-5c copy:** hardcodes "5."

**Decision needed:** Amend PRD to 5 (with rationale), or revert migration to 1.
The roundtable's lean (Winston/John/Mary): trust the migration, amend the PRD.
The story implementation sources the limit from `getTierConfig()` regardless,
so the decision only affects PRD text and any user-facing copy that names a
number.

### PD2 — Missing FR for team-member downgrade handling

AC2 (now: suspend-and-defer with choice) has no parent requirement. FR57 is
about clients + user choice. The roundtable (Mary, John) recommends a new FR —

> **FR57b (proposed):** "When a workspace downgrades from Agency to Pro and
> exceeds the team-member limit, the system suspends excess members
> (read-only, no seat consumption) and notifies the owner, who must confirm or
> override the suggested selection in-app. No member is silently removed."

Re-tag every 9-5c AC to FR57b. Drop the FR57 tag.

### PD3 — Role priority + counting semantics (NF-B, NF-C, F13)

- **F13:** "owner>admin>member>client_user" is unstated product policy. Needs
  product sign-off and should live in a glossary/FR, not buried in an AC.
- **NF-B:** Does the Pro limit count owners? (3 owners + 4 admins = 7; limit 5;
  preserving 3 owners leaves room for 2 of 4 admins.)
- **NF-C:** Does the limit count `client_user` rows? EC5 revokes them first,
  implying yes — but `client_user` is typically an *external collaborator*,
  which contradicts counting against an internal headcount limit.

### PD4 — Reactivation story (deferred)

AC3 promises reactivation but no story owns bulk reactivation on upgrade-back.
Per Sally + Mary: strip AC3 to testable data-preservation only, spin a new
story (9-5f?) for reactivation UX (one-click restore-all? per-member? time
window before purging suspended? "you're back" email?).

---

## Symmetry Commitment for 9-5d

John's non-negotiable condition for accepting Option C-revised: **the
webhook-grace/suspend pattern must be the documented standard for both team
members and clients.** When 9-5d ("client-selection-downgrade-ui") is scoped,
it must adopt the same shape:

- Client-side webhook downgrade → suspend excess clients immediately (archived
  read-only, which 9-5b already does) → notify owner → owner confirms/overrides
  in-app → algorithm is default-suggestion, never auto-finalize.

This prevents a two-tier system where team members get worse treatment than
clients. **Add to 9-5d's scope notes when that story is authored.**

---

## Rejected Alternatives (recorded for posterity)

1. **Option A (John, bigger scope):** full choice UI, kill instant auto-revoke,
   webhook path blocks Stripe-side change. Rejected: Stripe doesn't let us
   block a subscription change from our side.
2. **Option B (Sally round 2, then withdrawn):** grace-window-then-auto-revoke.
   Rejected: over-entitlement gap during the window; default-on-silence still
   picks badly for most owners.
3. **`expires_at` hack (Winston's third option):** set `expires_at=now()` on
   excess members. Rejected: `countActiveTeamMembers` ignores `expires_at`
   (would consume a seat); semantic collision with future time-bounded seats;
   UX-dishonest.

---

## Round Index

- **Round 1:** Winston, John, Mary, Murat (parallel, first pass). 5/5 BLOCK.
- **Round 2:** Sally (UX deepening). BLOCK; surfaced grace-window question.
- **Round 3:** John + Sally (head-to-head on webhook fork) → Winston
  (architectural verdict on `suspended`). Converged on Option C-revised.

All rounds run as independent subagents via the Agent tool per the
`bmad-party-mode` skill. Each agent's full response is preserved in the
session transcript; this document is the orchestrator's synthesis.
