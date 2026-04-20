# Suggested Commands

## Development (once implemented)
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build
npm run build

# Run all tests
npm run test

# Run E2E tests
npm run test:e2e

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Turborepo build pipeline
npx turbo build test lint
```

## Supabase
```bash
# Start local Supabase
supabase start

# Stop and reset
supabase stop && supabase start

# Generate TypeScript types
supabase gen types

# Create migration
supabase db diff

# Run seed scripts
npm run db:seed
```

## Git
```bash
# Conventional commits format
git commit -m "feat(scope): description"
git commit -m "fix(scope): description"
git commit -m "test(scope): description"
git commit -m "refactor(scope): description"

# Branch naming
# feature/, fix/, refactor/ prefixes
```

## System Utilities (macOS Darwin)
```bash
ls, cd, grep, find, git, cat, wc, head, tail, sed, awk
```

## BMad Workflow (current phase)
```bash
# These are skill-based, not CLI commands
# bmad-create-prd, bmad-create-architecture, bmad-create-ux-design
# bmad-create-epics-and-stories, bmad-sprint-planning, bmad-dev-story
```
