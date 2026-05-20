import type { SupabaseClient } from '@supabase/supabase-js';

export async function resolveOriginatingSignal(
  supabase: SupabaseClient,
  workspaceId: string,
  sourceEmailId: string | null,
): Promise<void> {
  if (!sourceEmailId) return;

  try {
    const { data: signals } = await supabase
      .from('agent_signals')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('signal_type', 'action_extracted')
      .eq('agent_id', 'inbox')
      .eq('entity_id', sourceEmailId)
      .is('resolved_at', null)
      .limit(1);

    if (!signals || signals.length === 0) return;

    await supabase
      .from('agent_signals')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', (signals as Array<{ id: string }>)[0]!.id)
      .eq('workspace_id', workspaceId);
  } catch {
    // non-blocking — signal resolution is best-effort
  }
}
