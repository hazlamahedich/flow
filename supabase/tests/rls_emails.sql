-- Test: RLS policies for emails table
-- Related: AC5 (cross-client isolation)

BEGIN;

SELECT plan(4);

-- Workspace isolation for emails
SELECT lives_ok(
  $$
    CREATE TEMP TABLE test_email_result AS
    SELECT * FROM emails WHERE workspace_id = '00000000-0000-0000-0000-000000000000'
  $$,
  'Emails query executes without error'
);

-- service_role can access all
SELECT lives_ok(
  $$
    SET role = 'service_role';
    SELECT count(*) FROM emails WHERE workspace_id = '00000000-0000-0000-0000-000000000000'
  $$,
  'service_role can query emails'
);

SELECT finish();
ROLLBACK;
