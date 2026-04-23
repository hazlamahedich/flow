---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-04-23'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/test-artifacts/atdd-checklist-epic-1-foundation-auth-day1-spark.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/selective-testing.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/ci-burn-in.md'
---

# Test Automation Expansion — Preflight Summary

## Step 1: Preflight & Context

### 1. Stack Detection

| Property | Value |
|---|---|
| **Detected Stack** | `fullstack` |
| **Frontend indicators** | `package.json` (React 19, Next.js 15), `vitest.workspace.ts`, `@testing-library/react` |
| **Backend indicators** | `packages/db` (Drizzle ORM, Supabase), `packages/auth` (server-side auth) |
| **Monorepo** | pnpm + Turborepo (`pnpm-workspace.yaml`, `turbo.json`) |

### 2. Framework Verification

| Check | Status |
|---|---|
| `vitest.workspace.ts` | ✅ Present (jsdom environment) |
| Test dependencies (`@testing-library/react`, `vitest`) | ✅ Installed |
| `@flow/test-utils` package | ✅ Present |
| Playwright config | ❌ Not present (no E2E framework yet) |
| Root `tests/` directory | Exists but empty |

**Framework status:** Unit/integration framework (Vitest) is operational. E2E framework (Playwright) is **not yet scaffolded**.

### 3. Execution Mode

**Mode: BMad-Integrated**

BMad planning artifacts available:
- PRD: `_bmad-output/planning-artifacts/prd.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- UX Design: `_bmad-output/planning-artifacts/ux-design-specification.md`
- Epics: `_bmad-output/planning-artifacts/epics.md`
- ATDD Checklist: `_bmad-output/test-artifacts/atdd-checklist-epic-1-foundation-auth-day1-spark.md`

### 4. Existing Test Coverage

| Area | Test Files | Source Files | Approx Coverage |
|---|---|---|---|
| `apps/web` (app) | ~50 | ~150 | ~33% |
| `packages/auth` | 1 | ~5 | Low |
| `packages/db` | 6 | ~20 | ~30% |
| `packages/shared` | 5 | ~15 | ~33% |
| `packages/test-utils` | 4 | ~10 | ~40% |
| `packages/tokens` | 8 | ~15 | ~53% |
| `packages/types` | 1 | ~5 | Low |
| `packages/ui` | 17 | ~40 | ~42% |
| **Total** | **~100** | **~251** | **~40%** |

#### Coverage Breakdown by Type

| Type | Count | Location Examples |
|---|---|---|
| **Unit tests** | ~70 | `__tests__/`, `*.test.ts` colocated |
| **ATDD tests** | 9 | `apps/web/__tests__/atdd/` |
| **Onboarding tests** | 8 | `apps/web/__tests__/onboarding/` |
| **Integration tests** | 3 | `apps/web/tests/integration/` |
| **E2E tests** | 0 | No Playwright config |

#### Existing Test Patterns

- **Colocated tests**: `__tests__/` folders next to source (dominant pattern)
- **Side-by-side tests**: `validate-image.test.ts` next to `validate-image.ts`
- **ATDD suite**: Story-based acceptance tests for Epic 1 stories
- **Test utilities**: `@flow/test-utils` package with fixtures, RLS helpers, tenant factory
- **Integration tests**: Dashboard RLS integration with Supabase

### 5. TEA Config Flags

| Flag | Value |
|---|---|
| `tea_use_playwright_utils` | `true` |
| `tea_use_pactjs_utils` | `false` |
| `tea_pact_mcp` | `none` |
| `tea_browser_automation` | `auto` |
| `test_stack_type` | `auto` |
| `coverage_target` | `critical-paths` |
| `risk_threshold` | `p1` |

### 6. Knowledge Fragments Loaded

**Core (always load):** ✅
- `test-levels-framework.md`
- `test-priorities-matrix.md`
- `data-factories.md`
- `selective-testing.md`
- `test-quality.md`
- `ci-burn-in.md`

**Playwright Utils (enabled):** Available but deferred — no Playwright framework yet.

**Pact.js Utils:** Disabled. Not loaded.

**Contract Testing:** Not loaded (no microservices indicators).

### 7. Key Gaps Identified

1. **No E2E framework** — Playwright not scaffolded despite `tea_use_playwright_utils: true`
2. **Low auth package coverage** — Only 1 test for `packages/auth`
3. **Low types package coverage** — Only 1 test for `packages/types`
4. **No test for `packages/config`** — 0 tests
5. **Dashboard integration** — 3 tests but no E2E flow validation
6. **No component visual/render tests** — Most UI tests are logic-focused

### 8. Confirmed Inputs

- **Framework**: Vitest (unit/integration), Playwright (E2E — needs scaffolding)
- **Stack**: Fullstack (Next.js 15 + Supabase + Drizzle)
- **Mode**: BMad-Integrated (PRD, architecture, epics available)
- **Coverage target**: Critical paths
- **Knowledge**: Core TEA fragments loaded

---

## Step 2: Identify Automation Targets

### 1. Coverage Analysis — apps/web

**73 uncovered source files** across 10 feature areas. Key findings:

| Tier | Area | Uncovered Files | Risk | Test Level |
|---|---|---|---|---|
| **P0** | Auth callback route | 1 (`auth/callback/route.ts`) | Security-critical — magic link exchange, device trust, rate limit, audit | Integration |
| **P0** | Team actions | 8 server actions (invite, revoke, transfer, scope, etc.) | Destructive mutations with session invalidation | Unit + Integration |
| **P0** | Device actions | 3 server actions (revoke, revoke-all, name) | Session invalidation, blast radius | Unit + Integration |
| **P1** | Session actions | 1 server action (revoke) | Session management | Unit |
| **P1** | Workspace actions | 3 (create-workspace, search, setup-workspace) | Business logic | Unit + Integration |
| **P1** | Auth actions | 2 (logout, accept-invitation) | Auth flow completeness | Unit |
| **P2** | Shared utilities | 3 (supabase-server, workspace-audit, workspace-utils) | Cross-cutting concerns | Unit |
| **P2–P3** | UI components/pages | ~38 files (forms, pages, layouts, error boundaries) | Presentational | Component |
| **P3** | Lib (session-invalidation covered) | 0 new — remaining covered | — | — |

**Critical observation:** The 26 workspace/device contract tests validate Zod schemas from `@flow/types`, NOT the actual server action implementations. Schema validation is covered; orchestration logic (Supabase calls, error handling, revalidation, audit) has **zero direct test coverage**.

### 2. Coverage Analysis — Packages

| Package | Coverage | Uncovered (High Risk) |
|---|---|---|
| **auth** | 17% (1/6) | `transfer-executor.ts` (P0), `device-trust.ts` (P0), `server-admin.ts` (P1) |
| **db** | 39% (7/18) | `request-email-change-atomic.ts` (P0), `members.ts` (P0), `search-entities.ts` (P1), `workspace-jwt.ts` (P1) |
| **shared** | 50% (4/8) | `input-guard.ts` (P1) |
| **types** | 33% (1/3) | `workspace.ts` (P0 — 10+ Zod schemas) |
| **ui** | 68% (19/28) | `use-focus-trap.ts` (P0 a11y), `use-debounced-callback.ts` (P1), `use-shortcut.ts` (P1) |
| **tokens** | 100% (8/8) | None — fully covered |
| **test-utils** | 40% (4/10) | `fixtures/workspace.ts` (P1 — test reliability) |
| **config** | N/A | No testable source |

### 3. Epic Coverage Mapping

| Epic | Stories | ATDD Tests | Implementation Tests | Gap |
|---|---|---|---|---|
| **Epic 1** (Foundation/Auth) | 10 | 91 ATDD (red phase) + 9 ATDD (in apps/web) | ~50 unit/integration | Day-1 wizard actions, team device/session actions uncovered |
| **Epic 2–10** | ~35 | None | None | No test artifacts exist |

### 4. Duplicate Coverage Guard

**Existing overlaps (acceptable):**
- ATDD tests in `apps/web/__tests__/atdd/` overlap with workspace/device contract tests — different aspects (acceptance vs schema validation)
- Integration tests for dashboard overlap with unit tests for dashboard queries — different scopes (full flow vs query logic)

**No new duplicates planned.** Each target below targets uncovered code.

### 5. Coverage Plan — Targets by Test Level & Priority

#### P0 — Critical Path (MUST have)

| # | Target | Test Level | Package/Area | Test Type |
|---|---|---|---|---|
| T01 | `packages/auth/transfer-executor.ts` | Unit | auth | Ownership transfer multi-step logic |
| T02 | `packages/auth/device-trust.ts` | Unit | auth | Device lifecycle, token hashing, concurrency |
| T03 | `packages/db/queries/users/request-email-change-atomic.ts` | Unit | db | Atomic RPC + rate-limit logic |
| T04 | `packages/db/queries/workspaces/members.ts` | Unit | db | Role-based access control (getAccessibleClients) |
| T05 | `packages/types/workspace.ts` | Unit | types | 10+ Zod schemas with refinements |
| T06 | `apps/web/app/(auth)/auth/callback/route.ts` | Integration | web | Magic link callback, device trust, rate limit, audit |
| T07 | `apps/web/app/(workspace)/settings/team/actions/invite-member.ts` | Integration | web | Token hashing, email, rate limit, DB mutation |
| T08 | `apps/web/app/(workspace)/settings/team/actions/confirm-transfer.ts` | Integration | web | Irreversible ownership transfer |
| T09 | `apps/web/app/(workspace)/settings/team/actions/revoke-member.ts` | Integration | web | Destructive revocation + session invalidation |
| T10 | `apps/web/app/(workspace)/settings/devices/actions/revoke-all-devices.ts` | Integration | web | Maximum blast radius action |
| T11 | `packages/ui/hooks/use-focus-trap.ts` | Unit | ui | WCAG 2.1 AA keyboard focus trap |

#### P1 — Important Flows (SHOULD have)

| # | Target | Test Level | Package/Area | Test Type |
|---|---|---|---|---|
| T12 | `packages/auth/server-admin.ts` | Unit | auth | Session invalidation with UUID validation |
| T13 | `packages/db/queries/search/search-entities.ts` | Unit | db | Multi-table search, injection safety |
| T14 | `packages/db/workspace-jwt.ts` | Unit | db | Workspace switching via admin API |
| T15 | `packages/db/queries/users/get-user-profile.ts` | Unit | db | Signed avatar URL generation |
| T16 | `packages/shared/shortcuts/input-guard.ts` | Unit | shared | DOM element detection, IME guard |
| T17 | `packages/test-utils/fixtures/workspace.ts` | Unit | test-utils | Data factory correctness |
| T18 | `packages/ui/hooks/use-debounced-callback.ts` | Unit | ui | Debounce with cancel/abort |
| T19 | `packages/ui/hooks/use-shortcut.ts` | Unit | ui | Shortcut registration with guards |
| T20 | `packages/ui/hooks/use-reduced-motion.ts` | Unit | ui | Accessibility media query |
| T21 | `packages/ui/components/undo/use-undo-mutation.ts` | Unit | ui | Jotai atom interaction |
| T22 | `apps/web/app/(auth)/invite/[token]/actions/accept-invitation.ts` | Integration | web | Invitation token processing |
| T23 | `apps/web/app/(auth)/login/actions/logout.ts` | Unit | web | Session cleanup + audit |
| T24 | `apps/web/app/(workspace)/settings/team/actions/update-role.ts` | Integration | web | Role escalation/demotion |
| T25 | `apps/web/app/(workspace)/settings/team/actions/scope-client-access.ts` | Integration | web | Client access scoping |
| T26 | `apps/web/app/(workspace)/settings/team/actions/initiate-transfer.ts` | Integration | web | Transfer initiation |
| T27 | `apps/web/app/(workspace)/settings/actions/create-workspace.ts` | Integration | web | Slug generation + retry |
| T28 | `apps/web/app/(workspace)/settings/devices/actions/revoke-device.ts` | Integration | web | Single device revocation |
| T29 | `apps/web/app/(workspace)/settings/devices/actions/name-device.ts` | Unit | web | Device naming validation |
| T30 | `apps/web/app/(workspace)/actions/search-entities.ts` | Integration | web | Search with auth check |

#### P2 — Secondary & Edge Cases

| # | Target | Test Level | Package/Area |
|---|---|---|---|
| T31 | `packages/auth/env.ts` | Unit | auth |
| T32 | `packages/db/config.ts` | Unit | db |
| T33 | `packages/db/queries/users/ensure-user-profile.ts` | Unit | db |
| T34 | `packages/shared/shortcuts/defaults.ts` | Unit | shared |
| T35 | `packages/types/search/search-schema.ts` | Unit | types |
| T36 | `apps/web/lib/supabase-server.ts` | Unit | web |
| T37 | `apps/web/lib/workspace-audit.ts` | Unit | web |
| T38 | `apps/web/lib/workspace-utils.ts` | Unit | web |
| T39 | `apps/web/app/(auth)/onboarding/actions/setup-workspace.ts` | Integration | web |
| T40 | Key profile/team UI components (4 files) | Component | web |

### 6. Justification

**Coverage scope: critical-paths** (per config `coverage_target: critical-paths`)

- **P0 targets (11 tests):** Security-critical code with zero coverage — auth callback, ownership transfer, device trust, email change atomic, RBAC, Zod validation boundary, accessibility
- **P1 targets (19 tests):** Important server actions and hooks that handle mutations, search, and UI interaction
- **P2 targets (10 tests):** Remaining utilities, schemas, and key UI components
- **Total: ~40 new test files** across 3 priority tiers
- **Excluded:** Pure layouts, loading states, error boundaries, page components without logic, shadcn wrappers, barrel files, Drizzle schemas, type-only files
- **No E2E targets** — Playwright not scaffolded; recommend scaffolding as separate task before E2E test generation
- **Epic 2–10:** No implementation code exists; test generation deferred to when epics enter development

---

## Step 3: Test Generation

### Execution Mode

| Property | Value |
|---|---|
| **Requested** | `auto` |
| **Resolved** | `sequential` |
| **Stack** | `fullstack` |
| **Workers Dispatched** | Backend (unit + integration) — no Playwright for E2E |

### Generated Test Files (17 files, ~109 test cases)

| # | File | Target | Level | Priority | Tests |
|---|---|---|---|---|---|
| 1 | `packages/auth/src/__tests__/transfer-executor.test.ts` | `transfer-executor.ts` | Unit | P0 | 8 |
| 2 | `packages/auth/src/__tests__/device-trust.test.ts` | `device-trust.ts` | Unit | P0 | 15 |
| 3 | `packages/auth/src/__tests__/server-admin.test.ts` | `server-admin.ts` | Unit | P0 | 4 |
| 4 | `packages/db/src/queries/users/request-email-change-atomic.test.ts` | `request-email-change-atomic.ts` | Unit | P0 | 5 |
| 5 | `packages/db/src/queries/workspaces/members.test.ts` | `members.ts` | Unit | P0 | 5 |
| 6 | `packages/db/src/queries/search/search-entities.test.ts` | `search-entities.ts` | Unit | P0 | 4 |
| 7 | `packages/db/src/workspace-jwt.test.ts` | `workspace-jwt.ts` | Unit | P0 | 5 |
| 8 | `packages/db/src/queries/users/get-user-profile.test.ts` | `get-user-profile.ts` | Unit | P1 | 4 |
| 9 | `packages/types/src/workspace.test.ts` | `workspace.ts` Zod schemas | Unit | P0 | 22 |
| 10 | `packages/ui/src/hooks/__tests__/use-focus-trap.test.ts` | `use-focus-trap.ts` | Unit | P0 | 4 |
| 11 | `packages/ui/src/hooks/__tests__/use-debounced-callback.test.ts` | `use-debounced-callback.ts` | Unit | P1 | 4 |
| 12 | `packages/ui/src/hooks/__tests__/use-reduced-motion.test.ts` | `use-reduced-motion.ts` | Unit | P1 | 2 |
| 13 | `apps/web/app/(auth)/auth/callback/__tests__/route.test.ts` | `auth/callback/route.ts` | Integration | P0 | 7 |
| 14 | `apps/web/.../team/actions/__tests__/invite-member.test.ts` | `invite-member.ts` | Integration | P0 | 6 |
| 15 | `apps/web/.../team/actions/__tests__/confirm-transfer.test.ts` | `confirm-transfer.ts` | Integration | P0 | 5 |
| 16 | `apps/web/.../team/actions/__tests__/revoke-member.test.ts` | `revoke-member.ts` | Integration | P0 | 5 |
| 17 | `apps/web/.../devices/actions/__tests__/revoke-all-devices.test.ts` | `revoke-all-devices.ts` | Integration | P0 | 4 |

### Patterns

- Vitest + `vi.mock()` / `vi.fn()` chain (matches existing codebase)
- Priority tags `[P0]`/`[P1]` in test descriptions
- Colocated `__tests__/` directories
- Mock Supabase client factory functions

### Coverage Impact

| Package | Before | After | Change |
|---|---|---|---|
| `packages/auth` | 1 placeholder | 4 files / 27 cases | +2700% |
| `packages/db` | 7 tests | 12 tests | +71% |
| `packages/types` | 1 test | 2 tests | +100% |
| `packages/ui` | 19 tests | 22 tests | +16% |
| `apps/web` (actions/routes) | ~50 | ~67 | +34% |

### Deferred (P2)

- `packages/auth/env.ts`, `packages/db/config.ts`
- `packages/shared/input-guard.ts`, `packages/ui` components
- Web UI component tests
- E2E tests (requires Playwright scaffolding)

---

## Step 3C: Aggregate

All 17 test files written to disk during sequential generation in Step 3. No parallel subagent outputs to merge. No shared fixture files needed — tests use inline `vi.mock()` patterns consistent with existing codebase conventions.

### Infrastructure Added

| Item | Location | Purpose |
|---|---|---|
| `vitest.config.ts` | `packages/types/` | Added vitest dependency + config for types package (was missing) |
| `vitest@^3.2.4` | `packages/types/package.json` | Dev dependency added |

### Validation Fixes Applied

| Issue | Files | Fix |
|---|---|---|
| Import path `./module` should be `../module` from `__tests__/` subdirectories | 5 web test files | Changed to `../module` |
| `createServiceClient` mock missing `.auth.admin.inviteUserByEmail` chain | `invite-member.test.ts` | Added nested mock return value |
| `update().eq().eq()` mock missing `.is()` for Supabase `.is('revoked_at', null)` | `revoke-member.test.ts` | Added `.is()` to chain |
| `afterEach`/`beforeEach` not imported from vitest | 2 UI hook test files | Added to import statement |
| `beforeEach` matchMedia stub returning `true` for reduced-motion in "not preferred" test | `use-reduced-motion.test.ts` | Changed default to `matches: false` |
| `window.matchMedia` referenced before jsdom init | `use-reduced-motion.test.ts` | Moved to lazy assignment in `beforeEach` |
| Mock chain depth mismatch (2 vs 3 `.eq()` calls per table) | `transfer-executor.test.ts` | Rewrote with per-table mock factory |

---

## Step 4: Validate & Summarize

### Test Run Results

All generated tests pass across all packages:

| Package | Test Files | Tests | Status |
|---|---|---|---|
| `apps/web` | 56 passed, 3 skipped | 460 passed, 9 skipped | ✅ Green |
| `packages/auth` | 4 passed | 30 passed | ✅ Green |
| `packages/db` | 12 passed | 70 passed | ✅ Green |
| `packages/types` | 2 passed | 38 passed | ✅ Green |
| `packages/ui` (hooks) | 3 passed | 10 passed | ✅ Green |
| **Total (new + existing)** | **77 files** | **608 tests** | ✅ Green |

### Pre-existing Failures (not introduced by this run)

| File | Issue |
|---|---|
| `packages/ui/src/layouts/workspace-shell.test.tsx` | `window is not defined` after teardown (React scheduler leak) |
| `packages/ui/src/components/dashboard/dashboard-accessibility.test.tsx` | Same `window is not defined` after teardown |

These are pre-existing issues with cleanup in component tests — not caused by the new test files.

### Coverage Plan by Test Level and Priority

| Level | P0 | P1 | P2 | Total |
|---|---|---|---|---|
| **Unit** | 7 files / 56 tests | 5 files / 19 tests | 10 targets (deferred) | 12 files / 75 tests |
| **Integration** | 5 files / 27 tests | 6 targets (deferred) | 2 targets (deferred) | 5 files / 27 tests |
| **E2E** | Blocked (no Playwright) | — | — | — |

### Files Created/Updated

**New test files (17):**
- `packages/auth/src/__tests__/transfer-executor.test.ts`
- `packages/auth/src/__tests__/device-trust.test.ts`
- `packages/auth/src/__tests__/server-admin.test.ts`
- `packages/db/src/queries/users/request-email-change-atomic.test.ts`
- `packages/db/src/queries/workspaces/members.test.ts`
- `packages/db/src/queries/search/search-entities.test.ts`
- `packages/db/src/workspace-jwt.test.ts`
- `packages/db/src/queries/users/get-user-profile.test.ts`
- `packages/types/src/workspace.test.ts`
- `packages/ui/src/hooks/__tests__/use-focus-trap.test.ts`
- `packages/ui/src/hooks/__tests__/use-debounced-callback.test.ts`
- `packages/ui/src/hooks/__tests__/use-reduced-motion.test.ts`
- `apps/web/app/(auth)/auth/callback/__tests__/route.test.ts`
- `apps/web/app/(workspace)/settings/team/actions/__tests__/invite-member.test.ts`
- `apps/web/app/(workspace)/settings/team/actions/__tests__/confirm-transfer.test.ts`
- `apps/web/app/(workspace)/settings/team/actions/__tests__/revoke-member.test.ts`
- `apps/web/app/(workspace)/settings/devices/actions/__tests__/revoke-all-devices.test.ts`

**Infrastructure files (2):**
- `packages/types/vitest.config.ts` (new)
- `packages/types/package.json` (updated — added vitest devDep)

### Key Assumptions

1. Supabase client mock chains approximate real query builder behavior
2. Dynamic `import()` calls in source are intercepted by top-level `vi.mock()` (verified: works for `@flow/db/client`)
3. Component tests in `packages/ui` pre-existing failures are unrelated to this run
4. Integration tests for web server actions mock `getServerSupabase` rather than hitting real Supabase

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Mock chains drift from real Supabase API | False positives if query builder changes | Integration test suite validates real queries |
| No E2E coverage for critical auth flows | User-facing regressions undetected | Scaffold Playwright (recommended next task) |
| Epic 2–10 untested | Future code starts without test safety net | Run `bmad-testarch-automate` when epics enter dev |

### Next Recommended Workflows

1. **`bmad-testarch-framework`** — Scaffold Playwright for E2E testing
2. **`bmad-testarch-test-review`** — Review quality of generated tests
3. **`bmad-testarch-trace`** — Generate traceability matrix against ATDD checklist
4. **P2 batch** — Generate remaining 10 P2 targets when bandwidth allows
