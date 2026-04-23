---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-04-23'
workflowType: 'testarch-atdd'
storyId: '1'
storyKey: 'epic-1-foundation-auth-day1-spark'
storyFile: '_bmad-output/planning-artifacts/epics.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-epic-1-foundation-auth-day1-spark.md'
generatedTestFiles:
  - 'tests/support/factories/workspace.factory.ts'
  - 'tests/api/epic-1/story-1.1a-turborepo-scaffold.spec.ts'
  - 'tests/api/epic-1/story-1.1b-design-system-tokens.spec.ts'
  - 'tests/api/epic-1/story-1.2-database-foundation.spec.ts'
  - 'tests/api/epic-1/story-1.3-magic-link-auth.spec.ts'
  - 'tests/api/epic-1/story-1.4-workspace-team-management.spec.ts'
  - 'tests/api/epic-1/story-1.5-profile-editing.spec.ts'
  - 'tests/e2e/epic-1/auth-workspace-e2e.spec.ts'
  - 'tests/e2e/epic-1/layout-dashboard-wizard.spec.ts'
  - 'tests/e2e/epic-1/profile-layout-cmdpalette-e2e.spec.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - 'docs/project-context.md'
---

# ATDD Checklist - Epic 1: Foundation, Auth & Day 1 Spark

**Date:** 2026-04-23
**Author:** team mantis
**Primary Test Level:** Fullstack (API + E2E + Component)

---

## Story Summary

Epic 1 establishes the foundational infrastructure for Flow OS: Turborepo monorepo, design system tokens, database with RLS/tenant isolation, magic link auth, workspace/team management, user profiles, persistent layout shell, home dashboard, command palette, undo/conflict resolution, and the Day 1 Micro-Wizard.

**As a** developer and user
**I want** a solid foundation with authentication, workspace management, and a compelling first experience
**So that** all subsequent epics build on verified infrastructure and users experience value immediately

---

## Acceptance Criteria Coverage

| Story | FRs | API Tests | E2E Tests | Priority |
|---|---|---|---|---|
| 1.1a Turborepo Scaffold | — | 7 | — | P0 |
| 1.1b Design System Tokens | UX-DR1-DR7 | 9 | — | P0 |
| 1.2 Database & Tenant Isolation | FR1-6, FR91, FR93 | 9 | — | P0 |
| 1.3 Magic Link Auth | FR7, FR10 | 7 | 4 | P0 |
| 1.4 Workspace & Team Mgmt | FR1-6, FR10 | 8 | 5 | P0 |
| 1.5/1.5a Profile & Email | FR9 | 14 | 5 | P0/P1 |
| 1.6 Layout Shell | FR75, FR98 | 5 | 1 | P0 |
| 1.7 Home Dashboard | FR74, FR76 | 5 | — | P0 |
| 1.8 Cmd Palette & Shortcuts | FR77, FR99 | 4 | 1 | P0 |
| 1.9 Undo & Conflict | FR78, FR93 | 3 | 1 | P0 |
| 1.10 Day 1 Micro-Wizard | FR69-73, FR97 | 6 | 1 | P0/P1 |
| **Total** | **19 FRs, 7 UX-DRs** | **77** | **18** | — |

---

## Red-Phase Test Scaffolds Created

### API Tests (77 tests across 6 files)

**File:** `tests/api/epic-1/story-1.1a-turborepo-scaffold.spec.ts`
- ✅ monorepo root structure is correct
- ✅ six packages exist as buildable stubs
- ✅ config package has strict tsconfig and eslint config
- ✅ turbo.json pipeline defines build/test/lint/typecheck
- ✅ test-utils re-exports vitest and RTL
- ✅ db package has drizzle config and schema barrel
- ✅ CI pipeline exists for PR workflow

**File:** `tests/api/epic-1/story-1.1b-design-system-tokens.spec.ts`
- ✅ tokens package has zero runtime dependencies
- ✅ exports map includes all required paths
- ✅ dark theme tokens match spec values
- ✅ light theme tokens match spec values
- ✅ all semantic tokens exist in both themes (no orphans)
- ✅ six agent identity colors defined
- ✅ typography scale complete
- ✅ trust-density gap tokens defined
- ✅ WCAG contrast validation passes
- ✅ token completeness validation passes

**File:** `tests/api/epic-1/story-1.2-database-foundation.spec.ts`
- ✅ workspaces table exists
- ✅ users table with profile fields
- ✅ workspace_members role column enum
- ✅ RLS enforced on every workspace-scoped table
- ✅ workspace_id ::text cast in RLS policies
- ✅ requireTenantContext middleware
- ✅ cross-workspace data isolation
- ✅ app_config for tier limits
- ✅ factory-based test tenant provisioning

**File:** `tests/api/epic-1/story-1.3-magic-link-auth.spec.ts`
- ✅ magic link 15-min expiry
- ✅ rate limit: 5 attempts/hour
- ✅ valid link authenticates and redirects
- ✅ expired link rejected
- ✅ remember device extended session
- ✅ session invalidation on role change
- ✅ TLS 1.3 enforcement

**File:** `tests/api/epic-1/story-1.4-workspace-team-management.spec.ts`
- ✅ create workspace becomes owner
- ✅ invite member via email
- ✅ assign roles (all 4 types)
- ✅ revoke access invalidates sessions
- ✅ time-bound subcontractor auto-expiry
- ✅ ownership transfer flow
- ✅ data-layer access scoping
- ✅ view/revoke active sessions

**File:** `tests/api/epic-1/story-1.5-profile-editing.spec.ts`
- ✅ update name (Unicode, 1-100 chars)
- ✅ update timezone (IANA)
- ✅ avatar magic bytes validation
- ✅ avatar 2MB limit
- ✅ avatar removal
- ✅ INSERT ON CONFLICT profile creation
- ✅ RLS self-scope enforcement
- ✅ 401 for unauthenticated
- ✅ email change verification flow
- ✅ email change rate limit
- ✅ auth + public email sync
- ✅ session revocation on email change
- ✅ split-brain reconciliation
- ✅ cancel pending email change

### E2E Tests (18 tests across 3 files)

**File:** `tests/e2e/epic-1/auth-workspace-e2e.spec.ts`
- ✅ complete magic link flow
- ✅ expired link shows resend
- ✅ rate limit UI feedback
- ✅ remember device toggle
- ✅ create workspace
- ✅ invite team member
- ✅ revoke member access
- ✅ time-bound subcontractor
- ✅ ownership transfer

**File:** `tests/e2e/epic-1/layout-dashboard-wizard.spec.ts`
- ✅ sidebar 240px expanded / 56px collapsed
- ✅ navigation links present
- ✅ timer slot placeholder
- ✅ free tier no sidebar
- ✅ nav transitions <2s
- ✅ dashboard sections visible
- ✅ empty state CTAs
- ✅ skeleton during load
- ✅ dashboard <3s
- ✅ keyboard navigation
- ✅ Cmd+K opens palette
- ✅ search <500ms
- ✅ 15+ actions available
- ✅ undo within 30s
- ✅ concurrent edit conflict UI
- ✅ wizard flow
- ✅ mock agent action
- ✅ wizard <5min
- ✅ ARIA live regions

**File:** `tests/e2e/epic-1/profile-layout-cmdpalette-e2e.spec.ts`
- ✅ edit name
- ✅ upload avatar JPEG
- ✅ reject non-image upload
- ✅ remove avatar
- ✅ change timezone
- ✅ sidebar expand/collapse
- ✅ Cmd+K search navigate
- ✅ undo delete
- ✅ full onboarding wizard

---

## Data Factories Created

### Workspace & User Factory

**File:** `tests/support/factories/workspace.factory.ts`

**Exports:**
- `createWorkspace(overrides?)` — workspace with owner_id, tier, name
- `createUser(overrides?)` — user with email, name, timezone, avatar
- `createWorkspaceMember(overrides?)` — member with role enum
- `createOwnerMember(overrides?)` — pre-set role: 'owner'
- `createAdminMember(overrides?)` — pre-set role: 'admin'
- `createExpiredMember(overrides?)` — pre-set past expires_at

---

## Required data-testid Attributes

### Login Page
- `email-input` — email text field
- `send-magic-link` — submit button
- `remember-device` — checkbox toggle
- `resend-magic-link` — expired link resend button

### Workspace Settings
- `workspace-name-input` — workspace creation input
- `create-workspace` — workspace creation submit
- `invite-email-input` — invite member email
- `invite-role-select` — role dropdown
- `send-invite` — invite submit
- `toggle-expiry` — time-bound access toggle
- `expiry-date` — expiry date picker
- `revoke-{userId}` — revoke access button per member
- `confirm-revoke` — revoke confirmation
- `transfer-to-{userId}` — ownership transfer button
- `confirm-transfer` — transfer confirmation

### Profile Settings
- `name-input` — display name input
- `timezone-select` — timezone dropdown
- `avatar-upload` — file input
- `avatar-preview` — uploaded avatar preview
- `remove-avatar` — avatar removal button
- `default-avatar` — fallback avatar
- `save-profile` — save button

### Layout Shell
- `workspace-sidebar` — sidebar container
- `sidebar-toggle` — collapse/expand button
- `sidebar-timer-slot` — timer placeholder
- `command-palette` — command palette overlay
- `command-palette-input` — search input
- `command-palette-results` — results container
- `command-palette-action` — individual action

### Dashboard
- `pending-approvals` — approvals section
- `agent-activity` — activity section
- `outstanding-invoices` — invoices section
- `health-alerts` — health alerts section
- `dashboard-section` — generic section wrapper
- `skeleton-loader` — loading skeleton

### Undo/Conflict
- `undo-toast` — undo notification
- `undo-button` — undo action button
- `conflict-resolution` — conflict panel
- `your-version` — current user's version
- `their-version` — other user's version

### Onboarding Wizard
- `setup-wizard` — wizard container
- `wizard-step-create-client` — client step
- `wizard-step-time-entry` — time entry step
- `wizard-step-agent-proposal` — agent proposal step
- `wizard-next` — next step button
- `wizard-finish` — complete button
- `mock-agent-action` — demo agent action
- `preference-hands-on` — working style option
- `client-name-input` — client name in wizard

---

## Implementation Checklist

### Test: Story 1.1a Turborepo Scaffold (7 API tests)
**Tasks to make these tests pass:**
- [ ] Create Turborepo monorepo with turbo.json, root package.json, .nvmrc
- [ ] Create 6 package stubs: config, tokens, ui, shared, test-utils, db
- [ ] Configure tsconfig.base.json with strict + noUncheckedIndexedArrayAccess + exactOptionalPropertyTypes
- [ ] Configure eslint.config.base.js with no-any, no-ts-ignore rules
- [ ] Set up turbo.json pipeline with correct dependsOn chains
- [ ] Add CI GitHub Actions workflow (install → build → lint → test)
- [ ] Verify `pnpm build && pnpm test && pnpm lint` all pass

### Test: Story 1.1b Design System Tokens (9 API tests)
**Tasks to make these tests pass:**
- [ ] Build packages/tokens with zero deps, ESM-only, named exports
- [ ] Implement dark + light theme token maps with exact spec values
- [ ] Create 6 agent identity HSL colors
- [ ] Implement typography scale (2xs–3xl) + trust-density gaps
- [ ] Create motion tokens with prefers-reduced-motion support
- [ ] Build Tailwind v4 CSS bridge + shadcn/ui variable mapping
- [ ] Implement ThemeProvider (client component) with FOUC prevention
- [ ] Create WCAG contrast validation script
- [ ] Create token completeness validation script
- [ ] Add validate task to turbo.json pipeline

### Test: Story 1.2 Database Foundation (9 API tests)
**Tasks to make these tests pass:**
- [ ] Create workspaces, users, workspace_members, app_config tables in packages/db
- [ ] Implement RLS policies on every workspace-scoped table with ::text cast
- [ ] Build requireTenantContext() middleware
- [ ] Create factory-based test tenant provisioning in test-utils
- [ ] Verify cross-workspace data isolation

### Test: Story 1.3 Magic Link Auth (7 API + 4 E2E tests)
**Tasks to make these tests pass:**
- [ ] Implement magic link generation with 15-min expiry via Supabase Auth
- [ ] Add rate limiting (5 attempts/email/hour)
- [ ] Build "remember this device" extended session flow
- [ ] Implement session invalidation on role change
- [ ] Create login page with email input, submit, rate limit UI
- [ ] Create expired link page with resend option

### Test: Story 1.4 Workspace & Team Mgmt (8 API + 5 E2E tests)
**Tasks to make these tests pass:**
- [ ] Implement workspace creation (auto-owner) Server Action
- [ ] Build team invitation flow with email + role selection
- [ ] Implement role assignment (Owner, Admin, Member, ClientUser)
- [ ] Build access revocation with session invalidation
- [ ] Implement time-bound subcontractor access with auto-expiry
- [ ] Build ownership transfer succession flow
- [ ] Create team management settings page

### Test: Stories 1.5/1.5a Profile & Email (14 API + 5 E2E tests)
**Tasks to make these tests pass:**
- [ ] Build profile editing Server Actions with revalidateTag
- [ ] Implement avatar upload with magic byte validation, 2MB limit, file deletion
- [ ] Create profile page with name, timezone, avatar sections
- [ ] Implement email change with verification, session revocation, split-brain cron
- [ ] Add rate limiting on email changes (5/hour)
- [ ] Build cancel pending email change flow

### Test: Stories 1.6-1.8 Layout, Dashboard, Command Palette (14 API/E2E tests)
**Tasks to make these tests pass:**
- [ ] Build WorkspaceShell (sidebar + topbar + agent status strip)
- [ ] Implement sidebar expand/collapse with responsive breakpoints
- [ ] Create home dashboard with pending approvals, agent activity, invoices, health alerts
- [ ] Build skeleton loading states and meaningful empty CTAs
- [ ] Implement command palette (Cmd+K) with entity search <500ms
- [ ] Create keyboard shortcut system for approval queue, timer, navigation

### Test: Stories 1.9-1.10 Undo, Conflict, Wizard (10 API/E2E tests)
**Tasks to make these tests pass:**
- [ ] Implement 30-second undo with optimistic UI rollback
- [ ] Build concurrent edit conflict detection with dual-version display
- [ ] Create Day 1 Micro-Wizard (signup → client → time entry → agent proposal)
- [ ] Build mock agent action that demonstrates capability within 30s
- [ ] Implement working-style preference → initial trust levels
- [ ] Ensure WCAG 2.1 AA compliance across wizard
- [ ] Add ARIA live regions for dynamic content

---

## Running Tests

```bash
# Run all Epic 1 API tests
pnpm test tests/api/epic-1/

# Run all Epic 1 E2E tests
pnpm exec playwright test tests/e2e/epic-1/

# Run specific story API tests
pnpm test tests/api/epic-1/story-1.3-magic-link-auth.spec.ts

# Run E2E tests in headed mode
pnpm exec playwright test tests/e2e/epic-1/ --headed

# Debug specific E2E test
pnpm exec playwright test tests/e2e/epic-1/auth-workspace-e2e.spec.ts --debug
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅
- ✅ 95 red-phase test scaffolds generated across 9 test files
- ✅ All tests use `test.skip()` (TDD red phase compliant)
- ✅ Data factories created with parallel-safe faker values
- ✅ data-testid requirements documented for all UI components
- ✅ Implementation checklist maps each test to concrete tasks

### GREEN Phase (Next)
1. Start with Story 1.1a (Turborepo Scaffold) — foundational
2. Remove `test.skip()` from 1.1a tests
3. Implement minimal scaffold, verify tests pass
4. Move to 1.1b → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8 → 1.9 → 1.10
5. One story at a time, red → green for each

### REFACTOR Phase (After All Tests Pass)
- Verify all tests pass
- Enforce 200-line file limit
- Extract shared patterns into test-utils
- Run full CI pipeline: build → validate → typecheck → test → lint

---

## Notes

- **No application code exists yet.** All tests are pure TDD red-phase scaffolds.
- **Stack**: Vitest (API/unit) + Playwright (E2E). Config from `docs/project-context.md`.
- **Security perimeter**: RLS with `::text` cast is tested explicitly.
- **Strict TypeScript**: no `any`, no `@ts-ignore`, no `@ts-expect-error`.
- **Money in cents**: Not directly tested in Epic 1 but factory supports it.
- **200-line file limit**: Test files should stay under 200 lines; split if needed.

---

**Generated by BMad TEA Agent (Murat)** — 2026-04-23
