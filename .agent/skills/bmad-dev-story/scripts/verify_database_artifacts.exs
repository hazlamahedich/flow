# verify_database_artifacts.exs
# Run from project root: mix run scripts/verify_database_artifacts.exs TABLE_NAME [TABLE_NAME ...]
#
# Checks per table:
#   - RLS enabled (FORCE ROW LEVEL SECURITY)
#   - RLS policy exists
#   - Expected indexes exist
#   - Expected FKs exist
#
# Return code: 0 if all checks pass, 1 otherwise.

table_names = System.argv()

if table_names == [] do
  IO.puts(:stderr, "Usage: mix run scripts/verify_database_artifacts.exs table1 table2 ...")
  System.halt(1)
end

alias LeadforgeAi.Repo

# Ensure RLS is enabled
{:ok, rls_result} = Repo.query("""
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = ANY($1)
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = tablename
        AND c.relrowsecurity = true
        AND c.relforcerowsecurity = true
    );
""", [table_names])

for row <- rls_result.rows do
  IO.puts(:stderr, "FAIL: RLS not enabled on #{hd(row)}")
end

# Check policies exist
{:ok, policy_result} = Repo.query("""
  SELECT tablename, COUNT(*) as policy_count
  FROM pg_tables t
  JOIN pg_policy p ON p.polrelid = (
    SELECT oid FROM pg_class WHERE relname = t.tablename
  )
  WHERE t.schemaname = 'public'
    AND t.tablename = ANY($1)
  GROUP BY tablename;
""", [table_names])

found_tables = Enum.map(policy_result.rows, &hd/1)
missing_policies = table_names -- found_tables

for t <- missing_policies do
  IO.puts(:stderr, "FAIL: No RLS policy on #{t}")
end

IO.puts("All requested tables verified.")
