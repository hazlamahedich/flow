# Agent Model & Finding Density Tracking

**Created:** 2026-06-10
**Source:** Epic 8 Retro Action Item P3 — "Record which AI model built which story and finding count"
**Purpose:** Inform model selection for future epics based on quality data, not intuition

---

## Summary Statistics

### By Epic (All Stories)

| Epic | Stories | Avg Findings/Story | Total Findings | Notes |
|------|---------|--------------------|----------------|-------|
| 2 | 10 | ~45 | ~450 | Model not tracked; high baseline from early process immaturity |
| 3 | 3 | 47 | 141 | 3-2 had 77 findings (highest single story) |
| 4 | 7 | 16.4 | ~115 | First epic with clean deferred tracking |
| 5 | 4 | ~16 | 48+ | 2 CRITICAL RLS in 5-1 |
| 6 | 4 | 19 | 76 | 6-4 closed with 21 unresolved findings |
| 7 | 6 | 23 | 138 | Financial domain — inherently higher density |
| 8 | 6 | ~13.4 | ~67+ | First epic with per-model tracking |

### By Agent Model (Epic 8 — Only Epic with Model Tracking)

| Agent Model | Stories | Avg Findings | Avg Deferred | Severity Profile |
|-------------|---------|-------------|-------------|-----------------|
| kimi-k2.6 | 3 (8-1a, 8-1b, 8-1c) | 13.0 | 4.7 | 8-1a: 26+ findings, silent error swallowing, String(null) corruption, zero success-path tests |
| Antigravity (DeepMind) | 1 (8-2) | 20.0 | 5.0 | CRITICAL cross-tenant data leak; monorepo violation |
| glm-5.1 | 2 (8-3, 8-4) | ~4.0 | 2.0 | Deterministic agents; zero hallucination risk |

### Top 10 Highest Finding Density Stories

| Rank | Story | Epic | Findings | Key Issue |
|------|-------|------|----------|-----------|
| 1 | 3-2 | 3 | 77 | Scope creep detection; 10+ deferred |
| 2 | 5-1 | 5 | 31 | 2 CRITICAL RLS bugs; deferred cap violated |
| 3 | 7-1 | 7 | 31 | Underspecified ACs (soft dedup, XSS) |
| 4 | 6-4 | 6 | 30 | 21 unresolved at close — process failure |
| 5 | 7-3 | 7 | 29 | Blocked mid-refinement |
| 6 | 7-4 | 7 | 29 | 15 patches in one pass |
| 7 | 7-2 | 7 | 28 | 6 review chunks |
| 8 | 8-1a | 8 | 26+ | Silent errors, String(null), no success tests |
| 9 | 4-5 | 4 | 26 | Required re-review pass |
| 10 | 3-1 | 3 | 44 | Complex CRUD + RLS |

### Lowest Finding Density Stories

| Rank | Story | Epic | Findings | Key Factor |
|------|-------|------|----------|------------|
| 1 | 8-1c | 8 | 4 | Clean scope, well-sliced from 8-1 |
| 2 | 8-4 | 8 | 8 | Deterministic agent (glm-5.1) |
| 3 | 4-4b | 4 | 9 | Cleanest in epic; zero deferred |
| 4 | 7-3a | 7 | 9 | Clean split from 7-3 |
| 5 | 8-1b | 8 | 9 | Well-scoped templates |

---

## Per-Story Detail

| Epic | Story | Title | Agent Model | Findings | Deferred | Notes |
|------|-------|-------|-------------|----------|----------|-------|
| 2 | 2-1a | Agent Orchestrator Interface & Schema | Not tracked | ~45 | — | High baseline |
| 2 | 2-1b | pg-boss Implementation & Idempotency | Not tracked | ~45 | — | Split from 2-1 |
| 2 | 2-2 | Agent Activation, Configuration & Scheduling | Not tracked | ~45 | — | — |
| 2 | 2-3 | Trust Matrix & Graduation System | Not tracked | ~45 | — | — |
| 2 | 2-4 | Pre-check / Post-check Safety Gates | Not tracked | ~45 | — | Deferred boundary validation |
| 2 | 2-5 | Agent Approval Queue & Triage | Not tracked | ~45 | — | — |
| 2 | 2-6a | Trust Badge Display & Status | Not tracked | ~45 | — | — |
| 2 | 2-6b | Trust Ceremonies & Milestones | Not tracked | ~45 | — | — |
| 2 | 2-6c | Trust Audit Log & Tracking | Not tracked | ~45 | — | — |
| 2 | 2-7 | Agent Action History & Timeline | Not tracked | ~45 | — | — |
| 3 | 3-1 | Client Data Model & CRUD | Not tracked | 44 | — | 2 review rounds |
| 3 | 3-2 | Retainer Agreements & Scope Creep | Not tracked | 77 | 10+ | Highest single story |
| 3 | 3-3 | New Client Setup Wizard | Not tracked | 20 | 5 | Spec deviations |
| 4 | 4-1 | Gmail OAuth & Inbox Connection | Not tracked | 21 | ~5 | — |
| 4 | 4-2 | Email Categorization Pipeline | Not tracked | 13 | 3 | 5 open decisions |
| 4 | 4-3 | Morning Brief Generation | Not tracked | 21 | 4 | — |
| 4 | 4-4a | Action Item Extraction & Draft | Not tracked | ~10 | 6 | 6 crit security bugs |
| 4 | 4-4b | Adaptive Inbox Density & Flood | Not tracked | 9 | 0 | Cleanest story |
| 4 | 4-4c | Handled Quietly & Mobile Triage | Not tracked | 15 | 12 | Cap violated |
| 4 | 4-5 | Unified Communication Timeline | Not tracked | 26 | 7 | Required re-review |
| 5 | 5-1 | Time Entry Data Model & Logging | Not tracked | 31 | 10+ | 2 CRITICAL RLS |
| 5 | 5-2 | Persistent Sidebar Timer | Not tracked | — | — | Not reported |
| 5 | 5-3 | Time Entry Editing & Warnings | Not tracked | — | — | Pre-dev adversarial redesign |
| 5 | 5-4 | Time Integrity Agent | Not tracked | 17 | 9 | Non-functional at MVP |
| 6 | 6-1 | Google Calendar OAuth & Connection | Not tracked | 13 | 0 | — |
| 6 | 6-2 | Real-Time Conflict Detection | Not tracked | 12 | 0 | — |
| 6 | 6-3 | Booking Proposals & Event Creation | Not tracked | 21 | 0 | — |
| 6 | 6-4 | Bypass Detection & Cascade Rescheduling | Not tracked | 30 | 21 | Closed with unresolved |
| 7 | 7-1 | Invoice Data Model & Creation | Not tracked | 31 | 0 | Underspecified ACs |
| 7 | 7-2 | Invoice Delivery & Payment Link | Not tracked | 28 | 0 | — |
| 7 | 7-3 | Partial Payments & Balance | Not tracked | 29 | 0 | Blocked mid-refinement |
| 7 | 7-3a | Time Entry Billing Computation | Not tracked | 9 | 0 | Clean split |
| 7 | 7-4 | Void, Credit Note & Reconciliation | Not tracked | 29 | 0 | 15 patches |
| 7 | 7-5 | Stripe Payment Failure Handling | Not tracked | 12 | 0 | — |
| 8 | 8-1a | Weekly Reports Foundation | kimi-k2.6 | 26+ | 5 | Highest density in epic |
| 8 | 8-1b | Report Templates | kimi-k2.6 | 9 | 2 | Well-scoped |
| 8 | 8-1c | Report Regeneration & Versioning | kimi-k2.6 | 4 | 7 | Lowest findings |
| 8 | 8-2 | Weekly Report Agent Auto-Drafts | Antigravity (DeepMind) | 20 | 5 | CRITICAL cross-tenant leak |
| 8 | 8-3 | Client Health & Analytics | glm-5.1 | — | 2 | Deterministic agent |
| 8 | 8-4 | Friday Feeling Ritual | glm-5.1 | 8 | 2 | Deterministic agent |

---

## Cross-Cutting Patterns

### What Reduces Finding Density

| Factor | Evidence | Impact |
|--------|----------|--------|
| **Story splitting** | 8-1→8-1a/b/c: density dropped from ~26 to 4-9 per slice | High |
| **Deterministic agents** | glm-5.1 deterministic: ~4 findings vs kimi-k2.6 LLM: ~13 avg | High |
| **Pre-dev adversarial review** | 5-3, 7-3, 8-2 caught scope issues before code | High |
| **Precise ACs** | Epic 7 retro: "vague ACs → most findings" | Medium |
| **Financial domain experience** | Epic 7→8: avg dropped from 23 to 13.4 | Medium |

### What Increases Finding Density

| Factor | Evidence | Impact |
|--------|----------|--------|
| **Silent error swallowing** | Every epic flagged; 8-1a had 4 instances | Critical |
| **RLS bugs** | Epics 2, 5, 6, 7 all caught RLS issues in review | Critical |
| **Deferred cap violations** | Epics 4, 5, 6 exceeded 5-item cap | High |
| **LLM agents for non-narrative tasks** | 8-2 LLM for data aggregation → critical leak | High |
| **Vague ACs** | 7-1 underspecified → 31 findings | Medium |

### Follow-Through Rate by Enforcement Method

| Method | Follow-Through | Examples |
|--------|---------------|---------|
| **Scripted/automated gates** | ~90% | Close-out gate script, edge case matrix |
| **Guidelines only** | ~50% | Deferred cap, file size limits |

---

## Recommendations for Epic 9

1. **Prefer deterministic implementations** — Client portal is CRUD+RLS, not narrative. Use deterministic patterns.
2. **LLM only for narrative** — If any story needs AI-generated text (e.g., payment receipt messages), isolate LLM usage.
3. **Split any story exceeding 200 LOC** — 8-1→8-1a/b/c pattern reduced findings from 26 to 4-9.
4. **Track model per story from Epic 9 onward** — This table must be populated during each story's dev cycle, not retroactively.
5. **Stripe integration is highest-risk** — Financial domain averages 23 findings/story. Budget extra review cycles for 9-3 and 9-5.
6. **Portal security surface** — Stories 9-1 and 9-2 expose the app externally. RLS testing must be comprehensive.
