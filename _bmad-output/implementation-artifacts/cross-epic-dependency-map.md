# Cross-Epic Dependency Map: Epic 3

Maps dependencies between Epic 2 (Agent Infrastructure & Trust) outputs and Epic 3 (Client Management) stories.

## Epic 3 Stories

### 3-1: Client Data Model & CRUD

| Dependency | Source | Status | Notes |
|------------|--------|--------|-------|
| Workspace scoping | Epic 1 (workspaces table) | ✅ done | Clients are workspace-scoped |
| RLS pattern | Epic 1/2 (migrations) | ✅ done | Use `::text` JWT cast pattern (enforced by A4) |
| Provider abstraction | project-context.md rule | ⚠️ pattern exists | Client CRUD must use provider interfaces if touching external services |
| Validation boundaries | A3 audit + A5 Zod schemas | ✅ done | Apply Zod schemas to all client query boundaries |
| `mapRun` pattern | `packages/db/src/queries/agents/approval-queries.ts` | ✅ reference | Follow validated `mapRun` pattern for client row mapping |

### 3-2: Retainer Agreements & Scope-Creep Detection

| Dependency | Source | Status | Notes |
|------------|--------|--------|-------|
| Trust audit log | 2-6c (`trust_audits` table) | ✅ done | Scope-creep at 90% uses audit trail pattern |
| Trust matrix | 2-3 (`trust_matrix` table) | ✅ done | Retainer thresholds may inform trust context |
| Agent runs | 2-1a/2-1b (`agent_runs` table) | ✅ done | Hours tracked via agent run execution time |
| Validation schemas | A5 Zod schemas | ✅ done | Retainer data validated at boundary |

### 3-3: New Client Setup Wizard

| Dependency | Source | Status | Notes |
|------------|--------|--------|-------|
| Default trust levels | 2-3 (trust matrix) | ✅ done | New clients need default trust config for agents |
| Agent activation | 2-2 (agent lifecycle) | ✅ done | Wizard may trigger agent activation for new client |
| Trust badges | 2-6a (badge display) | ✅ done | Show initial trust state in wizard |
| Command palette | 1-8 (keyboard shortcuts) | ✅ done | Wizard should be keyboard-navigable |
| Undo/conflict | 1-9 (undo system) | ✅ done | Wizard steps should support undo |

## New Dependencies Introduced by Epic 3

| New Artifact | Used By | Notes |
|--------------|---------|-------|
| `clients` table | 3-1, 4-1 (Gmail), 5-1 (time), 7-1 (invoices) | Central entity, many epics depend on it |
| Client RLS policies | All client-scoped stories | Must follow `::text` JWT cast pattern |
| Scope-creep threshold | 8-2 (reporting), 8-3 (health) | 90% threshold feeds reporting |
| Setup wizard state | 10-1 (first session experience) | Wizard may merge with Day 1 experience |

## Risk Areas

1. **3-1 is a split candidate** — touches data model + CRUD + RLS + provider abstraction. Apply scope check gate (A1) before dev.
2. **Default trust levels** — 3-3 needs to define what trust config a new client gets. This is a product decision (John/Mary) before implementation.
3. **Client-scoped agent runs** — `agent_runs.client_id` column exists from Epic 2. Epic 3 must populate it correctly.
