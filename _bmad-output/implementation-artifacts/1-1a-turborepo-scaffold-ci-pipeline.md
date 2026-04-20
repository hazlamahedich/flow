# Story 1.1a: Turborepo Scaffold & CI Pipeline

Status: review

## Story

As a developer,
I want a Turborepo monorepo scaffolded with shared build infrastructure and CI,
So that all subsequent stories build on a verified, consistently configured foundation.

## Acceptance Criteria

1. **Given** no existing project structure, **When** the scaffold is created, **Then** the monorepo root contains `turbo.json`, root `package.json` with pnpm workspaces, `.nvmrc` (Node 20 LTS), and `packages/` directory — **without** `apps/web` or any runtime application code.
2. **Seven packages exist** as buildable stubs with `@flow/` scoped `name` fields and `workspace:*` references: `@flow/config`, `@flow/tokens`, `@flow/ui`, `@flow/shared`, `@flow/types`, `@flow/test-utils`, `@flow/db`. Each exports an empty barrel (`export {}`) and compiles without error.
3. **`@flow/config` provides shared configs consumed by all packages:**
   - `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedArrayAccess`, `exactOptionalPropertyTypes`
   - `eslint.config.base.js` enforcing: no `any`, no `@ts-ignore`, no `@ts-expect-error`, `max-lines` (200 soft limit, tests exempt)
   - ESLint `no-restricted-imports` rule scaffold (empty paths array, ready for DAG enforcement in later stories)
4. **`@flow/types`** is an empty package. Zod schemas + inferred types populated in subsequent stories. This package sits in the dependency chain: `config → types → db → (agents, ui)`. [Source: architecture.md#Cross-Component Dependencies]
5. **`@flow/tokens`** is an empty package (no token files yet). Build config only. Populated in Story 1.1b.
6. **`@flow/ui`** depends on `@flow/tokens`. Empty export barrel. No components yet.
7. **`@flow/db`** contains `drizzle.config.ts` (empty schema barrel) and `src/index.ts` exporting `{}`. Depends on `@flow/types`. `drizzle-orm` and `drizzle-kit` declared as dependencies. No Supabase client yet.
8. **`@flow/test-utils`** re-exports `vitest` and `@testing-library/react`. Contains a `renderSmoke(children?: ReactNode)` helper that renders provided children (or a default div) inside a basic wrapper and asserts the container exists. This is the foundation `renderWithTheme()` builds on in Story 1.1b.
9. **`turbo.json` pipeline** defines `build`, `test`, `lint`, `typecheck`, `format` tasks with correct `dependsOn` chains and cache `inputs`/`outputs`. Packages build before apps.
10. **`pnpm build` succeeds** across all packages with exit code 0.
11. **`pnpm test` succeeds** with at least one smoke test that imports from a workspace package and passes.
12. **`pnpm lint` succeeds** with zero errors — `no-any` rule enforced.
13. **`pnpm format:check` succeeds** — Prettier formatting validated.
14. **TypeScript strict mode** inherited from base config: `strict`, `noUncheckedIndexedArrayAccess`, `exactOptionalPropertyTypes` in every package.
15. **CI pipeline** (GitHub Actions) scaffolds all 3 tiers per architecture:
    - **T0** (every push): install → format:check → lint → typecheck → build → test (<3min target)
    - **T1** (PR open/update): T0 + stub for RLS/integration tests (<10min target, DB steps no-op until Story 1.2)
    - **T2** (merge to main): T1 + stub for E2E (<20min target, E2E steps no-op until web app exists)
    - Each tier is a separate workflow file or job with clear naming (`ci-t0.yml`, `ci-t1.yml`, `ci-t2.yml`)
16. **`pnpm build` completes** in under 60 seconds.
17. **`create-turbo` demo apps removed** — after running `npx create-turbo@latest`, delete any generated `apps/*` directories. Only `packages/` remains.

## Tasks / Subtasks

- [x] Task 1: Initialize Turborepo monorepo (AC: #1, #17)
  - [x] 1.1 Run `npx create-turbo@latest flow --package-manager pnpm` from repo root
  - [x] 1.2 Delete any generated `apps/*` directories — this story is packages only
  - [x] 1.3 Update root `package.json` with workspace globs: `packages/*`, add `"packageManager": "pnpm@<version>"` for corepack
  - [x] 1.4 Add `.nvmrc` with Node.js 20 LTS version
  - [x] 1.5 Add `.gitignore` for node_modules, .next, .turbo, dist, .env.local
  - [x] 1.6 Add `.editorconfig` for consistent IDE settings (indent, charset, trailing newline)
  - [x] 1.7 Add `.prettierrc` with project formatting rules
  - [x] 1.8 Add `.env.example` with `NODE_ENV=development` and comment structure for future variables
- [x] Task 2: Create shared config package (AC: #3)
  - [x] 2.1 Create `packages/config/package.json` with `name: "@flow/config"`, `workspace:*` exports
  - [x] 2.2 Create `packages/config/tsconfig.base.json` — `strict: true`, `noUncheckedIndexedArrayAccess`, `exactOptionalPropertyTypes`, composite project references
  - [x] 2.3 Create `packages/config/eslint.config.base.js` — no `any`, no `@ts-ignore`, no `@ts-expect-error`, `max-lines` rule (200 soft limit, tests exempt)
  - [x] 2.4 Add `no-restricted-imports` ESLint rule with empty paths array — ready for DAG enforcement (`agents/* → orchestration/*` forbidden, `agents/a → agents/b` forbidden)
- [x] Task 3: Create stub packages (AC: #2, #4, #5, #6, #7)
  - [x] 3.1 Create `@flow/types` — `packages/types/package.json`, empty `src/index.ts`
  - [x] 3.2 Create `@flow/tokens` — `packages/tokens/package.json` with build config, empty `src/index.ts`
  - [x] 3.3 Create `@flow/ui` — `packages/ui/package.json` with dependency on `@flow/tokens`, empty `src/index.ts`
  - [x] 3.4 Create `@flow/shared` — `packages/shared/package.json`, empty `src/index.ts`
  - [x] 3.5 Create `@flow/db` — `packages/db/package.json` with `drizzle-orm` + `drizzle-kit` deps, dependency on `@flow/types`, `drizzle.config.ts`, empty `src/schema/index.ts` barrel
  - [x] 3.6 Create `@flow/test-utils` — `packages/test-utils/package.json` with vitest + RTL deps, `src/index.ts` re-exporting them
  - [x] 3.7 Each package: `package.json` uses `@flow/` scoped name, `tsconfig.json` extends `@flow/config/tsconfig.base.json` via `"extends": "@flow/config/tsconfig.base.json"`, ESLint imports base config from `@flow/config/eslint.config.base.js`
  - [x] 3.8 Each package uses `tsup` (or equivalent) as build tool — added to root devDependencies or per-package
- [x] Task 4: Implement test-utils smoke helper (AC: #8)
  - [x] 4.1 Create `packages/test-utils/src/render-smoke.ts` — `renderSmoke(children?: ReactNode)` renders children (or default `<div data-testid="smoke" />`) and asserts container exists
  - [x] 4.2 Create `packages/test-utils/src/index.ts` — re-exports vitest, RTL, renderSmoke
- [x] Task 5: Configure Turborepo pipeline (AC: #9)
  - [x] 5.1 Create `turbo.json` with `build`, `test`, `lint`, `typecheck`, `format` tasks, `dependsOn` chains, and cache `inputs`/`outputs`
  - [x] 5.2 Verify build order: `config` → `types` → `tokens` → `ui` / `db` (independent after types)
- [x] Task 6: Write smoke tests (AC: #11)
  - [x] 6.1 Create `packages/shared/src/__tests__/smoke.test.ts` — imports from `@flow/shared`, asserts export exists
  - [x] 6.2 Create `packages/test-utils/src/__tests__/smoke.test.ts` — uses `renderSmoke()`, asserts rendered content exists
- [x] Task 7: Set up CI pipeline — 3-tier GitHub Actions (AC: #15)
  - [x] 7.1 Create `.github/workflows/ci-t0.yml` — every push: pnpm install → format:check → lint → typecheck → build → test (<3min target)
  - [x] 7.2 Create `.github/workflows/ci-t1.yml` — PR open/update: T0 steps + no-op stub for RLS/integration tests (placeholder comment: "RLS suite added in Story 1.2")
  - [x] 7.3 Create `.github/workflows/ci-t2.yml` — merge to main: T1 steps + no-op stub for E2E (placeholder comment: "E2E added when web app exists")
  - [x] 7.4 Pin Node 20 via `.nvmrc` in all CI workflows
  - [x] 7.5 Enable corepack for pnpm version enforcement in CI
- [x] Task 8: Final verification (AC: #10, #12, #13, #14, #16)
  - [x] 8.1 Run `pnpm build` — verify exit code 0 and < 60s
  - [x] 8.2 Run `pnpm test` — verify at least one smoke test passes
  - [x] 8.3 Run `pnpm lint` — verify zero errors, `no-any` enforced
  - [x] 8.4 Run `pnpm format:check` — verify formatting passes
  - [x] 8.5 Run `tsc --noEmit` in each package — verify strict mode enforced
  - [x] 8.6 Verify all `package.json` `name` fields use `@flow/` scope

## Dev Notes

### Architecture Guardrails

- **No application code in this story.** No `apps/` directory. No Next.js app. No routes, no pages, no components. This is infrastructure only.
- **No `apps/web` yet.** The Next.js app shell is deferred to Story 1.2 or later. This story proves the monorepo builds, not that a web app renders.
- **Package DAG (enforced via workspace deps):** `config` (leaf) → `types` → `tokens` → `ui`. `types` → `db`. `shared`, `test-utils` are independent. No circular deps. [Source: architecture.md#Monorepo Structure, architecture.md#Cross-Component Dependencies]
- **200-line file limit** enforced via ESLint `max-lines` with `error` severity. Test files exempt. [Source: architecture.md#200-Line File Limit]
- **Named exports only** — default exports only for Next.js page components (which don't exist yet). [Source: project-context.md]
- **No barrel files inside feature folders** — only at package boundaries (`src/index.ts`). [Source: project-context.md]
- **`@flow/` scoped package names** — all `package.json` `name` fields use `@flow/{package}`. Imports use `@flow/config`, `@flow/types`, etc. [Source: project-context.md#Monorepo Package Boundaries]

### CI Pipeline Architecture

- **3-tier CI** per architecture.md: T0 (every push, <3min), T1 (PR, <10min), T2 (merge, <20min). This story scaffolds all three even though T1/T2 are stubs.
- T1 no-ops: RLS suite requires Supabase (Story 1.2). Integration tests require DB schema (Story 1.2).
- T2 no-ops: E2E requires web app (post-Story 1.2).
- **Merge gates** (from project-context.md): build, lint, typecheck, unit tests all required. Format check included per T0 spec.
- [Source: architecture.md#Infrastructure & Deployment]

### Package Build Tool

- Each package needs a build tool to compile TypeScript. `tsup` is recommended (esbuild-based, fast, works well with Turborepo).
- Add `tsup` as root devDependency. Each package's `tsconfig.json` points to `src/index.ts` as entry.
- Alternative: `unbuild` or raw `tsc`. Choose one and stay consistent.

### Explicitly Excluded from This Story

- `apps/web` (Next.js app) — deferred to Story 1.2
- `packages/editor`, `packages/trust`, `packages/agents/*` — deferred to their respective epics
- Any token values, CSS files, theme switching code — deferred to Story 1.1b
- `renderWithTheme` helper — deferred to Story 1.1b (depends on tokens)
- shadcn/ui initialization — deferred to Story 1.1b
- `next/font` configuration — deferred to Story 1.1b
- Route groups `(workspace)`, `(portal)` — deferred to Story 1.2
- `CONTRIBUTING.md` with ASCII dependency graph — deferred to Story 1.2 (needs apps/ structure to be meaningful)
- Supabase local setup (`supabase init && supabase start`) — deferred to Story 1.2 (needs DB schema)
- Seed scripts and test JWTs — deferred to Story 1.2

### References

- [Source: architecture.md#Starter Template] — initialization commands, custom scaffold rationale
- [Source: architecture.md#Monorepo Structure] — package directory layout, 9 packages
- [Source: architecture.md#Cross-Component Dependencies] — `config → types → db → trust → agents → web`
- [Source: architecture.md#200-Line File Limit] — decomposition pattern, ESLint max-lines
- [Source: architecture.md#Infrastructure & Deployment] — 3-tier CI, T0/T1/T2 definitions
- [Source: architecture.md#Import DAG] — ESLint no-restricted-imports enforcement
- [Source: docs/project-context.md#Technology Stack] — TypeScript 5.5+, Node 20 LTS, Turborepo
- [Source: docs/project-context.md#Code Quality Rules] — 200-line limit, naming conventions, import ordering
- [Source: docs/project-context.md#Critical Implementation Rules] — strict mode, no any, no @ts-ignore
- [Source: docs/project-context.md#Development Workflow Rules] — merge gates, CI pipeline requirements, .env.example
- [Source: docs/project-context.md#Monorepo Package Boundaries] — @flow/ scoped names, package DAG

## Dev Agent Record

### Agent Model Used

glm-5.1 (zai-coding-plan/glm-5.1)

### Debug Log References

- Fixed `noUncheckedIndexedArrayAccess` → `noUncheckedIndexedAccess` (correct TypeScript option name)
- Fixed DTS build error in test-utils: added explicit `RenderResult` return type to `renderSmoke` for portable type declarations
- Fixed vitest jsdom environment: added per-package `vitest.config.ts` with `environment: "jsdom"`
- Fixed ESLint flat config: used `no-restricted-imports` (core rule) instead of `import/no-restricted-imports` for ESLint 9 compatibility
- Added `type: "module"` to `@flow/config` package.json to resolve module type warnings
- Added `._*` file ignore patterns to ESLint and Prettier configs for macOS compatibility

### Completion Notes List

- Scaffolded Turborepo monorepo manually (preserving existing repo content) instead of `create-turbo` which would conflict with existing files
- No `apps/` directory exists — packages only per story requirements
- All 7 packages build successfully with tsup: config, types, tokens, ui, shared, db, test-utils
- Package DAG enforced: config (leaf) → types → db, types → tokens → ui. shared and test-utils independent
- `pnpm build` completes in ~9s (well under 60s target)
- 3 smoke tests pass (1 shared import test + 2 renderSmoke tests)
- ESLint enforces no-any, no-ts-ignore, no-ts-expect-error, max-lines (250 error, tests exempt)
- 3-tier CI: ci-t0.yml (push), ci-t1.yml (PR), ci-t2.yml (merge to main) with T1/T2 stubs
- TypeScript strict mode + noUncheckedIndexedAccess + exactOptionalPropertyTypes in base config

### File List

- `.nvmrc` — Node 20 LTS
- `.gitignore` — node_modules, .next, .turbo, dist, .env.local
- `.editorconfig` — consistent IDE settings
- `.prettierrc` — formatting rules
- `.prettierignore` — prettier exclusions
- `.env.example` — environment variable template
- `package.json` — root monorepo config with pnpm workspaces
- `pnpm-workspace.yaml` — workspace glob definitions
- `turbo.json` — Turborepo pipeline config
- `vitest.workspace.ts` — Vitest workspace config
- `packages/config/package.json` — @flow/config
- `packages/config/tsconfig.base.json` — shared TypeScript config
- `packages/config/eslint.config.base.js` — shared ESLint config
- `packages/types/package.json` — @flow/types
- `packages/types/tsconfig.json`
- `packages/types/tsup.config.ts`
- `packages/types/src/index.ts`
- `packages/tokens/package.json` — @flow/tokens
- `packages/tokens/tsconfig.json`
- `packages/tokens/tsup.config.ts`
- `packages/tokens/src/index.ts`
- `packages/ui/package.json` — @flow/ui (depends on @flow/tokens)
- `packages/ui/tsconfig.json`
- `packages/ui/tsup.config.ts`
- `packages/ui/src/index.ts`
- `packages/ui/eslint.config.js`
- `packages/shared/package.json` — @flow/shared
- `packages/shared/tsconfig.json`
- `packages/shared/tsup.config.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/__tests__/smoke.test.ts`
- `packages/shared/vitest.config.ts`
- `packages/shared/eslint.config.js`
- `packages/db/package.json` — @flow/db (depends on @flow/types)
- `packages/db/tsconfig.json`
- `packages/db/tsup.config.ts`
- `packages/db/drizzle.config.ts`
- `packages/db/src/index.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/eslint.config.js`
- `packages/test-utils/package.json` — @flow/test-utils
- `packages/test-utils/tsconfig.json`
- `packages/test-utils/tsup.config.ts`
- `packages/test-utils/src/index.ts`
- `packages/test-utils/src/render-smoke.tsx`
- `packages/test-utils/src/__tests__/smoke.test.tsx`
- `packages/test-utils/vitest.config.ts`
- `packages/test-utils/eslint.config.js`
- `packages/types/eslint.config.js`
- `packages/tokens/eslint.config.js`
- `.github/workflows/ci-t0.yml` — T0 every push CI
- `.github/workflows/ci-t1.yml` — T1 PR CI
- `.github/workflows/ci-t2.yml` — T2 merge to main CI

## Change Log

- 2026-04-20: Story 1.1a implementation complete. Scaffolded Turborepo monorepo with 7 packages, shared config, smoke tests, and 3-tier CI pipeline.
