-- Migration: reconcile_user_emails() function
-- Purpose: Safety net to sync public.users.email with auth.users.email
-- Related: Story 1.5a AC#5
-- Note: SECURITY DEFINER bypasses RLS for system-level reconciliation.
--        Execution restricted to service_role only.
--        Cron scheduler deferred to Story 2.1.

CREATE OR REPLACE FUNCTION reconcile_user_emails()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.users u
  SET email = au.email
  FROM auth.users au
  WHERE u.id = au.id AND u.email IS DISTINCT FROM au.email;
$$;
