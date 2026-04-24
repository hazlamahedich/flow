import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getTrustMatrixEntry, getTransitions, getPreconditions } from '@flow/db';
import type { TrustTransitionDbRow, TrustPreconditionDbRow } from '@flow/db';
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
      initialTransitions={transitions.map((t: TrustTransitionDbRow) => ({
        id: t.id,
        from_level: t.from_level,
        to_level: t.to_level,
        trigger_type: t.trigger_type,
        trigger_reason: t.trigger_reason,
        created_at: t.created_at,
      }))}
      initialPreconditions={preconditions.map((p: TrustPreconditionDbRow) => ({
        id: p.id,
        condition_key: p.condition_key,
        condition_expr: p.condition_expr,
      }))}
    />
  );
}
