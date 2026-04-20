# @flow/db

Database client, schema definitions, and RLS helpers for Flow OS.

## Local Supabase Setup

```bash
supabase start          # Start local Postgres + Auth + Storage (~15s)
supabase db reset       # Apply all migrations + seed data
supabase stop           # Stop local instance
```

After `supabase start`, copy the output values to `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` → API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon key
- `SUPABASE_SERVICE_ROLE_KEY` → service_role key
- `DATABASE_URL` → DB URL (for Drizzle)

## Migration Workflow

```bash
supabase migration new <descriptive_name>   # Create new migration
supabase db reset                            # Reapply all migrations
```

Migrations use timestamp prefixes — no manual numbering.

## Drizzle Schema Parity

```bash
pnpm --filter @flow/db db:check   # Validate Drizzle schema matches migrations
```

This runs `drizzle-kit check` and fails on drift. Runs in CI as a gate.

**PgBouncer note:** Production uses transaction-mode pooling. Drizzle is
configured with `prepare: false` in `drizzle.config.ts` for compatibility.

## Client Factories

```typescript
// Server-side (App Router Server Components / Server Actions)
import { createServerClient } from '@flow/db';
const client = createServerClient(await cookies());

// Browser-side (factory only — wrap in React context in apps/web)
import { createBrowserClient } from '@flow/db';
const client = createBrowserClient();

// Service role (agent execution + system webhooks ONLY)
import { createServiceClient } from '@flow/db/client';
const client = createServiceClient();
```

**Important:** `createServiceClient` is NOT exported from `@flow/db` barrel.
Import explicitly from `@flow/db/client` to make service_role usage grep-able.

## RLS Helpers

```typescript
import { requireTenantContext, setTenantContext } from '@flow/db';

// Extracts workspace_id from JWT, throws FlowError(403) if missing
const { workspaceId, userId, role } = await requireTenantContext(client);

// Sets session variable for service_role queries (clears on transaction end)
await setTenantContext(serviceClient, workspaceId);
```

## Cache Policy

```typescript
import { getRevalidationTags } from '@flow/db';
const tags = getRevalidationTags('workspace', 'update', tenantId);
```

## Workspace JWT Injection

```typescript
import { setActiveWorkspace } from '@flow/db';
await setActiveWorkspace(userId, workspaceId); // Updates auth.users.app_metadata
```

Called on workspace switch (UI deferred to Story 1.4).

## Service Role Restrictions

- `service_role` key ONLY in `packages/db/src/client.ts` and agent packages
- NEVER in user-facing code or browser bundles
- ESLint `no-restricted-imports` enforces `createServiceClient` from `@flow/db/client` only
