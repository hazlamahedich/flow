# Adversarial Review: Story 8.4 Friday Feeling Ritual

**Reviewers:** Winston (Architect), Amelia (Developer), Murat (Test Architect)
**Status:** Blocked

## Findings

### CRITICAL
- **Timezone Ambiguity & Sweep Logic:** The AC states the sweep runs at "4:00 PM local time" and "9:00 AM local time". A single global cron schedule cannot achieve this. The `workspaces` table needs a `timezone` column, and the sweep worker must run at least hourly (or use a per-tenant scheduling mechanism via pg-boss/Trigger.dev) to process workspaces currently hitting their target local time. (Winston, Amelia, Murat)

### HIGH
- **Idempotency & Race Conditions:** What happens if the sweep process crashes halfway and retries? Without a `UNIQUE(workspace_id, week_start)` constraint on `friday_feeling_summaries`, you risk generating duplicate summaries for the same week. The `wednesday_affirmations` table needs a similar constraint (`UNIQUE(workspace_id, team_member_id, generated_date)` or similar). (Winston, Amelia, Murat)
- **RLS Gap for "Agency Owners":** AC3 states Wednesday affirmations are for "agency owners only". However, the schema and AC5 don't specify how we verify owner status in RLS. We can't just check `workspace_id` matching; the policy must enforce a role check. (Murat)
- **Test Coverage / Zero-Activity Edge Case:** AC0 test list misses the edge case from AC6. `executor.test.ts` must explicitly include a red-phase test for the zero-activity fallback state. (Amelia)
- **Time-Coupled Test Flakiness:** `executor.test.ts` will be a nightmare of flaky tests if it relies on real time. AC0 must explicitly mandate strict time-mocking (e.g., using `vi.useFakeTimers()`). (Murat)
- **Undefined "Agency Workspace":** AC3 dictates generating Wednesday affirmations for "agency workspaces". There is no schema definition or flag mentioned for how to identify an agency workspace versus a standard one. (Winston)

### MEDIUM
- **Query Performance on Trust Milestones:** To calculate `trust_milestones`, the agent will scan `trust_snapshots` or `agent_signals` for the entire week. We need a compound index on `(workspace_id, created_at)` in those source tables. (Murat)
- **Retry Mechanisms:** If a workspace's generation fails due to a transient DB lock, do they not get a Friday Feeling this week? We need a defined retry policy (e.g., via `pg-boss` job retries). (Murat)
- **Schema Integrity:** Task 2.1 lacks constraints for integer fields. Add `CHECK (tasks_handled >= 0)` and `CHECK (time_saved_minutes >= 0)`. Task 2.2 `team_member_id` foreign key must include `ON DELETE CASCADE`. (Amelia)
- **Sweep Worker Scalability:** Doing synchronous DB aggregations across all workspaces in a single worker pass will eventually lead to memory exhaustion and query timeouts. The cron should trigger a fan-out pattern. (Winston)

### ENHANCEMENT
- **Hardcoded Heuristic:** The `time_saved_minutes` calculation (`tasks_handled * 5`) should be encapsulated in a pure function or shared constant rather than burying it in a raw SQL query or deep within the executor logic. (Winston)
