-- Migration: audit_log hash chain trigger
-- Purpose: Per-tenant SHA-256 hash chain for tamper detection
-- Related: Story 1.2 AC#7
-- Note: Uses FOR UPDATE lock for concurrency safety.
-- First row per-tenant gets NULL previous_hash.
-- SECURITY DEFINER with locked search_path to prevent hijacking.

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION compute_audit_hash()
RETURNS trigger AS $$
DECLARE
  prior_hash text;
  canonical_details text;
BEGIN
  SELECT previous_hash INTO prior_hash
  FROM audit_log
  WHERE workspace_id = NEW.workspace_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF prior_hash IS NULL AND FOUND THEN
    prior_hash := '';
  ELSIF NOT FOUND THEN
    prior_hash := '';
  END IF;

  SELECT jsonb_sorted(NEW.details)::text INTO canonical_details;

  NEW.previous_hash := encode(
    digest(
      prior_hash ||
      COALESCE(NEW.workspace_id::text, '') ||
      COALESCE(NEW.action, '') ||
      COALESCE(NEW.entity_type, '') ||
      COALESCE(NEW.entity_id::text, '') ||
      COALESCE(canonical_details, ''),
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog;

CREATE TRIGGER trigger_compute_audit_hash
  BEFORE INSERT ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION compute_audit_hash();

-- Helper function to sort JSONB keys recursively for deterministic hashing
CREATE OR REPLACE FUNCTION extensions.jsonb_sorted(val jsonb)
RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_object_agg(
      key,
      CASE
        WHEN jsonb_typeof(value) = 'object' THEN extensions.jsonb_sorted(value)
        WHEN jsonb_typeof(value) = 'array' THEN (
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(elem) = 'object' THEN extensions.jsonb_sorted(elem)
              ELSE elem
            END
          )
          FROM jsonb_array_elements(value) AS elem
        )
        ELSE value
      END
    )
    FROM jsonb_each(val)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
