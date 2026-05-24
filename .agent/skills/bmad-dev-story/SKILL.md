---
name: bmad-dev-story
description: 'Execute story implementation following a context filled story spec file. Use when the user says "dev this story [story file]" or "implement the next story in the sprint plan"'
---

Follow the instructions in ./workflow.md.

## Pitfalls

### Vitest mock hoisting: use `vi.hoisted()`

When writing vitest tests that mock modules with `vi.mock()`, mock functions referenced inside the factory must be declared with `vi.hoisted()`. Top-level `const` declarations are NOT available when the hoisted `vi.mock()` factory executes.

**WRONG — ReferenceError on mockUserinfoGet:**
```typescript
const mockGenerateAuthUrl = vi.fn();
vi.mock('googleapis', () => ({
  google: { auth: { OAuth2: vi.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl, // ReferenceError!
  }))}}
}));
```

**CORRECT:**
```typescript
const { mockGenerateAuthUrl } = vi.hoisted(() => ({
  mockGenerateAuthUrl: vi.fn(),
}));
vi.mock('googleapis', () => ({
  google: { auth: { OAuth2: vi.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl, // Works — hoisted together
  }))}}
}));
```

### Pre-existing error isolation

When `pnpm typecheck` or `pnpm test` fails after implementation, filter for YOUR files before investigating:

```bash
pnpm typecheck 2>&1 | grep -E "(your-new-file|your-modified-file)" | head -20
```

- Empty output = zero new errors = all failures are pre-existing. Proceed.
- Any hits = your errors. Fix before continuing.
- Never fix pre-existing bugs mid-story — document them and move on.

### Running tests from the correct package

`pnpm test -- path/to/test.ts` runs through the Turborepo root and may not find tests in the right package. Instead:

```bash
cd packages/db && pnpm vitest run src/vault/__tests__/calendar-tokens.test.ts
cd packages/agents && pnpm vitest run providers/google-calendar/__tests__/provider.test.ts
```

Run from the package directory directly with `vitest run` for targeted test execution.

### Subagents hallucinate phantom DB columns

When using `delegate_task` to implement DB-interacting code in parallel, subagents will invent column names that sound reasonable but don't exist in the Drizzle schema. This is the #1 defect pattern from subagent-generated code.

**Prevention:** In every subagent context that writes DB queries/inserts, include:

```
MANDATORY: Read the Drizzle schema file BEFORE writing any DB-interacting code.
Column names must EXACTLY match packages/db/src/schema/[table].ts.
If a column is needed but missing, add it to BOTH Drizzle schema AND migration.
```

**Post-wave verification:** After a wave of parallel subagents finishes, before proceeding to dependent waves, run:

```bash
# For each table touched, extract actual columns from Drizzle schema
grep -oP '^\s+(\w+):\s+\w+' packages/db/src/schema/client-calendars.ts | head -20

# Then check subagent output for any column names NOT in that list
grep -rn 'email_address\|is_primary\|error_message' apps/web/app/api/auth/calendar/ packages/agents/calendar/
```

If grep returns column references not in the schema, fix them immediately -- do not let them propagate to dependent waves.

### Token manager pattern: return encrypted state on refresh

When implementing token refresh logic, the `getValidTokens()` method must return BOTH the new tokens AND the new encrypted state. If it only returns tokens, callers cannot persist the rotation. The next call decrypts stale state, re-refreshes, and burns refresh cycles.

```typescript
// WRONG: caller cannot persist the new encrypted state
async getValidTokens(id: string, encrypted: OAuthStateEncrypted): Promise<OAuthTokens>

// CORRECT: caller can update the DB with the new encrypted state
async getValidTokens(id: string, encrypted: OAuthStateEncrypted): Promise<{
  tokens: OAuthTokens;
  encrypted?: OAuthStateEncrypted;  // present only when refresh occurred
}>
```

### Atomic counter updates in Postgres

Application-level read-then-increment for counters (e.g., `consecutive_refresh_failures`) causes lost updates under concurrency. Use SQL atomic operations instead:

```sql
-- Create a Postgres function for atomic increment
CREATE FUNCTION increment_calendar_refresh_failures(cal_id UUID, max_failures INT)
RETURNS INT AS $$
DECLARE result INT;
BEGIN
  UPDATE client_calendars
  SET consecutive_refresh_failures = LEAST(consecutive_refresh_failures + 1, max_failures)
  WHERE id = cal_id
  RETURNING consecutive_refresh_failures INTO result;
  IF result >= max_failures THEN
    UPDATE client_calendars SET sync_status = 'disconnected' WHERE id = cal_id;
  END IF;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

Call via `supabase.rpc('increment_calendar_refresh_failures', { cal_id, max_failures })`.

### New agent subpackages need vitest aliases and package exports

When adding files under a new `packages/agents/<agent-name>/` directory that ATDD tests or other packages import, you must update three places:

1. **`packages/agents/package.json`** — add a subpath export:
   ```json
   "./calendar": {
     "types": "./calendar/index.ts",
     "default": "./dist/calendar/index.js"
   }
   ```

2. **`apps/web/vitest.config.ts`** — add alias entries (both bare and deep import):
   ```typescript
   { find: /^@flow\/agents\/calendar$/, replacement: path.resolve(__dirname, '../../packages/agents/calendar/index.ts') },
   { find: /^@flow\/agents\/calendar\/(.+)$/, replacement: path.resolve(__dirname, '../../packages/agents/calendar/$1') },
   ```
   Follow the pattern of existing entries (time-integrity, orchestrator, shared).

3. **`packages/agents/<agent-name>/index.ts`** — re-export all public APIs from this barrel.

Without all three, tests will fail with `Cannot find module` or `Missing specifier` errors.

### ATDD tests: use static imports, not dynamic `await import()`

When ATDD tests need to import from agent packages (e.g., to check a config constant), use a **static top-level import** rather than `await import()`. Dynamic imports of heavy module graphs (Drizzle, pg-boss, googleapis) timeout in jsdom's 5s test limit.

```typescript
// CORRECT — static import at top of file
import { CALENDAR_TRUST_LEVELS } from '@flow/agents/calendar';

// WRONG — times out because it loads the full module graph dynamically
const { CALENDAR_TRUST_LEVELS } = await import('@flow/agents/calendar');
```

### moddatetime triggers make manual updated_at redundant

When a table has a `moddatetime` trigger on `updated_at`, do NOT set `updated_at` manually in application code. The trigger handles it. Manual setting causes subtle clock-skew discrepancies between Node and Postgres.

```typescript
// WRONG: moddatetime trigger already handles this
.update({ sync_status: 'connected', updated_at: new Date().toISOString() })

// CORRECT: let the trigger handle updated_at
.update({ sync_status: 'connected' })
```

### exactOptionalPropertyTypes: use conditional spread for optional fields

With `exactOptionalPropertyTypes: true` in tsconfig, you cannot assign `undefined` to an optional property. This breaks function params where a field may or may not be present:

```typescript
// WRONG: TS2327 — undefined not assignable to optional string
const params: { clientId?: string } = { clientId: input.clientId }; // fails if input.clientId is undefined

// CORRECT: conditional spread omits the key entirely
const params: { clientId?: string } = {
  ...(input.clientId ? { clientId: input.clientId } : {}),
};
```

This pattern comes up frequently in Supabase inserts, pg-boss job data, and Zod schema outputs.

## Post-Implementation Graph Update

After a story's code changes and code-review fixes are fully applied, refresh the graphify knowledge graph so subsequent preflight impact analyses see the current code:

```bash
cd "<project-root>"
graphify update . --force
```

**When to run:**
- Immediately after `bmad-dev-story` finishes and files are saved.
- Immediately after `bmad-update-story-doc-with-review-notes` closes out review fixes.
- Optional: rely on the nightly `no_agent` cronjob for catch-up if skipped.

**Why it matters:** AST-only (`--force` is safe, zero LLM cost). Without this, the next story's `bmad-graphify-preflight` will show stale or zero code nodes, producing empty impact results.
