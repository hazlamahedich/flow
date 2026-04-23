---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework', 'step-03-scaffold-framework', 'step-04-docs-and-scripts', 'step-05-validate-and-summary']
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-04-23'
---

# Test Framework Setup — Progress

## Step 1: Preflight

### Stack Detection

| Property | Value |
|---|---|
| **Detected Stack** | `fullstack` |
| **Config Override** | `auto` (no override) |
| **Frontend indicators** | Next.js 15, React 19, `package.json`, `vitest.workspace.ts` |
| **Backend indicators** | Supabase, Drizzle ORM, `packages/db`, `packages/auth` |

### Prerequisites

| Check | Status |
|---|---|
| `package.json` exists | ✅ |
| No existing E2E framework | ✅ No `playwright.config.*` or `cypress.config.*` |
| Architecture docs available | ✅ `_bmad-output/planning-artifacts/architecture.md` |
| Vitest already operational | ✅ 608 tests passing |

### Project Context

- **Framework**: Next.js 15 App Router + React 19
- **Monorepo**: pnpm + Turborepo (`apps/web`, `packages/*`)
- **Auth**: Supabase Auth (magic link, device trust, session management)
- **Database**: Supabase Postgres with RLS
- **Base URL**: `http://localhost:3000`
- **Existing tests**: 77 test files, 608 tests (Vitest unit/integration)

---

## Step 2: Framework Selection

### Decision: **Playwright**

| Factor | Playwright | Cypress |
|---|---|---|
| Repo size | Large monorepo (10+ packages) | Better for small projects |
| Multi-browser | Chromium + Firefox + WebKit | Chromium-only by default |
| API testing | Built-in `request` context | Requires separate plugin |
| CI parallelism | Native shard support | Requires paid parallel |
| Next.js support | First-class App Router | Community plugin |
| Existing Vitest | Complementary | Complementary |

### Rationale

1. Fullstack monorepo needs both browser and API testing
2. Supabase Auth flows (magic link, device trust) require cross-browser validation
3. Playwright `request` fixture enables API-level testing without browser overhead
4. Turborepo already supports parallel execution — Playwright sharding fits naturally
5. `@playwright/test` provides TypeScript-first config matching project conventions

---

## Step 3: Scaffold Framework

### Files Created

| File | Purpose |
|---|---|
| `playwright.config.ts` | Main config (5 browser projects, webServer, timeouts, artifacts) |
| `tests/.env.example` | Environment variable template |
| `tests/support/merged-fixtures.ts` | Composed test via mergeTests |
| `tests/support/custom-fixtures.ts` | Project fixtures (authenticatedPage, testUser) |
| `tests/support/fixtures/data-factories.ts` | Faker-based data factories |
| `tests/support/helpers/api-helpers.ts` | API interaction helpers |
| `tests/e2e/smoke.spec.ts` | Smoke test (health check + login page) |

### Dependencies Installed

| Package | Version |
|---|---|
| `@playwright/test` | ^1.59.1 |
| `@seontechnologies/playwright-utils` | ^4.3.0 |
| `@faker-js/faker` | ^10.4.0 |

### Scripts Added

| Script | Command |
|---|---|
| `test:e2e` | `playwright test` |
| `test:e2e:ui` | `playwright test --ui` |
| `test:e2e:headed` | `playwright test --headed` |

---

## Step 4: Docs & Scripts

- Created `tests/README.md` with setup, running, architecture, best practices, and CI sections
- Scripts added to root `package.json` in Step 3

---

## Step 5: Validate & Summarize

### Validation Results

| Check | Status |
|---|---|
| Stack detected (fullstack) | ✅ |
| No conflicting framework | ✅ |
| Directory structure created | ✅ |
| Config uses TypeScript | ✅ |
| Timeouts configured (15/30/10/60s) | ✅ |
| Base URL with env fallback | ✅ |
| Trace/screenshot/video on failure | ✅ |
| Multiple reporters (HTML+JUnit+list) | ✅ |
| Parallel execution enabled | ✅ |
| CI-specific settings (retries, workers) | ✅ |
| `.env.example` created | ✅ |
| Fixtures with mergeTests | ✅ |
| Data factories with faker | ✅ |
| Sample test with data-testid selectors | ✅ |
| API helpers created | ✅ |
| `tests/README.md` created | ✅ |
| Test scripts in package.json | ✅ |
| Dependencies installed | ✅ |
| Tests discovered by Playwright | ✅ (10 tests, 1 file, 5 browser projects) |

### Fixes Applied During Validation

| Issue | Fix |
|---|---|
| `._*` macOS resource fork files discovered as tests | Added `testIgnore: ['**/._*']` to config |
| `auth-session/fixtures` exports `createAuthFixtures` not `test` | Removed auth-session from merged fixtures (needs custom Supabase provider) |
| `createAuthFixtures()` requires auth provider | Deferred to when Supabase auth provider is implemented |

### Framework Setup Complete

| Item | Value |
|---|---|
| **Framework** | Playwright 1.59.1 |
| **Browser Projects** | 5 (chromium, firefox, webkit, mobile-chrome, mobile-safari) |
| **Utils** | @seontechnologies/playwright-utils 4.3.0 |
| **Test Discovery** | 10 tests in 1 file across 5 projects |
| **Config** | `playwright.config.ts` with webServer auto-start |

### Next Steps

1. Implement Supabase auth provider for `createAuthFixtures` (needed for authenticated E2E tests)
2. Run `bmad-testarch-test-design` to plan E2E test coverage
3. Write E2E tests for critical auth flows (magic link, device trust, ownership transfer)
4. Add CI workflow with Playwright sharding
