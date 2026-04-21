-- Story 1.3a: Device Trust & Session Persistence
-- Creates user_devices table for trusted device management.
-- Stores SHA-256 hashes of device tokens (never raw UUIDs).
-- Max 5 trusted devices per user enforced via application logic.
-- Related: FO-1.3a, PRD#FR7, PRD#FR10

CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token_hash text NOT NULL,
  label text NOT NULL DEFAULT 'New Device',
  user_agent_hint text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_revoked boolean NOT NULL DEFAULT false
);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_user_token_hash
  ON public.user_devices (user_id, device_token_hash);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id
  ON public.user_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_active
  ON public.user_devices (user_id)
  WHERE is_revoked = false;

-- RLS: Users can only manage their own devices
CREATE POLICY policy_user_devices_select_own ON public.user_devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY policy_user_devices_insert_own ON public.user_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY policy_user_devices_update_own ON public.user_devices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY policy_user_devices_delete_own ON public.user_devices
  FOR DELETE USING (auth.uid() = user_id);
