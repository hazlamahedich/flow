-- Migration: default table privileges for Supabase local and CI parity
-- Purpose: Ensure the authenticated and service_role roles can access tables
-- created in the public schema. RLS remains the actual security perimeter.
-- This migration is idempotent and mirrors the default grants Supabase applies
-- in hosted projects. It fixes pgTAP RLS tests failing with
-- "permission denied for table" when using supabase start/test db.

-- Grant usage on the public schema (safe noop if already granted).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, portal;

-- Grant privileges on all existing tables and sequences.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Ensure future objects created by postgres in public are accessible.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO authenticated, service_role;
