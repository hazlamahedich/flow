import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getTrustMatrixEntry, getTransitions, getPreconditions } from '@flow/db';
import { TrustDetailPanel } from '@/components/trust/trust-detail-panel';
import type { TrustLevel } from '@flow/trust';

interface TrustSectionProps {
  agentId: string;
}

export async function TrustSection({ agentId }: TrustSectionProps) {
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  const entry = await getTrustMatrixEntry(workspaceId, agentId, 'general');
  const transitions = entry
    ? await getTransitions(workspaceId, agentId, 10)
    : [];
  const preconditions = entry
    ? await getPreconditions(workspaceId, agentId, entry.action_type)
    : [];

  return (
    <TrustDetailPanel
      agentId={agentId}
      initialEntry={entry ? { ...entry, current_level: (entry.current_level as TrustLevel) ?? 'supervised' } : null}
      initialTransitions={transitions.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        from_level: t.from_level as string,
        to_level: t.to_level as string,
        trigger_type: t.trigger_type as string,
        trigger_reason: t.trigger_reason as string,
        created_at: t.created_at as string,
      }))}
      initialPreconditions={preconditions.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        condition_key: p.condition_key as string,
        condition_expr: p.condition_expr as string,
      }))}
    />
  );
}
