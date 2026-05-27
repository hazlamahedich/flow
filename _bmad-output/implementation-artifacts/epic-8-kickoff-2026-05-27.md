# Epic 8 Kickoff: Reporting & Client Health

**Epic:** Epic 8 — Reporting & Client Health
**Status:** Ready for kickoff (Epic 7 complete, prerequisites met)
**Target Sprint:** Epic 8 Sprint 1
**Dependencies:** Epics 1–7 complete; Epic 2 (Agent Infrastructure) signals operational

---

## 1. Epic Overview

Epic 8 introduces automated client reporting, health monitoring, and the signature "Friday Feeling" ritual. This is the first epic where agent output becomes directly client-visible, making trust gating (from Epic 2) business-critical.

**FRs covered:** FR63, FR64, FR65, FR66, FR67, FR68, FR100, FR101
**UX-DRs covered:** UX-DR16

**Business goal:** Transform raw time/invoice/calendar data into polished, shareable client reports that demonstrate agent value and strengthen client relationships.

---

## 2. Story Breakdown

| Story | Name | Priority | Dependencies | Status |
|---|---|---|---|---|
| 8-1 | Weekly Client Reports | P0 | Epic 5 (time entries), Epic 7 (invoices) | Backlog |
| 8-2 | Weekly Report Agent Auto-Drafts | P0 | 8-1, Epic 2 (trust gates) | Backlog |
| 8-3 | Client Health Agent & Usage Analytics | P1 | 8-1, Epic 3 (client model) | Backlog |
| 8-4 | Friday Feeling Ritual | P1 | 8-1, 8-2 | Backlog |

---

## 3. Prerequisites Checklist

| Prerequisite | Status | Notes |
|---|---|---|
| Time entry data model (Epic 5) | ✅ Complete | `time_entries` table with `duration_minutes`, `invoiced_at` |
| Invoice line items with `source_type` (Epic 7) | ✅ Complete | `time_entry` billing computation operational |
| Agent orchestrator + trust matrix (Epic 2) | ✅ Complete | `AgentRunProducer`, `TrustClient`, approval queue |
| Client data model with health indicators (Epic 3) | ✅ Complete | `clients` table; health scoring deferred to this epic |
| pg-boss job scheduling | ✅ Complete | `sweep-worker.ts` pattern established |
| Signal emission infrastructure | ✅ Complete | `time_integrity_signals` table pattern |
| UI backlog audit (Epic 7 P1) | ✅ Complete | `ui-backlog-audit-epics-1-7.md` — 111 items catalogued |
| Review close-out gate (Epic 7 P2) | ✅ Complete | `scripts/review-close-out-gate.sh` with A2b gate |

---

## 4. Technical Architecture

### 4.1 Report Data Pipeline

```
┌──────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  time_entries    │────▶│              │     │                 │
│  invoice_line_items│───▶│ Report Query │────▶│ Weekly Report   │
│  agent_runs        │────▶│  Aggregator  │     │  Data Structure │
│  calendar_events   │────▶│              │     │                 │
└──────────────────┘     └──────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Weekly Report  │
                                               │  Agent (LLM)    │
                                               │  Auto-Draft     │
                                               └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Trust Gate     │
                                               │  (Epic 2)       │
                                               └─────────────────┘
                                                        │
                                           ┌────────────┴────────────┐
                                           ▼                         ▼
                                    ┌──────────┐              ┌──────────┐
                                    │ Approved │              │ Rejected │
                                    │  Queue   │              │  Audit   │
                                    └──────────┘              └──────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  PDF Export  │
                                    │  / Portal    │
                                    └──────────────┘
```

### 4.2 Database Additions

| Table | Purpose | Estimated Rows |
|---|---|---|
| `weekly_reports` | Report header (client_id, period, status, template_id) | ~100/workspace/month |
| `weekly_report_sections` | Section data (time_summary, task_log, agent_activity) | ~4/report |
| `report_templates` | User-customizable templates (JSONB sections config) | ~1–10/workspace |
| `client_health_snapshots` | Time-series health scores (engagement, payment, communication) | ~1/client/week |
| `usage_analytics` | Aggregated agent metrics (completion_rate, approval_rate) | ~1/workspace/day |

### 4.3 Agent Integration Points

| Agent | Trigger | Output | Trust Level Required |
|---|---|---|---|
| Weekly Report Agent | Cron (Monday 6:30 AM) | Draft report proposal | `auto_approve` or `suggest` |
| Client Health Agent | Daily sweep (3:00 AM) | Health signals | `suggest` (triggers approval) |
| Friday Feeling | Cron (Friday 4:00 PM) | UI notification | N/A (internal, no client action) |

---

## 5. First Story Recommendation: 8-1 Weekly Client Reports

**Why 8-1 first:**
1. **Foundation for everything else:** 8-2 (auto-drafts), 8-3 (health), and 8-4 (ritual) all consume report data structures built in 8-1.
2. **No new infra:** Uses existing tables (time_entries, invoice_line_items, agent_runs) + existing query patterns.
3. **Immediate user value:** Even without auto-drafts, manually generated reports are useful.
4. **Lower risk:** Report generation is deterministic aggregation; no LLM or trust gate complexity yet.

**8-1 Story Skeleton:**
```markdown
As a user,
I want to generate weekly client reports aggregating time, tasks, and agent activity,
So that I can review and share client progress.

AC1: Report generation RPC — given a client_id + date range, returns aggregated data
AC2: Report persistence — stores report header + sections in weekly_reports / weekly_report_sections
AC3: Report list UI — user sees list of generated reports per client
AC4: Report detail view — user sees formatted report with time summary, task log, agent activity
AC5: Report templates — user can customize sections (enable/disable) per client
AC6: Report re-generation — user can re-run report for a period if data changed
```

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Report queries are slow (N+1 across time_entries, invoices, agent_runs) | Medium | High | Pre-compute in `weekly_report_sections` at generation time; never run live aggregation on view. |
| Agent auto-drafts (8-2) hallucinate or misrepresent data | Medium | Critical | Trust gate with `suggest` level; human approval required before sharing. Report data is pre-aggregated RPC output — LLM only formats, never invents. |
| Client Health agent (8-3) produces noisy/irrelevant signals | Medium | Medium | Start with 3 hardcoded health dimensions (payment, engagement, communication); tune thresholds before adding more. |
| PDF export (8-1) formatting issues | Low | Medium | Use `pdf-lib` or server-side Puppeteer; spike in Sprint 0 if uncertain. |
| Portal sharing (8-1) leaks data between clients | Low | Critical | Reuse delivery token pattern from Epic 7 (`signDeliveryToken`); RLS policy: `client_id` matches token claim. |
| UI backlog items block 8-1 (time entry picker from Epic 7 P1) | Medium | Medium | Schedule UI sprint story in parallel: "Time Entry Picker for Invoicing" (1 point). |

---

## 7. Carry-Over from Epic 7

### 7.1 Technical Debt (file as stories)

| Item | Story | Priority |
|---|---|---|
| Agents calendar module type errors (~15) | "Fix calendar module type errors" | P2 |
| Pre-existing web type errors (~28) | "Web type cleanup pass" | P2 |
| Status constraint rename migration apply | Run `supabase db reset` in CI | P1 |
| `NOT_IMPLEMENTED` removal verification | Zero references confirmed | ✅ Done |

### 7.2 UI Backlog Items (from `ui-backlog-audit-epics-1-7.md`)

| Item | Epic | Impact |
|---|---|---|
| Time entry picker in invoice creation | Epic 7 | High — blocks `time_entry` billing UX |
| Invoice PDF preview | Epic 7 | Medium |
| Payment retry UI | Epic 7 | Medium |
| Agent status overlay polish | Epic 2 | Low |

**Recommendation:** Create one UI sprint story: "Epic 7 UI Polish: Time Entry Picker + Invoice Preview" — parallel to 8-1, 1–2 points.

---

## 8. Definition of Done (Epic 8)

- [ ] All 4 stories implemented and code-reviewed
- [ ] `pnpm typecheck` passes (0 errors in web + agents packages we touch)
- [ ] `pnpm test` passes (new tests + existing suite)
- [ ] ATDD scaffolds for 8-1, 8-2, 8-3, 8-4 written (red phase)
- [ ] Report PDF export verified with real data
- [ ] Portal sharing tested with RLS + token isolation
- [ ] Agent auto-drafts pass trust gate (human approval required)
- [ ] Client Health agent signals are actionable (not noisy)
- [ ] Friday Feeling appears in orchestrated workflow inbox
- [ ] Documentation: `epic-8-implementation-summary.md`

---

## 9. Timeline Estimate

| Phase | Duration | Notes |
|---|---|---|
| Sprint 0: Spike + scaffolding | 2 days | Report data model, template schema, PDF export spike |
| Sprint 1: 8-1 (Weekly Reports) | 5 days | Core aggregation, persistence, list/detail UI |
| Sprint 2: 8-2 (Auto-Drafts) | 5 days | Weekly Report Agent, trust gate integration |
| Sprint 3: 8-3 (Client Health) | 5 days | Health snapshots, usage analytics dashboard |
| Sprint 4: 8-4 (Friday Feeling) + polish | 3 days | Ritual UI, Epic 8 retro, close-out |

**Total: ~20 days (4 sprints)**

---

## 10. Immediate Next Steps

1. **Update sprint status:** Mark `epic-8: in_progress` in `sprint-status.yaml`
2. **Create Story 8-1 spec:** Use `bmad-create-story` skill with this kickoff as context
3. **Database migration:** Create `weekly_reports` + `weekly_report_sections` + `report_templates` tables
4. **ATDD scaffold:** Write red-phase acceptance tests for 8-1
5. **UI parallel track:** Create "Time Entry Picker" story from deferred backlog

---

**Prepared by:** BMAD Epic 7 Close-Out Team
**Date:** 2026-05-27
**Approved by:** Alice (Product Owner), Winston (Architect), Amelia (Developer)
