# Epic 3 Retrospective: Client Management

**Date:** 2026-04-27
**Epic:** Epic 3 — Client Management
**Status:** Complete — all 3 stories done
**Participants:** Team Mantis (John/PM, Winston/Architect, Amelia/Developer, Murat/Test, Sally/UX, Mary/Analyst, Paige/Tech Writer)

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories planned | 3 |
| Stories completed | 3/3 |
| Story splits required | 0 (vs Epic 2's 2) |
| Code review rounds | 6 (2 per story) |
| Total patches applied | ~95 |
| New tests | ~200 |
| Deferred items opened | 15+ |
| Deferred items from previous epics still open | 4 (Epic 2) |
| Total open deferred items | 19+ |
| New migrations | 2 |
| Production incidents | 0 |

### Story Completion

| Story | Title | Status | Tests | Review Rounds |
|-------|-------|--------|-------|---------------|
| 3-1 | Client Data Model & CRUD | ✅ done | 56 | 2 (33 + 11 findings) |
| 3-2 | Retainer Agreements & Scope Creep Detection | ✅ done | 84+ | 2 (56 → 21 + 21 findings) |
| 3-3 | New Client Setup Wizard | ✅ done | 60 | 2 (16 + 4 findings) |

---

## What Went Well

1. **Perfect story delivery** — All 3 stories shipped as planned with zero splits. Scope check gate from Epic 2 (A1) kept stories right-sized.
2. **Velocity was fast** — Process streamlining from Epic 2's improvements compounded. No mid-epic rework from missed dependencies.
3. **Graphify for dependency tracing** — Consistent use of graphify before implementation surfaced file relationships early (e.g., FR73c → retainer_agreements → time_entries → utilization.ts).
4. **Previous retro follow-through: 7/7** — All Epic 2 action items completed. RLS `::text` cast pattern: zero deviations (vs Epic 2's 1). Zod validation at boundaries: consistent across all stories.
5. **Integer financial math worked** — Scope creep detection uses integer-minute comparisons in SQL. `numeric-helpers.ts` and `dollar-cents.ts` extracted as shared utilities. Float comparison bug caught in review.
6. **Partial success pattern established** — Story 3-3's `WizardResult` with `warning` field provides a reusable composite action pattern for Epic 4-10.
7. **Adversarial review quality remained high** — 33-56 findings per story caught real production bugs: TOCTOU races, division-by-zero, catch blocks re-invoking failing code, ILIKE injection.

---

## What Didn't Go Well

1. **Deferred items accumulating** — 15+ new deferred items in Epic 3 on top of 4 remaining from Epic 2. Trend: each epic opens more deferred items than it closes.
2. **Story 3-2 produced 10+ deferred items** — Largest single-story deferred count. Includes UX gaps (no success toast, no tooltip, missing icons), code quality (file size violations), and performance (N+1 scope creep query).
3. **Story 3-3 shipped with 5 known spec deviations** — Full-page overlay → centered dialog, no full-screen mobile, no TierLimitBanner, validates onChange not onBlur, no Zod email validation. These are UX commitments in the design spec, not optional polish.
4. **File size violations recurring** — retainer-form.tsx (~250 lines), crud.ts (~227 lines). Same issue flagged in Epic 2 (DW-2.6a-1). Pattern: complex features push against 200-line limit during implementation.
5. **Scope creep uses JS fallback, not SQL CTE** — DW-3.2-1. N+1 query pattern will degrade as Epic 5 adds time entries. Acceptable for MVP but a performance time bomb.
6. **No process rule to cap deferred work** — Stories accumulate deferred items during code review with no mechanism to say "stop, split the story."

---

## Team Discussion

### Velocity vs Completeness

**Observation:** Fast velocity was partially enabled by deferring completeness items during code review rather than addressing them inline.

**Decision:** Introduce process improvements to balance speed with completeness (see Action Items).

### Deferred Work Accumulation

**Observation:** 19+ open deferred items across 2 epics. Trajectory is upward.

**Decision:** Dedicated polish sprint before Epic 4. Process improvements to prevent recurrence.

### Graphify as a Process Tool

**Observation:** Graphify dependency tracing was consistently used across all 3 stories and contributed to zero dependency surprises.

**Decision:** Make graphify query a mandatory step in the pre-dev workflow. Document in project-context.md.

---

## Previous Retro Follow-Through

| # | Action Item (Epic 2) | Status | Evidence in Epic 3 |
|---|----------------------|--------|-------------------|
| A1 | Mandatory scope check before dev | ✅ done | All 3 stories passed scope check, zero splits needed |
| A2 | Deferred work tracking — living doc | ✅ done | deferred-work.md maintained with status tracker |
| A3 | Validation boundary audit | ✅ done | Zero new `as` casts without Zod validation |
| A4 | RLS pattern enforcement | ✅ done | Zero RLS deviations — all policies use `::text` JWT cast |
| A5 | Runtime validation at DB boundaries | ✅ done | Zod schemas on all client/retainer DB boundaries |
| A6 | Thinking animation | ✅ done | N/A to Epic 3 — not regressed |
| A7 | Cross-epic dependency map | ✅ done | Used for Epic 3 planning, supplemented by graphify |

**Follow-through rate: 7/7 (100%)**

This is the first perfect follow-through rate. The impact was measurable: zero scope surprises, zero RLS deviations, zero validation boundary gaps.

---

## Action Items

### Process Improvements (New)

| # | Action | Owner | Deliverable |
|---|--------|-------|-------------|
| A1 | **Deferred Cap** — max 5 deferred items per story. If code review flags more, story splits before continuing. | Winston + Amelia | Rule documented in `docs/project-context.md` |
| A2 | **Pre-Dev Completeness Sign-Off** — architect reviews all ACs against file-size limits and component complexity before dev starts. Stories that can't ship all ACs get split proactively. | Winston | Sign-off step added to `scope-check-gate.md` |
| A3 | **Deferred Closure Ratio** — at least 50% of previous epic's deferred items must be resolved before starting a new epic. | John (PM) | Check added to sprint-planning workflow |
| A4 | **Spec Deviation Tracking** — known spec deviations flagged as `spec-gap` with severity. Must be addressed within 2 epics or formally descoped in PRD. | Sally + John | Tagging convention documented in `deferred-work.md` |
| A5 | **Graphify as mandatory pre-dev step** — query graphify for file dependencies before any story implementation. Document in project-context.md. | Amelia | Step added to `docs/project-context.md` dev workflow |

### Polish Sprint (Critical Path)

| # | Item | Priority | Source |
|---|------|----------|--------|
| P1 | SQL CTE migration for scope creep — eliminate N+1 query | Critical | DW-3.2-1 |
| P2 | Full-page wizard overlay + mobile full-screen | Critical | 3-3-gap-1, 3-3-gap-5 |
| P3 | Success toast on retainer creation | High | DW-3.2-4 |
| P4 | Utilization bar icons + CTA link for ≥90% | High | DW-3.2-6 |

### Polish Sprint (High Priority)

| # | Item | Priority | Source |
|---|------|----------|--------|
| P5 | File size refactoring — retainer-form.tsx, crud.ts | High | DW-3.2-9, DW-3.2-10 |
| P6 | Zod email validation in wizard | High | 3-3-gap-2 |
| P7 | TierLimitBanner in wizard upgrade CTA | High | 3-3-gap-4 |
| P8 | EndRetainerDialog focus trap | Medium | DW-3.2-12 |

### Polish Sprint (Low Priority)

| # | Item | Priority | Source |
|---|------|----------|--------|
| P9 | First-time tooltip on utilization bar | Low | DW-3.2-5 |
| P10 | Unused getCurrentBillingPeriod cleanup | Low | DW-3.2-7 |
| P11 | formatCents shared utility extraction | Low | DW-3.2-11 |
| P12 | Epic 2 leftovers (file sizes, color-mix fallback, focus traps) | Low | DW-2.6a-1, DW-2.6a-6, 2-6b |

---

## Files Changed

### New Files
- `_bmad-output/implementation-artifacts/epic-3-retrospective.md` — this file

### Modified Files (Planned)
- `docs/project-context.md` — add deferred cap rule, completeness sign-off, graphify pre-dev step
- `_bmad-output/implementation-artifacts/scope-check-gate.md` — add architect completeness sign-off
- `_bmad-output/implementation-artifacts/deferred-work.md` — add spec-gap tagging convention
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — epic-3: done, retro: done

---

## Epic 4 Readiness

**Epic 4: Inbox Agent** — 5 stories (Gmail OAuth, email categorization, morning brief, action items, unified timeline)

| Gate | Status | Blocker? |
|------|--------|----------|
| Client data model stable | ✅ Complete — 3-1 shipped with full CRUD + RLS | No |
| Retainer agreements available | ✅ Complete — 3-2 shipped with 3 types | No |
| Setup wizard functional | ✅ Complete — 3-3 shipped (with known gaps) | No |
| Scope creep detection active | ⚠️ JS fallback — SQL CTE deferred to polish sprint | No for MVP |
| Deferred items under control | ⚠️ 19+ open — polish sprint planned before Epic 4 | Process concern |
| Spec deviations documented | ✅ All tracked — not blocking Epic 4 | No |

### Cross-Epic Dependencies
- Epic 4 stories reference `client_id` for inbox-to-client mapping — clients table is ready
- Morning brief (4-3) may surface scope alerts — `getScopeCreepAlerts` query available
- No direct code dependencies between Epic 3 and Epic 4 code

### Preparation Needed
1. **Polish sprint execution** — close critical-path deferred items before Epic 4 kickoff
2. **Gmail OAuth research** — provider abstraction pattern from architecture must be implemented
3. **Email categorization pipeline design** — LLM integration pattern needs spike

---

## Key Takeaways

1. **Process improvements compound** — Epic 2's 7 action items all delivered measurable impact in Epic 3. Perfect follow-through rate. This is the standard to maintain.
2. **Velocity without completeness is debt** — Fast delivery that accumulates deferred items creates a hidden backlog that slows future epics. The deferred cap (A1) and completeness sign-off (A2) address this.
3. **Graphify is a process tool, not just a reference** — Consistent dependency tracing before implementation prevented scope surprises. Making it mandatory (A5) ensures this continues.
4. **Spec deviations need visibility** — Calling a gap "deferred" doesn't make it disappear. The spec-gap tagging (A4) ensures gaps are tracked with urgency and resolved or formally descoped.

---

## Verification

- `@flow/db` tests: passing ✅
- `@flow/web` tests: passing for Epic 3 code ✅
- TypeScript: 0 new errors ✅
- Lint: 0 new errors ✅
- Pre-existing errors: unchanged (trust-actions, agent-config, tokens) — NOT from Epic 3

---

## Verdict

Epic 3 delivered all 3 stories with strong velocity and zero production incidents. Previous retro follow-through was 7/7 — the team's best record. However, deferred items are accumulating (19+ open), and Story 3-3 shipped with 5 spec deviations that affect UX quality. The team agreed to a dedicated polish sprint before Epic 4, plus 5 process improvements to prevent recurrence: deferred cap, pre-dev completeness sign-off, deferred closure ratio, spec-gap tracking, and mandatory graphify pre-dev queries. Epic 4 readiness is contingent on completing the critical-path polish items.
