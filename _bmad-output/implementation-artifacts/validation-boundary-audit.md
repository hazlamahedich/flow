# Validation Boundary Audit

**Date:** 2026-04-26
**Trigger:** Epic 2 retrospective action item A3
**Blocker for:** Epic 3 (must complete before 3-1)

## Summary

Audited all Supabase DB boundary files in `packages/db/` and `apps/web/`. Found **60+ unsafe `as` type casts** across 10 files. All casts replaced with Zod schema validation.

## Boundary Files Audited

### packages/db — Query Layer

| File | `as` Casts | Status |
|------|-----------|--------|
| `queries/agents/approval-queries.ts` | 24 (mapRun) + 1 (breakdown) | ✅ Zod schema added |
| `queries/agents/history-queries.ts` | 4 (mapFeedback) + 12 (history mapping) | ✅ Zod schema added (mapFeedback); mapRun already validated |
| `queries/trust/audit-queries.ts` | 10 (events) + 5 (auto actions) | ✅ Zod schemas added |
| `queries/trust/checkin-settings.ts` | 2 (settings) | ⚠️ Low risk — settings is `jsonb`, pattern is read/merge/write |

### apps/web — Server Actions & Lib

| File | `as` Casts | Status |
|------|-----------|--------|
| `agents/lib/trust-summary.ts` | 3 (trust matrix) + 1 (milestones) | ✅ Zod schemas added |
| `agents/actions/correction-actions.ts` | 5 | ⚠️ Low risk — server action inputs from validated forms |
| `agents/actions/feedback-actions.ts` | 5 | ⚠️ Low risk — server action inputs from validated forms |
| `agents/actions/trust-actions.ts` | 3 | ⚠️ Low risk — server action inputs from validated forms |
| `agents/approvals/components/use-approval-realtime.ts` | 14 | ⚠️ Deferred — realtime payload from Supabase channel |
| `agents/approvals/actions/batch-approve-runs.ts` | 2 | ⚠️ Low risk — uses mapRun which is now validated |
| `agents/approvals/actions/batch-reject-runs.ts` | 2 | ⚠️ Low risk — uses mapRun which is now validated |
| `agents/approvals/actions/approve-run.ts` | 3 | ⚠️ Low risk — uses mapRun which is now validated |

## Zod Schemas Added

### agentRunRowSchema (`packages/db/src/queries/agents/approval-queries.ts`)
Validates all 23 fields of `agent_runs` row before mapping to `AgentRun` type. Uses `.passthrough()` to allow additional Supabase metadata fields.

### feedbackRowSchema (`packages/db/src/queries/agents/history-queries.ts`)
Validates `id`, `sentiment` (enum), `note`, `created_at`. Uses `safeParse` — returns null on invalid data rather than throwing.

### trustMatrixRowSchema (`apps/web/app/(workspace)/agents/lib/trust-summary.ts`)
Validates trust matrix row with `current_level` as `z.enum(['supervised', 'confirm', 'auto'])` — catches invalid trust levels at runtime.

### trustMilestoneRowSchema (`apps/web/app/(workspace)/agents/lib/trust-summary.ts`)
Validates milestone row fields.

### trustEventRowSchema (`packages/db/src/queries/trust/audit-queries.ts`)
Validates trust transition events including nested `trust_matrix` join.

### autoActionRowSchema (`packages/db/src/queries/trust/audit-queries.ts`)
Validates auto action rows from agent_runs query.

## Additional Fixes

| Fix | File | Issue |
|-----|------|-------|
| NaN guard | `packages/trust/src/badge-state.ts` | `deriveBadgeState` now returns 0 for invalid dates instead of NaN |
| atomCache cleanup | `apps/web/lib/atoms/trust.ts` | `trustBadgeMapAtom.onMount` cleanup clears cache on atom unmount |
| Thinking animation | `packages/ui/src/components/agent-status-bar/agent-status-item.tsx` | CSS keyframe pulse using token config |
| RLS alignment | `supabase/migrations/20260430000002_...sql` | All trust/feedback RLS policies now use `::text` JWT cast pattern |
| Milestone constraint | Same migration | `CHECK` constraint on `milestone_type` column |

## Remaining Items

| Item | Risk | Recommendation |
|------|------|----------------|
| `checkin-settings.ts` settings casts | Low — jsonb read/merge | Add Zod schema when settings structure formalized |
| Server action input casts | Low — form-validated | Add Zod schemas when actions are refactored |
| Realtime payload casts | Medium — external data | Add Zod schema when realtime integration is stabilized |
| `error-display.tsx` casts | Low — display only | Add Zod schema when error types are formalized |

## Pattern for New Boundaries

All new DB query boundaries should follow this pattern:

```typescript
import { z } from 'zod';

const rowSchema = z.object({
  // validate every field accessed
  field_name: z.string(),
}).passthrough();

function mapRow(raw: Record<string, unknown>): DestinationType {
  const parsed = rowSchema.parse(raw);
  return {
    fieldName: parsed.field_name,
    // ...
  };
}
```

Rules:
- Use `.parse()` for critical boundaries (trust, auth, money)
- Use `.safeParse()` for display-only or best-effort boundaries
- Use `.passthrough()` to allow extra Supabase metadata
- Use `z.enum()` for union types instead of bare `as` casts
