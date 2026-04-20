# Task Completion Checklist

When a coding task is completed, ensure:

## Pre-commit
1. **Type check:** `npx tsc --noEmit` (per package)
2. **Lint:** `npm run lint`
3. **Unit tests:** `npm run test` (relevant test files)
4. **Integration tests** (if RLS/DB changes): verify RLS policies pass
5. **E2E tests** (if critical user journey affected): `npm run test:e2e`

## PR Requirements
- All CI checks pass (build, lint, type-check, unit, integration, migration dry-run, SAST, dependency audit)
- At least one code review approval
- PR includes: migration files + RLS test coverage + type changes together (never split across PRs)
- Conventional commit: `feat(scope):`, `fix(scope):`, `test(scope):`, `refactor(scope):`

## Special Cases
- **RLS policy changes:** require explicit security review comment
- **Agent pre-check changes:** require test coverage demonstration
- **Financial logic changes:** require traceability to PRD FR
- **Agent behavior changes:** require integration test against staging with mocked externals
- **Supabase type changes:** must include updated TS types AND contract test

## Do NOT
- Commit `.env.local`
- Modify RLS via Supabase dashboard (migrations only)
- Skip RLS tests
- Auto-commit without user request
