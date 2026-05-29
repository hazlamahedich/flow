# Adversarial Review: Story 8.2 (Weekly Report Agent Auto-Drafts)

**Date:** 2026-05-29
**Reviewers:** Winston (Architect), Amelia (Developer Agent), Murat (Test Architect)
**Status:** Resolved (Findings applied to story)

## CRITICAL Findings

- **Location:** AC3, Pre-Dev Scan / **Problem:** Monorepo violation (importing from apps/web to packages/). / **Fix Applied:** Refactored dependency to extract `aggregateReportData` into a shared package (`@flow/db/queries` or `@flow/shared`) prior to agent consumption.
- **Location:** AC3 / **Problem:** `service_role` query lacks `workspaceId`, risking cross-tenant data leak. / **Fix Applied:** Updated `aggregateReportData` signature to strictly require `workspaceId`.
- **Location:** AC3 / **Problem:** `aggregateReportData` crashes in worker context due to `cookies()`. / **Fix Applied:** Refactored `aggregateReportData` to accept an injected `SupabaseClient` as its first argument.
- **Location:** AC6, Task 3.7 / **Problem:** `supabase-js` lacks client-side transactions for multi-write. / **Fix Applied:** Specified Drizzle ORM for transaction or Supabase RPC `create_weekly_report_with_sections`.
- **Location:** AC1, Task 3 / **Problem:** Violation of agent module contract and mock DB anti-pattern. / **Fix Applied:** Enforced standard module contract (`executor.ts`, `pre-checks.ts`). Moved execution lifecycle testing to integration tests with real local Supabase.

## HIGH Findings

- **Location:** EC9, AC9 / **Problem:** Unscalable batch processing (50+ clients sequentially). / **Fix Applied:** Redesigned to fan-out architecture (one orchestrator job per workspace enqueuing individual client jobs).
- **Location:** AC10, Task 3.8 / **Problem:** Idempotency is fragile and vulnerable to race conditions. 24h human-override cooldown ignored. / **Fix Applied:** Added DB-level UNIQUE constraint on `(client_id, period_start, period_end)` where `status = 'draft'`. Enforced 24h cooldown on rejected proposals.
- **Location:** AC4 / **Problem:** Missing `stalled_items` (negative-space reporting) mandated by context. / **Fix Applied:** Added `stalled_items` to the required report sections and prompt.
- **Location:** Task 9.4 / **Problem:** Polling explicitly banned in project context. / **Fix Applied:** Replaced polling with Supabase Realtime `postgres_changes` subscription.
- **Location:** AC4 / **Problem:** LLM budget limits ignored. / **Fix Applied:** Added workspace LLM budget check before `generateText()`.
- **Location:** Task 3.9 / **Problem:** 200-line file limit violation for orchestration. / **Fix Applied:** Decomposed into `process-weekly-report-run.ts` and `process-client-report.ts`.

## MEDIUM Findings

- **Location:** AC3, AC5 / **Problem:** Period calculation timezone mismatch (uses UTC instead of workspace-local). / **Fix Applied:** Anchored reporting period calculation to workspace-local timezone.
- **Location:** AC9, Task 8.1 / **Problem:** Naive local LLM retry loop. / **Fix Applied:** Hooked into global LLM circuit breaker utility.
- **Location:** Task 9.2 / **Problem:** Server Action missing explicit `workspace_id` extraction from session. / **Fix Applied:** Explicitly stated `workspace_id` extraction and validation in Task 9.2.
- **Location:** AC10 / **Problem:** Fragile timestamps for idempotency keys. / **Fix Applied:** Use ISO week string or standard date for period component.

## ENHANCEMENT Findings

- **Location:** AC4 / **Problem:** Unbounded LLM input context window. / **Fix Applied:** Added truncation/summarization limits in `aggregateReportData`.
- **Location:** AC9 / **Problem:** Incorrect timeout status (`timed_out` instead of `paused`). / **Fix Applied:** Changed timeout state to `paused` with resume state payload.
- **Location:** AC0 / **Problem:** Vanity metrics for ATDD tests. / **Fix Applied:** Replaced arbitrary test counts with specific risk coverage scenarios (cross-tenant, concurrency, hallucination).
