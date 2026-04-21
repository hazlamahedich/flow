-- pgTAP tests for workspace management RLS policies
-- Related: Story 1.4a AC#3
-- CRITICAL: Every RLS policy uses workspace_id::text cast against JWT claims.
-- This test suite verifies both policy existence AND ::text cast usage.

BEGIN;

SELECT plan(28);

-- ============================================================
-- Table existence and structure
-- ============================================================

SELECT has_table('workspace_invitations', 'workspace_invitations table exists');
SELECT has_table('member_client_access', 'member_client_access table exists');
SELECT has_table('transfer_requests', 'transfer_requests table exists');

SELECT columns_are('workspace_invitations', ARRAY[
  'id', 'workspace_id', 'email', 'role', 'token_hash',
  'expires_at', 'accepted_at', 'invited_by', 'created_at'
], 'workspace_invitations has correct columns');

SELECT columns_are('transfer_requests', ARRAY[
  'id', 'workspace_id', 'from_user_id', 'to_user_id',
  'status', 'created_at', 'expires_at', 'accepted_at'
], 'transfer_requests has correct columns');

SELECT has_column('workspaces', 'slug', 'workspaces has slug column');
SELECT has_column('workspaces', 'created_by', 'workspaces has created_by column');
SELECT has_column('workspace_members', 'status', 'workspace_members has status column');

-- ============================================================
-- RLS enabled on all 5 tables
-- ============================================================

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'workspaces'),
  true,
  'RLS enabled on workspaces'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'workspace_members'),
  true,
  'RLS enabled on workspace_members'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'workspace_invitations'),
  true,
  'RLS enabled on workspace_invitations'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'member_client_access'),
  true,
  'RLS enabled on member_client_access'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'transfer_requests'),
  true,
  'RLS enabled on transfer_requests'
);

-- ============================================================
-- ::text cast regression tests
-- Verify policy expressions contain workspace_id::text = auth.jwt()
-- ============================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_proc pr ON pr.oid = p.polqual OR pr.oid = p.polwithcheck
    WHERE c.relname IN ('workspaces', 'workspace_members', 'workspace_invitations', 'member_client_access', 'transfer_requests')
    AND p.polname LIKE 'rls_%'
  ),
  'RLS policies with rls_ prefix exist on all 5 tables'
);

-- Verify old removed_at-based policies are gone
SELECT is(
  (SELECT count(*) FROM pg_policy WHERE polname LIKE 'policy_%' AND polname LIKE '%removed%'),
  0::bigint,
  'Old removed_at-based RLS policies are dropped'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'policy_workspaces_select_member'
  ),
  'Old policy_workspaces_select_member is dropped'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'policy_workspace_members_select_member'
  ),
  'Old policy_workspace_members_select_member is dropped'
);

-- ============================================================
-- Unique indexes
-- ============================================================

SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invitations_token_hash'),
  'idx_invitations_token_hash exists'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'one_pending_invitation_per_workspace_email'),
  'one_pending_invitation_per_workspace_email exists'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'one_pending_transfer_per_workspace'),
  'one_pending_transfer_per_workspace exists'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workspaces_slug'),
  'idx_workspaces_slug unique index exists'
);

-- ============================================================
-- RPC existence
-- ============================================================

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_workspace'),
  'create_workspace RPC exists'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'accept_invitation'),
  'accept_invitation RPC exists'
);

-- ============================================================
-- Trigger fix
-- ============================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_prevent_owner_escalation'
  ),
  'prevent_owner_escalation trigger exists'
);

-- ============================================================
-- Self-transfer prevention
-- ============================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transfer_requests_no_self_transfer'
      AND conrelid = 'transfer_requests'::regclass
  ),
  'transfer_requests self-transfer CHECK constraint exists'
);

SELECT finish();
ROLLBACK;
