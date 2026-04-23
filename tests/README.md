# E2E Tests — Flow OS

Playwright-based end-to-end tests for Flow OS.

## Setup

```bash
# Install dependencies (already in root package.json)
pnpm install

# Install Playwright browsers (first time only)
pnpm exec playwright install

# Copy environment config
cp tests/.env.example tests/.env
```

## Running Tests

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with Playwright UI (interactive)
pnpm test:e2e:ui

# Run in headed mode (visible browser)
pnpm test:e2e:headed

# Run specific test file
pnpm exec playwright test tests/e2e/smoke.spec.ts

# Run specific browser
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=mobile-safari

# Debug a test
pnpm exec playwright test --debug tests/e2e/smoke.spec.ts
```

## Architecture

```
tests/
├── e2e/                        # Test specs
│   └── smoke.spec.ts
├── support/
│   ├── merged-fixtures.ts      # Composed test object (all fixtures)
│   ├── custom-fixtures.ts      # Project-specific fixtures
│   ├── fixtures/
│   │   └── data-factories.ts   # Faker-based test data generators
│   ├── helpers/
│   │   └── api-helpers.ts      # API interaction utilities
│   └── page-objects/           # Page object models (future)
└── .env.example                # Environment variable template
```

### Fixtures

Tests import from `tests/support/merged-fixtures.ts` which composes:
- `@seontechnologies/playwright-utils`: apiRequest, authSession, recurse, log, interceptNetworkCall
- Custom fixtures: authenticatedPage, testUser

```typescript
import { test, expect } from '../support/merged-fixtures';

test('example', async ({ page, apiRequest, testUser }) => {
  // All fixtures available
});
```

### Data Factories

```typescript
import { createWorkspaceData, createUserData } from '../support/fixtures/data-factories';

const workspace = createWorkspaceData({ name: 'Custom Name' });
const user = createUserData({ role: 'admin' });
```

## Best Practices

- Use `data-testid` selectors (not CSS classes or text)
- Use data factories for test data (not hardcoded values)
- Each test must be independent — no shared mutable state
- Use `test.describe.configure({ mode: 'serial' })` for dependent tests only
- Import test object from `merged-fixtures.ts`, never from `@playwright/test` directly

## CI Integration

Tests run in CI with:
- Serial workers (`workers: 1`)
- 2 retries on failure
- JUnit XML output at `test-results/results.xml`
- HTML report at `playwright-report/`
- Traces/screenshots/videos retained on failure

## Browser Projects

| Project | Device |
|---|---|
| chromium | Desktop Chrome |
| firefox | Desktop Firefox |
| webkit | Desktop Safari |
| mobile-chrome | Pixel 5 |
| mobile-safari | iPhone 13 |
