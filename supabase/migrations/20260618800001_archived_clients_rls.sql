-- Migration: Archived-clients RLS (Story 9.5b AC3 — FR57 client half, T4.6)
-- Purpose: Add `status = 'active'` to the clients UPDATE policy's USING + WITH
--          CHECK so user JWTs cannot mutate archived rows. Archived clients
--          are read-only at the RLS layer; the only legitimate mutator is
--          the `service_role` webhook path (`bulkArchiveClients` /
--          `applyDowngradeOnTierChange`), which bypasses RLS.
--
-- RLS is the security perimeter (project-context.md:195). App-level guards
-- (update-client.ts RESOURCE_ARCHIVED 403) are defence-in-depth for better
-- error UX; they are NOT the security control.
--
-- Idempotent: uses DROP IF EXISTS + CREATE. Down: re-CREATE without the
-- `status = 'active'` clause.
--
-- Related: supabase/migrations/20260504000001_enhance_clients_for_crud.sql:56
--          (original rls_clients_owner_admin_update policy).

-- ═══════════════════════════════════════════════════════════════════════
-- Replace the owner/admin UPDATE policy with status='active' gating
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS rls_clients_owner_admin_update ON clients;

CREATE POLICY rls_clients_owner_admin_update ON clients
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND status IN ('active', 'archived')
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Verify the policy shape (run on `supabase db reset` / psql apply).
-- Useful as a quick smoke check via:
--   SELECT pg_policies.policyname, pg_policies.qual, pg_policies.with_check
--     FROM pg_policies WHERE tablename = 'clients';
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- Down SQL (apply to revert):
--   DROP POLICY IF EXISTS rls_clients_owner_admin_update ON clients;
--   CREATE POLICY rls_clients_owner_admin_update ON clients
--     FOR UPDATE TO authenticated
--     USING (
--       workspace_id::text = auth.jwt()->>'workspace_id'
--       AND status = 'active'
--       AND EXISTS (
--         SELECT 1 FROM workspace_members wm
--         WHERE wm.workspace_id = clients.workspace_id
--           AND wm.user_id = auth.uid()
--           AND wm.role IN ('owner', 'admin')
--           AND wm.status = 'active'
--       )
--     );
-- ═══════════════════════════════════════════════════════════════════════
