# Phoenix Supplemental Defect Patterns

Additional class-level defect patterns discovered during adversarial code reviews of Phoenix 1.8 / Ecto / PostgreSQL projects, supplementing the catalog in `references/elixir-phoenix-defect-patterns.md`.

## Database / Concurrent Update Patterns

### TOCTOU race: read outside transaction, update inside
**Severity:** CRITICAL
**Pattern:** A context function reads a record with `Repo.get!` outside any transaction, then opens `Repo.transaction/1` to perform updates using the pre-read struct. In concurrent environments another process changes the record between the read and the update. The pre-read struct is stale, and the code may issue an update on stale data, make incorrect decisions, or raise on stale assumptions.
**Detection:** Grep for `Repo.get!` or `Repo.get` followed by `Repo.transaction` or `Repo.transact` in the same function. Verify if the pre-read value is used inside the transaction for conditional logic or update construction.
**Fix:** Move the read inside the transaction so it locks the row or is atomically verified, OR use `Repo.update_all` with a `where` guard that encodes the expected pre-condition:
```elixir
from(w in Workspace, where: w.id == ^id and w.credits_balance >= ^cost)
|> Repo.update_all([])
```

### Stale derived value after atomic update
**Severity:** HIGH
**Pattern:** After successfully updating a row inside a transaction, the function computes a summary value (e.g., `balance_after`) using the original pre-transaction read instead of querying the row's current state. This produces a misleading result that may propagate to the UI or audit log.
**Fix:** Re-read the row inside the same transaction after the update:
```elixir
Repo.transaction(fn ->     
  {1, _} = update_query |> Repo.update_all([])
  # Fresh read to get actual post-update state
  balance_after = Repo.one!(from w in Workspace, where: w.id == ^id, select: w.credits_balance)
end)
```

### Weak changeset validations on system-triggered records
**Severity:** MEDIUM
**Pattern:** Records created by system code (admin actions, background jobs, cron tasks, internal billing events) bypass UI-level validations. The changeset only enforces presence but not business rules (action must be in a known list, cost must be > 0, status must be valid). A bug in the system code can generate invalid records that persist silently.
**Detection:** Review changesets for schemas that are mainly populated by system code (credit transactions, audit logs, metrics, events). If `validate_inclusion`, `validate_number`, `validate_format` are absent for fields that have clear domain constraints, flag it.
**Fix:** Enforce domain constraints in the changeset regardless of caller:
```elixir
def changeset(transaction, attrs) do
  transaction
  |> cast(attrs, [:action_type, :credits_amount])
  |> validate_inclusion(:action_type, @action_types)
  |> validate_number(:credits_amount, greater_than: 0)
end
```

### Migration backfill without selectivity guard
**Severity:** HIGH
**Pattern:** A data migration uses `UPDATE table SET col = default WHERE col = current_value` to populate default values for new columns. If rows that have already been legitimately modified to `current_value` exist (e.g., a balance drained to 0), the migration resets them to the default, losing real state.
**Fix:** Add a guarding condition that selects only rows that were never modified, or use a sentinel column:
```elixir
# Before (dangerous)
UPDATE workspaces SET credits_balance = 500 WHERE credits_balance = 0
# After (safe)
UPDATE workspaces SET credits_balance = 500 WHERE credits_balance = 0 AND credits_used = 0
```

## Plug & Template Assignment Mismatch

### Global plug assignment causing KeyError in templates
**Severity:** MEDIUM
**Pattern:** A plug (e.g., `FetchCurrentWorkspace`) assigns a value in `conn.assigns` inside a globally-applied pipeline (e.g., `:browser`). When a template (e.g., `root.html.heex`) accesses the assignment with `@key`, routes that don't pass through the plug crash with `KeyError` because the key is absent.
**Detection:**
1. In `router.ex`, check which pipelines include the plug.
2. In templates using the assignment, verify conditional access (`if assigns[:key] do`).
3. Access `@key` directly only if every route through `pipe_through` guarantees it.
**Fix:**
Option A -- isolate the plug to a dedicated pipeline:
```elixir
pipeline :workspace do
  plug MyAppWeb.Plugs.FetchCurrentWorkspace
end

scope "/", MyAppWeb do
  pipe_through [:browser]
  # non-workspace routes

  scope "/workspaces" do
    pipe_through [:workspace]
    # workspace routes
  end
end
```
Option B -- safe template access:
```heex
<%= if assigns[:current_workspace] do %>
  ... show workspace indicator ...
<% end %>
```
