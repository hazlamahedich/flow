# Ecto/Phoenix: RLS Migration SQL Template

Known-good pattern proven across LeadForge AI and multiple BMAD epics.
Copy the `up`/`down` blocks below and swap out `<table>` and `<workspace_column>`.

## Direct workspace_id RLS (leads, sequences, icp_profiles, etc.)

```elixir
  def up do
    create table(:<table>) do
      add :workspace_id, references(:workspaces, on_delete: :delete_all, type: :uuid), null: false
      # ... other columns ...
      timestamps(type: :utc_datetime_usec)
    end

    # RLS
    execute "ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;"
    execute "ALTER TABLE <table> FORCE ROW LEVEL SECURITY;"

    execute """
    CREATE POLICY <table>_isolation ON <table> FOR ALL TO PUBLIC
      USING (
        <workspace_column> IN (
          SELECT workspace_id FROM workspace_memberships
          WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::bigint
        )
        OR current_setting('app.is_admin', true)::boolean = true
      )
      WITH CHECK (
        <workspace_column> IN (
          SELECT workspace_id FROM workspace_memberships
          WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::bigint
        )
        OR current_setting('app.is_admin', true)::boolean = true
      );
    """
  end

  def down do
    execute "DROP POLICY IF EXISTS <table>_isolation ON <table>;"
    execute "ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;"
    drop table(:<table>)
  end
```

## Nested subquery RLS (lead_labels, sequence_runs — no direct workspace_id)

The `USING` clause joins through the parent table instead of a direct column:

```elixir
    execute """
    CREATE POLICY <table>_isolation ON <table> FOR ALL TO PUBLIC
      USING (
        <parent_id> IN (
          SELECT p.id FROM <parent_table> p
          WHERE p.workspace_id IN (
            SELECT workspace_id FROM workspace_memberships
            WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::bigint
          )
        )
        OR current_setting('app.is_admin', true)::boolean = true
      )
      WITH CHECK (
        <parent_id> IN (
          SELECT p.id FROM <parent_table> p
          WHERE p.workspace_id IN (
            SELECT workspace_id FROM workspace_memberships
            WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::bigint
          )
        )
        OR current_setting('app.is_admin', true)::boolean = true
      );
    """
```

## Notes

- The `NULLIF(current_setting(...), '')::bigint` pattern handles the empty-string case when `app.current_user_id` is not set (fail-closed).
- `FOR ALL TO PUBLIC` combined in one policy beats separate SELECT/INSERT/UPDATE policies — fewer lines, same effect.
- `execute """` triple-quoted strings interpolate `#{...}`; if your SQL contains `$1` or literal `#` chars, escape them. In this template there are none, so safe.
- Always `FORCE ROW LEVEL SECURITY` so even table owner obeys policies during tests (unless test DB user is superuser).

## Index on workspace_id + ordering (Ecto limitation)

Ecto's `create index/3` does not support `order:` (no `:order` field on `Ecto.Migration.Index`). For `DESC NULLS LAST`, use raw SQL:

```elixir
execute """
CREATE INDEX idx_scores_workspace ON leads (workspace_id, score_overall DESC NULLS LAST);
"""
```

In `down`, drop with:
```elixir
execute "DROP INDEX IF EXISTS idx_scores_workspace;"
```
_Never use `drop index(:idx_name)` for raw-SQL-created indexes — Ecto won't find them._
