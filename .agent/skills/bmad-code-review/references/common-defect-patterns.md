# Common Defect Patterns Found in Code Reviews

Reference catalog of recurring issues found across BMAD code reviews. Use these as a checklist during the Blind Hunter and Edge Case Hunter layers.

## Security

### Missing workspace_id filter with service client
**Severity:** HIGH
**Pattern:** When using `createServiceClient()` (which bypasses RLS), queries that look up records by ID must also filter by `workspace_id`. Without it, a misrouted UUID could leak cross-workspace data.
**Fix:** Add `.eq('workspace_id', workspaceId)` to all service-client queries that access workspace-scoped tables.

## Logic Bugs

### Non-functional withTimeout (AbortController without rejection)
**Severity:** HIGH
**Pattern:** A timeout wrapper creates an AbortController, calls `controller.abort()` on timeout, but never rejects the outer promise. The function hangs forever if the wrapped promise never settles.
```typescript
// WRONG: aborts controller but never rejects
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return promise.finally(() => clearTimeout(timer));
}
```
**Fix:** Use `Promise.race` with a rejecting timeout promise:
```typescript
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => controller.abort());
}
```

### Unsafe `as` type assertions on unvalidated input
**Severity:** HIGH
**Pattern:** Worker handlers extract fields from parsed input using `as string` without runtime validation. The Zod schema validates the top-level shape but not the specific input fields.
**Fix:** Define a stricter Zod schema for the input fields and use `safeParse()` instead of bare `parse()`.

### Zod parse crash leaves catch-block variables unbound
**Severity:** MEDIUM
**Pattern:** If `Schema.parse(job.data)` throws inside a try block, destructured variables like `workspaceId` from the parse result are never assigned. The catch block references them for logging — causing undefined or ReferenceError.
**Fix:** Use `safeParse()` and return early on failure before destructuring.

## Data Integrity

### No dedup on batch signal/event inserts
**Severity:** HIGH
**Pattern:** Concurrent syncs or dedup boundary misses produce duplicate rows for the same entity pair. The table has no unique constraint.
**Fix:** Either add a DB-level unique partial index or deduplicate in application code before insert:
```typescript
const seenPairs = new Set<string>();
const dedupedRows = rows.filter((row) => {
  const key = `${row.payload.field1}:${row.payload.field2}`;
  if (seenPairs.has(key)) return false;
  seenPairs.add(key);
  return true;
});
```

## Status Tracking

### Agent runs never transition from queued
**Severity:** MEDIUM
**Pattern:** Worker receives `runId` but never calls `updateRunStatus()`. Agent runs stay in `queued` forever, making it impossible to track completion or surface failures.
**Fix:** Add status transitions: `queued -> running -> completed/failed` using the `updateRunStatus()` function from `@flow/db`.
