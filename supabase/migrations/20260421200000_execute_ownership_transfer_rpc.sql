-- Migration: Atomic ownership transfer RPC
-- Purpose: AC#5 requires SELECT ... FOR UPDATE + atomic swap
-- Related: Story 1.4b Patch (transfer executor non-atomic)

CREATE OR REPLACE FUNCTION execute_ownership_transfer(
  p_workspace_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_transfer_id uuid
)
RETURNS void AS $$
DECLARE
  v_from_membership workspace_members%ROWTYPE;
  v_to_membership workspace_members%ROWTYPE;
  v_transfer transfer_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_from_membership
  FROM workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = p_from_user_id
    AND role = 'owner'
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Initiator is no longer an active owner';
  END IF;

  SELECT * INTO v_to_membership
  FROM workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = p_to_user_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user is not an active member';
  END IF;

  SELECT * INTO v_transfer
  FROM transfer_requests
  WHERE id = p_transfer_id
    AND workspace_id = p_workspace_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer request not found or not pending';
  END IF;

  IF v_transfer.expires_at < now() THEN
    UPDATE transfer_requests SET status = 'expired' WHERE id = p_transfer_id;
    RAISE EXCEPTION 'Transfer request has expired';
  END IF;

  UPDATE workspace_members
  SET role = 'member', updated_at = now()
  WHERE id = v_from_membership.id;

  UPDATE workspace_members
  SET role = 'owner', updated_at = now()
  WHERE id = v_to_membership.id;

  UPDATE workspaces
  SET created_by = p_to_user_id
  WHERE id = p_workspace_id;

  UPDATE transfer_requests
  SET status = 'accepted', accepted_at = now()
  WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog;
