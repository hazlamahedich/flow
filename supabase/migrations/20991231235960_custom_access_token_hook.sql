-- Migration: custom access token hook for local/CI parity
-- Purpose: Supabase Auth issues the workspace_id and role inside `app_metadata`.
--          Our RLS policies read them as top-level JWT claims (`auth.jwt()->>'...'`),
--          so local `supabase start` and CI must flatten those fields into the
--          issued access token. This hook only runs in self-hosted Supabase; hosted
--          projects can use an equivalent Auth Hook.
--
-- Note: The hook must live in the public schema because the auth schema is not
--       writable by the migration runner. SECURITY DEFINER keeps the elevated
--       privileges scoped to this single function.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  claims jsonb := event->'claims';
  app_metadata jsonb;
BEGIN
  app_metadata := claims->'app_metadata';

  -- Flatten workspace_id into a top-level claim so existing RLS policies can
  -- read it directly. Preserve the original Postgres connection role claim
  -- ('authenticated' / 'anon' / 'service_role' / 'portal'); the workspace role
  -- stays inside app_metadata for code that needs it.
  IF app_metadata ? 'workspace_id' THEN
    claims := jsonb_set(claims, '{workspace_id}', app_metadata->'workspace_id');
  END IF;

  RETURN jsonb_build_object('claims', claims);
END;
$$;

-- Revoke public access and grant execute to the Supabase Auth service role.
REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Flattens workspace_id and workspace role from app_metadata into top-level JWT claims for RLS compatibility.';
