-- Migration: Add membership_expires_at to workspace_invitations
-- Purpose: Carry time-bound access intent through invitation flow
-- Related: Story 1.4b Task 3

ALTER TABLE workspace_invitations
  ADD COLUMN membership_expires_at timestamptz;

-- Update accept_invitation RPC to use membership_expires_at
CREATE OR REPLACE FUNCTION accept_invitation(p_token uuid)
RETURNS uuid AS $$
DECLARE
  v_invitation RECORD;
  v_user_email text;
BEGIN
  v_user_email := auth.jwt()->>'email';

  SELECT * INTO v_invitation
  FROM workspace_invitations
  WHERE token_hash = encode(digest(p_token::text, 'sha256'), 'hex')
    AND accepted_at IS NULL
    AND expires_at > now()
    AND email = v_user_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, already accepted, expired, or not addressed to you';
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role, status, expires_at)
  VALUES (
    v_invitation.workspace_id,
    auth.uid(),
    v_invitation.role,
    'active',
    v_invitation.membership_expires_at
  )
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET
    status = 'active',
    role = EXCLUDED.role,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  WHERE workspace_members.status = 'expired';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is already a member of this workspace or has been revoked';
  END IF;

  UPDATE workspace_invitations SET accepted_at = now() WHERE id = v_invitation.id;

  RETURN v_invitation.workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog;
