
## Test Verification

- 2026-06-18: Final verification after code-review patches:
  - `pnpm --filter @flow/web test 9-5a-lifecycle`: **59 passed** (0 failed).
  - `pnpm --filter @flow/web typecheck`: 0 new errors in 9-5a/billing files (76 pre-existing baseline errors in unrelated web files).
  - `pnpm --filter @flow/agents typecheck`: passes for all 9-5a files; one pre-existing error in `inbox/__tests__/executor-perf.test.ts` (missing `signalId`) unrelated to 9-5a.
  - `pnpm --filter @flow/agents test`: 89 test files / 595 tests passed; 0 new failures.
  - `pnpm --filter @flow/db typecheck`: passes.
  - `pnpm --filter @flow/shared typecheck`: passes.
  - pgTAP `supabase/tests/rls_subscription_lifecycle.sql`: 12/12 tests green (verified locally via `psql -f`).
  - Commit SHA: `49c8ef6`.

## Key Post-Review Decisions

1. **transition_to_suspended_any privilege** — granted to `service_role` only. Broad `authenticated` grant would let any user call a SECURITY DEFINER RPC that bypasses RLS ownership checks.
2. **subscription_status_updated_at column** — added and backfilled from `subscription_updated_at` because the latter is a generic audit stamp bumped by tier/period/cancel changes; conflating it with lifecycle timing caused drift.

## Deferred Work

Captured in `_bmad-output/implementation-artifacts/deferred-work.md`:
- Extract SUBSCRIPTION_TRANSITIONS map into `@flow/shared` and source migration/RPC allowlists from it in a future refactor.
- Consider 4-hour reconciliation timeout/circuit breaker for 9-7 observability.
- Audit existing `set_workspace_subscription_status` RPC; it currently permits direct `active→deleted` which the in-process transition map rejects.
