import { getServerSupabase } from '@/lib/supabase-server';
import type { WorkspaceAuditEvent } from '@flow/types';

export async function logWorkspaceEvent(event: WorkspaceAuditEvent): Promise<void> {
  try {
    const supabase = await getServerSupabase();

    await supabase.from('audit_log').insert({
      workspace_id: 'workspaceId' in event ? event.workspaceId : null,
      action: event.type,
      entity_type: 'workspace',
      details: event as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error('Failed to log workspace event:', err);
  }
}
