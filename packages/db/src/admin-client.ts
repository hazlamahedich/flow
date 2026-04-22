import { createServiceClient } from './client';

/**
 * Creates a Supabase admin client using the service_role key.
 *
 * **Use ONLY for auth/session operations** — never for data access.
 * All data access must go through a regular client with RLS enforcement.
 *
 * Permitted use cases:
 * - Updating `app_metadata.workspace_id` for workspace switching
 * - Auth admin operations (user lookup, session management)
 *
 * The service_role key bypasses RLS — using it for queries would
 * circumvent the tenant isolation security perimeter.
 */
export function createAdminSupabase() {
  return createServiceClient();
}
