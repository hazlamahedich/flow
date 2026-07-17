-- Migration: Add explicit status='active' guard to workspace_members admin_update policy
-- Purpose: Defense-in-depth for the suspended-member state (Story 9.5c AC6 — FR57a).
--
-- Background (code review M1, 2026-07-17):
--   The `rls_workspace_members_admin_update` policy (created by
--   `20260425080000_fix_rls_recursion.sql:48`) does NOT gate on status in
--   its USING clause — only on workspace_id + role. In principle this ORs
--   into allowing an owner/admin JWT to UPDATE a suspended row.
--
--   Verified live: the UPDATE actually returns 0 rows today because UPDATE
--   visibility requires the row to be SELECT-visible first, and ALL SELECT
--   policies (`admin_select`, `owner_all`) gate on `status='active'`. So the
--   suspended-row protection is REAL — but it is correct-by-accident,
--   depending on the SELECT policies to do the gating.
--
--   This migration makes the protection EXPLICIT on the UPDATE policy, so a
--   future SELECT-policy change cannot silently re-open the suspended-state
--   mutation path. The pgTAP suite (`rls_workspace_members.sql` tests 13–17)
--   continues to verify the behavior end-to-end.
--
-- The WITH CHECK clause is intentionally NOT gated on status: it only
-- constrains the *result* row, and the webhook (service_role) legitimately
-- writes status='suspended' (it bypasses RLS entirely, but the check is
-- still evaluated for authenticated-path inserts/updates — gating it would
-- prevent legitimate admin role changes on active rows that happen to be
-- transitioning state). The USING gate is the correct place: it controls
-- which existing rows can be targeted for update.

DROP POLICY IF EXISTS rls_workspace_members_admin_update ON workspace_members;

CREATE POLICY rls_workspace_members_admin_update ON workspace_members
  FOR UPDATE
  TO authenticated
  USING (
    (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin')
    AND status = 'active'
  )
  WITH CHECK (
    (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin')
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Verify (run on `supabase db reset` / psql apply):
--   SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
--     WHERE polname = 'rls_workspace_members_admin_update'
--       AND polrelid = 'workspace_members'::regclass;
--   -- should now include "AND (status = 'active'::text)"
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- Down SQL (apply to revert):
--   DROP POLICY IF EXISTS rls_workspace_members_admin_update ON workspace_members;
--   CREATE POLICY rls_workspace_members_admin_update ON workspace_members
--     FOR UPDATE
--     TO authenticated
--     USING (
--       (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
--       AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin')
--     )
--     WITH CHECK (
--       (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
--       AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin')
--     );
-- ═══════════════════════════════════════════════════════════════════════
