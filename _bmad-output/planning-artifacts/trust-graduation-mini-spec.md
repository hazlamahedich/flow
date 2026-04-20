# Trust Graduation Mini-Spec

_Status: Complete | Derived from: architecture.md, prd.md, ux-design-specification.md_
_Risk classification: Highest-risk subsystem — P1 blast radius (stale trust state = single-tenant corruption)_

---

## 1. System Overview

The trust graduation system determines whether each of Flow OS's 6 AI agents can act autonomously or requires human approval. It is a **safety interlock**, not a feature — wrong trust decisions either paralyze VAs with confirmation fatigue or allow agents to send embarrassing client-facing output.

**Core thesis (from PRD):** Trust is earned per-action-type, not per-agent. It builds through demonstrated competence (~7:1 positive-to-negative ratio) and drops catastrophically on violation (10x faster than it builds). The system **never auto-advances silently** — it suggests, the VA decides.

**Design principle:** Trust is application-level logic, separate from RLS. RLS governs data access (can this user see this data?). Trust governs agent behavior (can this agent perform this action autonomously?). These are two independent gates.

---

## 2. Data Model

### 2.1 Trust Levels

```sql
CREATE TYPE trust_level AS ENUM ('supervised', 'confirm', 'auto');
```

| Level | Behavior | UX Tone |
|-------|----------|---------|
| `supervised` | Agent proposes, VA must approve every time | "Is this correct?" |
| `confirm` | Agent acts, VA reviews briefly within deadline (30 min) | "I handled this — want to check?" |
| `auto` | Agent executes immediately, VA sees in digest | "I handled this the way you would." |

Three levels only. Each maps to a meaningful behavioral difference. More granularity adds cognitive load without proportional value.

### 2.2 Core Table: `trust_matrix`

```sql
CREATE TABLE trust_matrix (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspaces(id),
  agent_id              TEXT NOT NULL,  -- 'inbox' | 'calendar' | 'ar-collection' | 'weekly-report' | 'client-health' | 'time-integrity'
  action_type           TEXT NOT NULL,  -- agent-specific action types
  current_level         trust_level NOT NULL DEFAULT 'supervised',
  score                 SMALLINT NOT NULL DEFAULT 0,  -- 0-200 scale
  total_executions      INTEGER NOT NULL DEFAULT 0,
  successful_executions INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  violation_count       INTEGER NOT NULL DEFAULT 0,
  last_transition_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_violation_at     TIMESTAMPTZ,
  cooldown_until        TIMESTAMPTZ,  -- NULL when no cooldown active
  version               INTEGER NOT NULL DEFAULT 1,  -- incremented on every transition
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workspace_id, agent_id, action_type)
);

CREATE INDEX idx_trust_matrix_workspace ON trust_matrix(workspace_id, agent_id);
CREATE INDEX idx_trust_matrix_cooldown ON trust_matrix(cooldown_until) WHERE cooldown_until IS NOT NULL;
```

- `workspace_id` derived from JWT (never from URL params or client submissions)
- Sparse by design: only rows for agent×action combinations that have been exercised
- `version` incremented atomically on every transition — enables snapshot locking

### 2.3 Transition Log (Event-Sourced)

```sql
CREATE TABLE trust_transitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_entry_id   UUID NOT NULL REFERENCES trust_matrix(id),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id),
  from_level        trust_level NOT NULL,
  to_level          trust_level NOT NULL,
  trigger_type      TEXT NOT NULL,  -- 'graduation' | 'violation' | 'precheck_failure' | 'manual_override' | 'context_shift' | 'cooldown_expired'
  trigger_reason    TEXT NOT NULL,
  snapshot          JSONB NOT NULL,  -- full matrix row state at decision time
  actor             TEXT NOT NULL,   -- 'system' | 'va:{user_id}' | 'admin:{user_id}'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_transitions_entry ON trust_transitions(matrix_entry_id, created_at DESC);
CREATE INDEX idx_trust_transitions_workspace ON trust_transitions(workspace_id, created_at DESC);
```

Every transition is an immutable event. Full auditability: who changed what, why, and what the numbers were at that moment.

### 2.4 Versioned Snapshots (Decision-Time Lock)

```sql
CREATE TABLE trust_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL,
  execution_id      UUID NOT NULL,  -- references agent_runs.id
  agent_id          TEXT NOT NULL,
  action_type       TEXT NOT NULL,
  matrix_version    INTEGER NOT NULL,
  level             trust_level NOT NULL,
  score             SMALLINT NOT NULL,
  snapshot_hash     TEXT NOT NULL,  -- SHA-256 for integrity
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Snapshots prevent the TOCTOU problem: between pre-check and execution completion, trust could change. The execution uses the snapshot's trust level, not a live re-read.

### 2.5 Pre-Conditions Table (FR33)

```sql
CREATE TABLE trust_preconditions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL,
  agent_id          TEXT NOT NULL,
  action_type       TEXT NOT NULL,
  condition_key     TEXT NOT NULL,    -- e.g., 'valid_email_on_file', 'client_active_contract'
  condition_expr    TEXT NOT NULL,    -- JSONPath evaluated against execution context
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workspace_id, agent_id, action_type, condition_key)
);
```

---

## 3. State Machine

### 3.1 Transition Diagram

```
SUPERVISED ──(graduation)──► CONFIRM ──(graduation)──► AUTO
     ▲                         │                         │
     │                         │         soft_violation   │
     │                         │◄────────────────────────┘
     │                         │                         │
     │      hard_violation     │      hard_violation     │
     └◄────────────────────────┴─────────────────────────┘
     
     ◄──── manual_override (any → any) ────►
```

### 3.2 Transition Rules

| # | From | To | Trigger | Guard Conditions |
|---|------|----|---------|-----------------|
| T1 | `supervised` | `confirm` | Performance threshold | score ≥ 70, consecutive_successes ≥ 7, no violation in 7 days, cooldown expired or NULL |
| T2 | `confirm` | `auto` | Performance threshold | score ≥ 140, consecutive_successes ≥ 14 (at confirm), total_executions at confirm ≥ 20, no violation in 14 days, cooldown expired or NULL |
| T3 | `auto` | `confirm` | Soft violation (first at auto) | Unconditional — first violation gets grace step |
| T4 | `auto` | `supervised` | Hard violation or second soft within 30 days | Post-execution constraint violation (FR31) = hard. Second soft within 30 days = hard. |
| T5 | `confirm` | `supervised` | Any violation at confirm | Unconditional — no grace at confirm level |
| T6 | Any | Any | Manual override (FR32) | Unconditional — VA sets any level. Bypasses all guards. Triggers 7-day cooldown before system re-suggests. |

**Key invariants:**
- Graduation (T1, T2) is a **suggestion** — VA must explicitly accept
- Downgrade (T3, T4, T5) is **automatic and immediate** — no VA confirmation required
- Manual override (T6) is **unconditional** — VA always has final authority
- Only one transition per evaluation — no two-step jumps (except manual override)

### 3.3 Special: Pre-Check Failure (FR34)

Pre-check failure is NOT a state transition. It downgrades the **instance** to supervised, not the trust level. The agent must get approval for this specific execution, but the matrix cell is not permanently changed. However, the score is reduced by −5 (floor 0).

---

## 4. Scoring Model

### 4.1 Score Mechanics (0–200 scale, asymmetric)

| Event | Score Change | Rationale |
|-------|-------------|-----------|
| Successful execution at `supervised` | +1 | Slow build — trust is earned through pattern |
| Successful execution at `confirm` | +1 | Confirmed competence still builds trust |
| Successful execution at `auto` | +0 | Auto doesn't build more trust — you're already trusted |
| Violation (any severity) | −10 to −20 | Fast erosion — base −10, modified by risk_weight |
| Pre-check failure (FR34) | −5 | Caught before damage — less severe |
| Post-execution violation (FR31) | −20 | Damage occurred — most severe penalty |

**The 7:1 ratio:** 7 successful executions (+7) undone by 1 violation (−10). Trust builds slower than it erodes, matching the PRD's "trust drops 10x faster" requirement.

### 4.2 Graduation Thresholds

| Target Level | Min Score | Min Consecutive Successes | Additional Guards |
|-------------|-----------|--------------------------|-------------------|
| `confirm` | 70 | 7 | No violation in 7 days, cooldown expired |
| `auto` | 140 | 14 (at confirm level) + 20 total at confirm | No violation in 14 days, cooldown expired |

Scores do **not** decay over time. Trust is demonstrated competence, not recency. The context-shift detector handles the "been away" case with a suggestion, not a penalty.

### 4.3 Risk Weights (per action type)

Base violation cost is −10. Risk weight modifies this:

| Agent | Action Type | Risk Weight | Adjusted Violation Cost | Rationale |
|-------|------------|-------------|------------------------|-----------|
| **Inbox** | `categorize_email` | 0.5 | −5 | Reversible, non-client-facing |
| **Inbox** | `extract_action_items` | 0.5 | −5 | Internal only |
| **Inbox** | `draft_response` | 1.5 | −15 | Client-facing, represents VA's voice |
| **Calendar** | `schedule_meeting` | 1.0 | −10 | Affects VA's calendar |
| **Calendar** | `detect_conflict` | 0.5 | −5 | Read-only analysis |
| **Calendar** | `send_invite` | 1.5 | −15 | Client-facing, time-committed |
| **AR Collection** | `draft_followup_email` | 2.0 | −20 | Financial + client-facing, highest stakes |
| **AR Collection** | `schedule_reminder` | 1.0 | −10 | Internal, affects cash flow cadence |
| **Weekly Report** | `compile_report` | 0.5 | −5 | Internal, reviewable before delivery |
| **Weekly Report** | `draft_summary` | 1.0 | −10 | May reach client |
| **Client Health** | `analyze_health` | 0.5 | −5 | Read-only analysis |
| **Client Health** | `flag_risk` | 1.5 | −15 | Triggers workflows — false positives costly |
| **Client Health** | `draft_communication` | 2.0 | −20 | Client-facing during sensitive situations |
| **Time Integrity** | `detect_anomaly` | 1.0 | −10 | Flags issues internally |
| **Time Integrity** | `flag_entry` | 1.5 | −15 | May affect billing |

**Matrix dimensions:** 6 agents × ~2.5 avg action types = **15 cells** (sparse, not 72 — the architecture doc's "~72 cells" was an upper bound). Only exercised combinations get rows.

---

## 5. Cooldown Rules

### 5.1 Downgrade Cooldown

After any downgrade (violation or manual override to lower level):
- `cooldown_until` = `NOW() + INTERVAL '7 days'`
- System **must not** suggest re-upgrade during cooldown
- VA can still manually override during cooldown (FR32)
- Manual override during cooldown **does not** reset cooldown timer

### 5.2 Context-Shift Detection

If a VA has no executions for a given agent×action_type for **30+ days**:
- System creates a *suggestion*: "You haven't worked with [Agent]'s [action] recently. Want to review its trust level?"
- Suggestion only — no automatic change
- If VA accepts: AUTO→CONFIRM (not supervised — preserve some earned trust)
- The 30-day window resets on any execution

### 5.3 Manual Override Cooldown

When VA manually sets a trust level:
- 7-day cooldown prevents system from suggesting a *different* level
- Exception: violations override manual-override cooldown immediately
- Prevents "nagging" after a deliberate VA decision

---

## 6. Execution Flow

### 6.1 Pre-Check Flow (`packages/trust/pre-check.ts`)

```
Input: (workspaceId, agentId, actionType, executionContext)
Output: TrustDecision

1. Read trust_matrix row for (workspaceId, agentId, actionType)
   - If no row → create with defaults (supervised, score=0)
2. Check cooldown: if cooldown_until > NOW() → note (system won't suggest upgrade)
3. Evaluate preconditions from trust_preconditions
   - Each condition_key's condition_expr evaluated against executionContext
   - If any fails → score -= 5 (floor 0), notify VA
   - Return: { allowed: true, level: 'supervised', requiresApproval: true, failedPrecondition }
4. Capture snapshot → write to trust_snapshots
5. Return TrustDecision:
   {
     allowed: true,
     level: TrustLevel,
     requiresApproval: level !== 'auto',
     approvalDeadline: level === 'confirm' ? NOW() + 30min : null,
     snapshotId: UUID
   }
```

### 6.2 Post-Execution Validation (FR31)

```
Input: (executionId, constraints)
Output: ValidationResult

1. Retrieve snapshot for executionId
2. Evaluate post-execution constraints against actual output
3. If violation:
   a. Halt delivery — output quarantined, never sent to client
   b. Alert VA via notification
   c. Downgrade:
      - AUTO → SUPERVISED (hard violation, skip confirm grace)
      - CONFIRM → SUPERVISED
      - SUPERVISED → stays, score -= 20
   d. Log transition with trigger_type = 'violation'
   e. Set cooldown_until = NOW() + 7 days
   f. Return { delivered: false, violation: true, newLevel }
```

### 6.3 Outcome Recording

```
recordSuccess(snapshotId):
  - score += level-based points (+1 for supervised, +1 for confirm, +0 for auto)
  - consecutive_successes += 1
  - total_executions += 1, successful_executions += 1
  - Check graduation thresholds → create suggestion if met and cooldown expired

recordViolation(snapshotId, severity):
  - score -= risk_weight_adjusted_cost (floor 0)
  - consecutive_successes = 0
  - violation_count += 1
  - Apply state transition per T3/T4/T5 rules
  - Set cooldown_until = NOW() + 7 days
  - Emit 'trust.violation.recorded' signal
```

---

## 7. TypeScript Contracts (`packages/trust/`)

### 7.1 Core Types (`types.ts`)

```typescript
import { z } from 'zod';

export const TrustLevel = z.enum(['supervised', 'confirm', 'auto']);
export type TrustLevel = z.infer<typeof TrustLevel>;

export const AgentId = z.enum([
  'inbox', 'calendar', 'ar-collection',
  'weekly-report', 'client-health', 'time-integrity',
]);
export type AgentId = z.infer<typeof AgentId>;

export const TrustDecision = z.object({
  allowed: z.boolean(),
  level: TrustLevel,
  requiresApproval: z.boolean(),
  approvalDeadline: z.string().datetime().nullable(),
  snapshotId: z.string().uuid(),
  failedPrecondition: z.string().optional(),
});
export type TrustDecision = z.infer<typeof TrustDecision>;

export const GraduationSuggestion = z.object({
  matrixEntryId: z.string().uuid(),
  agentId: AgentId,
  actionType: z.string(),
  currentLevel: TrustLevel,
  suggestedLevel: TrustLevel,
  reason: z.string(),
  metrics: z.object({
    score: z.number(),
    consecutiveSuccesses: z.number(),
    totalExecutions: z.number(),
  }),
  createdAt: z.string().datetime(),
});
export type GraduationSuggestion = z.infer<typeof GraduationSuggestion>;

export const TransitionCause = z.discriminatedUnion('type', [
  z.object({ type: z.literal('graduation'), consecutiveSuccesses: z.number() }),
  z.object({ type: z.literal('violation'), severity: z.enum(['soft', 'hard']), description: z.string() }),
  z.object({ type: z.literal('precheck_failure'), checkName: z.string(), detail: z.string() }),
  z.object({ type: z.literal('manual_override'), overriddenBy: z.string().uuid(), reason: z.string() }),
  z.object({ type: z.literal('context_shift'), daysInactive: z.number() }),
  z.object({ type: z.literal('cooldown_expired') }),
]);
export type TransitionCause = z.infer<typeof TransitionCause>;
```

### 7.2 Function Signatures

```typescript
// packages/trust/graduation.ts

export function evaluateTransition(
  request: EvaluationRequest,
  config: TrustConfig,
): EvaluationResult;

export function canGraduate(
  level: TrustLevel,
  score: number,
  consecutiveSuccesses: number,
  cooldownUntil: string | null,
  lastViolationAt: string | null,
): boolean;

// packages/trust/pre-check.ts

export function preCheck(
  workspaceId: string,
  agentId: AgentId,
  actionType: string,
  context: Record<string, unknown>,
): Promise<TrustDecision>;

// packages/trust/rollback.ts

export function applyViolation(
  currentLevel: TrustLevel,
  violationType: 'soft' | 'hard',
  previousViolationsInWindow: number,
): TrustLevel;

// packages/trust/middleware.ts (trust gate factory)

export function trustGate(
  agentId: AgentId,
  actionType: string,
): (handler: Function) => Promise<Function>;
```

---

## 8. Scheduled Jobs (via Trigger.dev)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `trust-graduation-evaluator` | Every 6 hours | Scans matrix cells, generates graduation suggestions where thresholds met and cooldown expired |
| `trust-cooldown-expiry` | Every 1 hour | Finds cells where cooldown_until has passed, marks eligible for suggestion |
| `trust-context-shift-detector` | Every 24 hours | Finds cells with no execution in 30+ days, creates review suggestions |
| `trust-suggestion-purger` | Every 7 days | Archives suggestions older than 14 days that haven't been acted on |
| `trust-anomaly-scanner` | Nightly | Verifies trust matrix invariants per tenant (no negative scores, cooldown timestamps valid, asymmetry ratio healthy) |

---

## 9. Graduation Suggestion Flow

The system **suggests**. The VA **decides**.

```
trust-graduation-evaluator runs (every 6 hours)
  → Scans all matrix cells for thresholds met
  → Filters out cells with active cooldown
  → Creates GraduationSuggestion record
  → Emits 'trust.suggestion.created' signal
  → UI shows notification to VA

VA interaction:
  → Accept: transition fires, celebration UI, cooldown set (7 days)
  → Dismiss: suggestion archived, no cooldown triggered
  
Celebration UX mapping:
  supervised → confirm: "Building" emotional token (blue #3B82F6)
    "You and [Agent] have been clicking. Ready for lighter oversight on [action]?"
  confirm → auto: "Auto" emotional token (green #22C55E)  
    "[Agent] has earned your trust on [action]. Let them handle it?"
  Any downgrade: "Established" → "Building"
    "Let's walk together again for a while. Here's what happened."
```

---

## 10. Test Strategy

### P0 Tests — Ship Blockers (16 tests)

| # | Test | Risk |
|---|------|------|
| P0-1 | 7 consecutive clean approvals → supervised→confirm suggestion fires | Trust never builds |
| P0-2 | 14 consecutive clean at confirm + 20 total → confirm→auto suggestion fires | VA drowns in approvals |
| P0-3 | Violation at auto → drops to confirm (soft), not supervised (grace) | Over-reaction to first mistake |
| P0-4 | Second soft violation at auto within 30 days → drops to supervised | Repeated failures compound |
| P0-5 | Violation at confirm → drops to supervised | Bad trust persists |
| P0-6 | Post-execution violation → output quarantined, never sent to client, trust drops | **B2B2B embarrassment cascade** |
| P0-7 | Manual override to any level works regardless of cooldown | VA loses control |
| P0-8 | Cooldown blocks upgrade suggestion for 7 days, then allows | Trust permanently stuck or oscillates |
| P0-9 | Race: Stripe marks invoice paid after agent reads "overdue" but before send → agent must re-check | **Client gets "overdue" for paid invoice** |
| P0-10 | Race: success and violation arrive simultaneously → violation takes precedence | Violation erased by race |
| P0-11 | Pre-check failure → instance downgraded to supervised, trust score −5, matrix level unchanged | Permanent false downgrade |
| P0-12 | Violation at supervised → stays supervised, no negative state | Undefined state crash |
| P0-13 | Trust asymmetry: drops auto→supervised on single hard violation; rebuild requires 7+ clean to reach confirm | Trust re-inflates too fast |
| P0-14 | Score never goes below 0 (floor) | Negative score corrupts logic |
| P0-15 | Two concurrent overrides for same cell → last-write-wins with consistent snapshot | Split-brain trust state |
| P0-16 | Snapshot trust level differs from live level mid-execution → execution still accepted (authorized at snapshot time) | Retroactive invalidation |

### P1 Tests — Must Have Before GA (15 tests)

| # | Test | Risk |
|---|------|------|
| P1-1 | Cooldown is per-(agent, action_type), not global | One agent's mistake freezes all |
| P1-2 | Multiple downgrades within cooldown → cooldown starts from last downgrade | Clock resets wrong direction |
| P1-3 | Cooldown boundary: 6d 23h 59m → blocked; 7d 0h 1m → allowed | Off-by-one flakiness |
| P1-4 | VA absence 30+ days → context shift suggestion fires | Agents run wild with stale context |
| P1-5 | VA absence <30 days → no context shift trigger | Nuisance prompts |
| P1-6 | Context shift accepted: auto→confirm (not auto→supervised) | All learning lost |
| P1-7 | Context shift declined → trust unchanged | Accidental downgrade on decline |
| P1-8 | Context shift for already-supervised → no suggestion offered | Confusing "reduce" prompt |
| P1-9 | Every transition creates versioned snapshot with actor and reason | No audit trail |
| P1-10 | Snapshot query returns correct state at any historical point | Can't debug incidents |
| P1-11 | Minor edit at confirm level → trust holds, observation logged | Minor mistakes = major penalties |
| P1-12 | Wrong contact name at confirm → rejection, trust drops to supervised | Serious mistakes don't register |
| P1-13 | Risk weight applied correctly per action type (financial actions penalize more) | All violations treated equal |
| P1-14 | New agent added → defaults to supervised for all action types | New agent starts at wrong level |
| P1-15 | Event sourcing replay produces identical trust state | Audit reconstruction fails |

### P2 Tests — Important for Reliability (7 tests)

| # | Test |
|---|------|
| P2-1 | Full matrix: all 15 cells operate independently — agent A's trust never bleeds to agent B |
| P2-2 | Action type removed → orphaned data handled gracefully |
| P2-3 | Concurrent reads during transition → readers see old or new, never partial |
| P2-4 | Trust lookup p99 < 50ms at 1000 workspaces × 15 cells |
| P2-5 | Postgres connection pool survives mass trust recalculation |
| P2-6 | Event sourcing replay over 100 transitions produces correct final state |
| P2-7 | Snapshot hash integrity — tampered snapshot detected and rejected |

**Total: 38 automated tests for the core trust state machine. Ship blocked until 38/38 green.**

---

## 11. File Structure

```
packages/trust/
├── src/
│   ├── types.ts              # Zod schemas + discriminated unions
│   ├── types.test.ts         # 12 tests: Zod parse every variant
│   ├── graduation.ts         # evaluateTransition(), canGraduate()
│   ├── graduation.test.ts    # 30 tests: all transition arcs + scoring + cooldown
│   ├── pre-check.ts          # preCheck(), runPreChecks()
│   ├── pre-check.test.ts     # 6 tests: precondition evaluation
│   ├── rollback.ts           # applyViolation()
│   ├── rollback.test.ts      # 5 tests: violation severity handling
│   ├── middleware.ts          # trustGate() factory for route handlers
│   ├── middleware.test.ts     # 4 tests: gate blocks/allows correctly
│   ├── scoring.ts            # score calculation with risk weights
│   ├── scoring.test.ts       # 8 tests: asymmetric scoring, floor, risk weights
│   ├── viewport.ts           # sparse matrix state machine (Jotai atom source)
│   ├── viewport.test.ts      # 5 tests: matrix operations
│   ├── cadence.ts            # review cadence per tier
│   ├── cadence.test.ts       # 3 tests: cadence timing
│   └── index.ts
└── package.json
```

**Agent consumption layer:**

```
packages/agents/shared/
├── trust-client.ts           # reads matrix, calls preCheck, records outcomes
├── trust-client.test.ts      # integration tests with real trust package
```

Agents never import from `packages/trust/` directly — they use `trust-client.ts` which provides a simplified API surface: `canAct()`, `recordSuccess()`, `recordViolation()`.

---

## 12. UX Integration Points

Trust progression is surfaced to the VA through:

1. **TrustBadge component** (`packages/ui/components/trust-badge.tsx`) — shows current level per agent with emotional token colors
2. **Graduation suggestion notification** — celebration moment, VA must accept
3. **Dignified rollback notification** — "Let's walk together again" language, never punitive
4. **Agent detail page** (`(workspace)/agents/[agentId]/`) — full trust history with timeline
5. **Inbox density modulation** — gap/border density shifts with dominant trust tier (Supervised 16px → Confirm 20px → Auto 28px)
6. **Trust milestone celebrations** — "100 tasks, no stumbles" — earned, not gamified

Components receive trust state as props. `ui/` never imports from `trust/`.
