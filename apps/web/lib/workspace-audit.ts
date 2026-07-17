import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase-server';
import type { WorkspaceAuditEvent } from '@flow/types';

/**
 * Write a workspace audit event to the `audit_log` table.
 *
 * `audit_log` has SELECT-only RLS policies (no INSERT policy for
 * `authenticated`), so a user-scoped client cannot insert — the call would
 * silently no-op (caught by the try/catch). Callers running in a privileged
 * context (Stripe webhooks, system jobs) MUST pass their `service_role`
 * client via the optional second arg so the row actually lands.
 * User-facing Server Actions may omit it and fall back to `getServerSupabase`
 * — those paths were already silently best-effort pre-9-5c; the webhook path
 * is the one that genuinely needs the audit row for observability.
 */
export async function logWorkspaceEvent(
  event: WorkspaceAuditEvent,
  supabase?: SupabaseClient,
): Promise<void> {
  try {
    const client = supabase ?? (await getServerSupabase());

    await client.from('audit_log').insert({
      workspace_id: 'workspaceId' in event ? event.workspaceId : null,
      action: event.type,
      entity_type: 'workspace',
      details: event as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error('Failed to log workspace event:', err);
  }
}
