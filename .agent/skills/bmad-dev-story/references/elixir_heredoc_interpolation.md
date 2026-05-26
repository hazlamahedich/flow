# Elixir heredoc vs Ecto SQL `execute`

When you write `execute """ ... """` in an Ecto migration, the text between the triple quotes is an Elixir **heredoc** at compile time — not raw SQL sent to Postgres. Elixir parses and **interpolates** `#{...}` before `execute` sees it.

## The bug

If your SQL contains `#{table_name}` or any `#{...}` pattern (e.g., for table names, column names, or a conditional fragment), Elixir will try to resolve it as a variable/attribute and either:

1. Inject a value you didn't intend (variable exists), or
2. Raise `CompileError: undefined function or variable` (variable doesn't exist).

In Story 1.6, the migrations written for `leads`, `lead_labels`, etc. used `execute """` with SQL that contained no `#{...}` patterns, so they were safe. But future stories that programmatically generate SQL inside heredocs must escape or avoid interpolation.

## Safe patterns

### Pattern A: No interpolation (best for static SQL)

```elixir
execute """
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
"""
```

### Pattern B: Escape with backslash (if you need literal `#{}` in SQL)

```elixir
column = "workspace_id"
execute """
CREATE POLICY p ON my_table FOR ALL TO PUBLIC
  USING (
    \#{column} IN ...
  );
"""
```
_This is rare and ugly. Prefer Pattern C._

### Pattern C: Use string concatenation

```elixir
sql = "CREATE INDEX idx_" <> table_name <> "_whatever ON " <> table_name <> " (...)"
execute sql
```

### Pattern D: Use `~S()` sigil to disable interpolation

```elixir
execute ~S"""
CREATE POLICY p ON my_table FOR ALL
  USING (current_setting('app.current_user_id') = '#{user_id_placeholder}');
"""
```
_Note: `~S` disables interpolation, but `execute` still receives the string as-is. Only use if the SQL genuinely needs a literal `#{...}`._

## Recommendation

For BMAD-elixir Ecto migrations, always **copy the static SQL template** from `references/ecto_rls_migration_template.md` and swap string tokens manually. Do not embed runtime interpolation inside `execute """`.
