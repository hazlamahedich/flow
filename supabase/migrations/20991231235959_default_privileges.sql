-- Migration: default privileges for Supabase local and CI parity
-- Purpose: Ensure the authenticated and service_role roles can access tables
-- created in the public schema. RLS remains the actual security perimeter.
-- This migration is idempotent and mirrors the default grants Supabase applies
-- in hosted projects. It fixes pgTAP RLS tests failing with
-- "permission denied for table" when using supabase start/test db.

-- Grant usage on the public schema (safe noop if already granted).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, portal;

-- pgTAP helpers live in the extensions schema in local/CI. Portal must be able
-- to resolve them while impersonating a JWT-only role during RLS tests.
GRANT USAGE ON SCHEMA extensions TO portal;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO portal;

-- Grant privileges on all existing tables and sequences.
-- anon is included so RLS (not permission errors) governs unauthenticated reads.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure future objects created by postgres in public are accessible.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Portal role is NOLOGIN and used only via JWT claims in pgTAP/CI. Give it a
-- predictable search path so RLS assertions can resolve pgTAP helpers.
ALTER ROLE portal SET search_path = public, extensions;
