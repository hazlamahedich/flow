-- Migration: portal_tokens table + portal role + verify_portal_token RPC
-- Story 9.1a: Client Portal Auth & Layout
-- Purpose: Time-limited magic-link tokens for client portal access.
--          Hash-at-rest, single-use, RLS-isolated, SECURITY DEFINER verify.
-- Related: FR8 (abuse prevention), FR51 (no account required), FR54 (strict isolation)
--
-- Notes:
--   * Token TTL is 72h default / 168h hard cap (application-enforced).
--   * Portal session cookie TTL is 24h absolute (application-enforced).
--   * Only the hash is persisted; plaintext token lives only in the magic-link URL.
--   * verify_portal_token is the ONLY SECURITY DEFINER surface in the portal path.
--   * Portal role is NOLOGIN — claims come from request.jwt.claims via the
--     `__flow_portal` cookie's bearer JWT (signed with SUPABASE_JWT_SECRET).

-- ============================================================
-- STEP 1: Create portal_tokens table
-- ============================================================

CREATE TABLE portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE portal_tokens IS
  'Magic-link tokens for client portal access. Hash-at-rest, single-use, TTL-bounded.';
COMMENT ON COLUMN portal_tokens.token_hash IS
  'sha256 hex hash of the plaintext token. Plaintext is never persisted.';

-- ============================================================
-- STEP 2: Indexes
-- ============================================================

-- Unique index on hash — this is the lookup key (constant-time, no scanning)
CREATE UNIQUE INDEX idx_portal_tokens_hash
  ON portal_tokens (token_hash);

-- Index for workspace-side listings (Owner/Admin "show me all links for client X")
CREATE INDEX idx_portal_tokens_client
  ON portal_tokens (client_id);

CREATE INDEX idx_portal_tokens_workspace
  ON portal_tokens (workspace_id);

-- Partial index for active-token lookups (not expired, not used, not revoked)
CREATE INDEX idx_portal_tokens_active
  ON portal_tokens (client_id)
  WHERE revoked_at IS NULL AND used_at IS NULL;

-- ============================================================
-- STEP 3: RLS policies — workspace-side access (Owner/Admin)
-- ============================================================
-- Owners/Admins can SELECT/INSERT/UPDATE portal_tokens for their workspace.
-- Members have no access to token management (Members can be a security risk:
-- they could leak or socially-engineer links). Use wm.status = 'active'.
-- ::text cast on workspace_id is non-negotiable (project-context.md:118).

CREATE POLICY rls_portal_tokens_owner_admin_select ON portal_tokens
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = portal_tokens.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

CREATE POLICY rls_portal_tokens_owner_admin_insert ON portal_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = portal_tokens.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

CREATE POLICY rls_portal_tokens_owner_admin_update ON portal_tokens
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = portal_tokens.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = portal_tokens.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- ============================================================
-- STEP 4: Create portal role (NOLOGIN — uses JWT claims only)
-- ============================================================
-- The portal role is granted to no Supabase Auth user. It exists purely as
-- a Postgres role that RLS policies can target. The JWT in the `__flow_portal`
-- cookie carries `role = 'portal'`, `client_id`, `portal_token_id`, and is
-- signed with SUPABASE_JWT_SECRET. Postgres sees these claims via
-- `request.jwt.claims` when the connection sets `Authorization: Bearer <jwt>`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal') THEN
    CREATE ROLE portal NOLOGIN NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO portal;
GRANT SELECT ON portal_tokens TO portal;
GRANT SELECT ON clients TO portal;

-- Allow the postgres superuser (used by pgTAP tests) to SET ROLE portal.
-- Without this, RLS tests can't impersonate the portal role.
GRANT portal TO postgres;

-- ============================================================
-- STEP 5: Portal-role RLS policy on portal_tokens
-- ============================================================
-- The portal role can SELECT its own token row only (matching JWT claims).
-- A portal session JWT is issued AFTER redemption, so we check `used_at IS NOT
-- NULL` (a redeemed token) — opposite of the workspace-side lookup, which
-- needs unused tokens.
--
-- This policy is critical for the EXISTS subquery in the `clients` portal
-- policy (and the 9-2 invoices/reports policies). PostgreSQL evaluates
-- policy subqueries under the querying role's privileges — without this
-- policy, the EXISTS would return false and portal sessions would see no data.

CREATE POLICY rls_portal_tokens_portal_select ON portal_tokens
  FOR SELECT TO portal
  USING (
    id::text = (auth.jwt()->>'portal_token_id')
    AND client_id::text = (auth.jwt()->>'client_id')
    AND revoked_at IS NULL
    AND used_at IS NOT NULL
    AND expires_at > now()
  );

-- ============================================================
-- STEP 6: Portal-role RLS policy on clients
-- ============================================================
-- Establishes the canonical pattern for portal-scoped reads. 9-2 will mirror
-- this on invoices, reports, etc. The portal role may only read the client
-- whose id matches the JWT claim AND whose portal_tokens row (by portal_token_id)
-- is still valid (unexpired, unused, unrevoked). The JOIN through portal_tokens
-- is what enforces "valid portal session" at the RLS layer — no app code needed.

CREATE POLICY rls_clients_portal_select ON clients
  FOR SELECT TO portal
  USING (
    id::text = (auth.jwt()->>'client_id')
    AND EXISTS (
      SELECT 1 FROM portal_tokens pt
      WHERE pt.id::text = (auth.jwt()->>'portal_token_id')
        AND pt.client_id = clients.id
        AND pt.workspace_id = clients.workspace_id
        AND pt.revoked_at IS NULL
        AND pt.used_at IS NOT NULL
        AND pt.expires_at > now()
    )
  );

-- ============================================================
-- STEP 7: verify_portal_token RPC (SECURITY DEFINER)
-- ============================================================
-- Single-use atomic token consumption. SECURITY DEFINER so anon callers (no
-- Supabase Auth session) can validate a magic link without seeing the table.
-- Returns the client/workspace/token context on success; empty on any failure.
-- Sets used_at atomically — re-validation returns empty (single-use enforced).
--
-- Threat model:
--   * Timing attack: PL/pgSQL execution time is dominated by the UPDATE,
--     not row existence. Lookups are by unique index (constant time).
--   * Enumeration: returns empty for unknown/expired/revoked/used. No detail leak.
--   * Race: UPDATE ... WHERE used_at IS NULL is atomic; concurrent calls
--     — only one succeeds (the other sees used_at NOT NULL and returns empty).

CREATE OR REPLACE FUNCTION verify_portal_token(p_token text)
RETURNS TABLE(client_id uuid, workspace_id uuid, token_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_hash text;
  v_row portal_tokens%ROWTYPE;
BEGIN
  -- sha256 hex hash the input (constant-time wrt token existence)
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- Atomic single-use consumption: UPDATE returns the row only if used_at IS NULL.
  -- RETURNING * gives us the pre-update values (client_id, workspace_id, id).
  UPDATE portal_tokens
    SET used_at = now()
    WHERE token_hash = v_hash
      AND used_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now()
    RETURNING * INTO v_row;

  -- No row matched: unknown token, expired, revoked, or already used.
  -- Return empty result set (caller gets NULL on next()).
  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  client_id := v_row.client_id;
  workspace_id := v_row.workspace_id;
  token_id := v_row.id;
  RETURN NEXT;
END;
$$;

-- SECURITY DEFINER functions run with the owner's privileges by default.
-- Revoke execute from public and grant only to anon + authenticated (portal
-- token validation happens before any session exists, so anon is the path).
REVOKE ALL ON FUNCTION verify_portal_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_portal_token(text) TO anon, authenticated;

-- The pgcrypto extension provides digest() in the `extensions` schema. It is
-- already enabled by Supabase bootstrap — but ensure it exists to make the
-- migration self-contained.
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
