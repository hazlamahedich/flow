-- Migration: portal_branding column on workspaces + portal-role read access
-- Story 9.1b: Portal Branding & Theming
-- Purpose: Persist per-workspace portal branding config (preset + visual/content
--          overrides). Portal sessions read this via the portal role; workspace
--          owners/admins write it via Server Action.
-- Related: AC3, AC6, EC10
--
-- Notes:
--   * The portal_branding jsonb column stores { preset, visual?, content? }
--     validated by brandingConfigSchema (Zod) before persistence.
--   * Existing workspaces SELECT policies cover authenticated reads.
--   * We add an UPDATE policy for owner/admin (currently missing on workspaces).
--   * We add a portal-role SELECT policy so the portal layout (which has no
--     Supabase Auth session) can read branding via its JWT claims.

-- ============================================================
-- STEP 1: Add portal_branding column
-- ============================================================

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS portal_branding jsonb DEFAULT NULL;

COMMENT ON COLUMN workspaces.portal_branding IS
  'Per-workspace portal branding config: { preset: string, visual?: Record, content?: Record }. NULL = use defaults (warm-host preset).';

-- ============================================================
-- STEP 2: UPDATE policy for owner/admin on workspaces
-- ============================================================
-- The old update policy was dropped in 20260421180001 and never replaced.
-- Owner and admin need UPDATE to write portal_branding (and other workspace
-- settings). This is a general workspace update policy, not branding-specific.

DROP POLICY IF EXISTS rls_workspaces_owner_admin_update ON workspaces;
CREATE POLICY rls_workspaces_owner_admin_update ON workspaces
  FOR UPDATE TO authenticated
  USING (
    (id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin')
  )
  WITH CHECK (
    (id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin')
  );

-- ============================================================
-- STEP 3: Portal-role SELECT policy on workspaces (portal_branding)
-- ============================================================
-- The portal layout needs to read portal_branding to inject CSS vars.
-- Portal sessions carry a JWT with role=portal, workspace_id, client_id,
-- portal_token_id. We scope the read to workspaces whose portal_tokens row
-- is still valid (unexpired, used, unrevoked).

GRANT SELECT ON workspaces TO portal;

CREATE POLICY rls_workspaces_portal_select ON workspaces
  FOR SELECT TO portal
  USING (
    (id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND EXISTS (
      SELECT 1 FROM portal_tokens pt
      WHERE pt.id::text = (auth.jwt() ->> 'portal_token_id'::text)
        AND pt.workspace_id = workspaces.id
        AND pt.revoked_at IS NULL
        AND pt.used_at IS NOT NULL
        AND pt.expires_at > now()
    )
  );
