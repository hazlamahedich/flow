import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolveHourlyRateResult {
  rateCents: number;
  source: 'retainer' | 'client';
}

/**
 * Resolve hourly rate for a client in this precedence order:
 * 1. Active retainer agreement with hourly_rate_cents > 0
 * 2. Client's own hourly_rate_cents > 0
 *
 * Returns null if neither exists.
 */
export async function resolveHourlyRate(
  client: SupabaseClient,
  clientId: string,
  workspaceId?: string,
): Promise<ResolveHourlyRateResult | null> {
  // Priority 1: Active retainer with positive hourly_rate_cents
  let retainerQuery = client
    .from('retainer_agreements')
    .select('hourly_rate_cents, created_at')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .gt('hourly_rate_cents', 0);
  if (workspaceId) retainerQuery = retainerQuery.eq('workspace_id', workspaceId);
  const { data: retainer } = await retainerQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (retainer?.hourly_rate_cents) {
    return { rateCents: Number(retainer.hourly_rate_cents), source: 'retainer' };
  }

  // Priority 2: Client's own hourly_rate_cents
  let clientQuery = client
    .from('clients')
    .select('hourly_rate_cents')
    .eq('id', clientId);
  if (workspaceId) clientQuery = clientQuery.eq('workspace_id', workspaceId);
  const { data: clientRow } = await clientQuery.maybeSingle();

  if (clientRow?.hourly_rate_cents && Number(clientRow.hourly_rate_cents) > 0) {
    return { rateCents: Number(clientRow.hourly_rate_cents), source: 'client' };
  }

  return null;
}
