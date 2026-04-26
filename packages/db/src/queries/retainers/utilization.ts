import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScopeCreepAlert } from '@flow/types';
import { numericToMinutes } from '@flow/shared';
import { getCurrentBillingPeriod } from './billing-periods';

interface UtilizationInput {
  retainerId: string;
  workspaceId: string;
}

export interface UtilizationResult {
  totalMinutes: number;
  allocatedMinutes: number;
  utilizationPercent: number;
  billingPeriodStart: string;
  billingPeriodEnd: string | null;
}

export async function getRetainerUtilization(
  client: SupabaseClient,
  input: UtilizationInput,
): Promise<UtilizationResult | null> {
  const { data: retainer, error: retainerError } = await client
    .from('retainer_agreements')
    .select('*')
    .eq('id', input.retainerId)
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'active')
    .maybeSingle();

  if (retainerError) throw retainerError;
  if (!retainer) return null;

  let allocatedHoursStr: string | null = null;
  if (retainer.type === 'flat_monthly') {
    allocatedHoursStr = retainer.monthly_hours_threshold;
  } else if (retainer.type === 'package_based') {
    allocatedHoursStr = retainer.package_hours;
  }

  if (!allocatedHoursStr || retainer.type === 'hourly_rate') {
      const startDate = new Date(retainer.start_date + 'T00:00:00Z');
      const now = new Date();
      const { periodStart } = getCurrentBillingPeriod(startDate, retainer.billing_period_days, now);
      const periodStartStr = periodStart.toISOString().slice(0, 10);

      const { data: entries, error: teError } = await client
        .from('time_entries')
        .select('duration_minutes')
        .eq('client_id', retainer.client_id)
        .eq('workspace_id', input.workspaceId)
        .gte('date', periodStartStr);

      if (teError) throw teError;
      const totalMinutes = (entries ?? []).reduce((sum: number, e: { duration_minutes: number }) => sum + e.duration_minutes, 0);

      return {
        totalMinutes,
        allocatedMinutes: 0,
        utilizationPercent: 0,
        billingPeriodStart: retainer.start_date,
        billingPeriodEnd: null as string | null,
      };
    }

    const allocatedMinutes = numericToMinutes(allocatedHoursStr);
    if (allocatedMinutes <= 0) {
      return {
        totalMinutes: 0,
        allocatedMinutes: 0,
        utilizationPercent: 0,
        billingPeriodStart: retainer.start_date,
        billingPeriodEnd: null as string | null,
      };
    }
    const thresholdMinutes = Math.ceil(allocatedMinutes * 90 / 100);
    if (thresholdMinutes <= 0) {
      return {
        totalMinutes: 0,
        allocatedMinutes: 0,
        utilizationPercent: 0,
        billingPeriodStart: retainer.start_date,
        billingPeriodEnd: null as string | null,
      };
    }

  const startDate = new Date(retainer.start_date + 'T00:00:00Z');
  const now = new Date();
  const { periodStart, periodEnd } = getCurrentBillingPeriod(startDate, retainer.billing_period_days, now);
  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);

  const { data: entries, error: teError } = await client
    .from('time_entries')
    .select('duration_minutes')
    .eq('client_id', retainer.client_id)
    .eq('workspace_id', input.workspaceId)
    .gte('date', periodStartStr)
    .lt('date', periodEndStr);

  if (teError) throw teError;
  const totalMinutes = (entries ?? []).reduce((sum: number, e: { duration_minutes: number }) => sum + e.duration_minutes, 0);
  const utilizationPercent = allocatedMinutes > 0 ? Math.floor(totalMinutes * 100 / allocatedMinutes) : 0;

  return {
    totalMinutes,
    allocatedMinutes,
    utilizationPercent,
    billingPeriodStart: periodStartStr,
    billingPeriodEnd: periodEndStr,
  };
}

export async function getScopeCreepAlerts(
  client: SupabaseClient,
  input: { workspaceId: string },
): Promise<ScopeCreepAlert[]> {
  const { data, error } = await client.rpc('get_scope_creep_alerts', {
    p_workspace_id: input.workspaceId,
  });

  if (error) {
    console.warn('[getScopeCreepAlerts] RPC failed, using JS fallback:', error.message);
    return await getScopeCreepAlertsFallback(client, input);
  }

  return (data ?? []) as ScopeCreepAlert[];
}

async function getScopeCreepAlertsFallback(
  client: SupabaseClient,
  input: { workspaceId: string },
): Promise<ScopeCreepAlert[]> {
  const { data: retainers, error: rError } = await client
    .from('retainer_agreements')
    .select('id, client_id, type, monthly_hours_threshold, package_hours, billing_period_days, start_date, clients(name)')
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'active')
    .in('type', ['flat_monthly', 'package_based']);

  if (rError) throw rError;

  const alerts: ScopeCreepAlert[] = [];

  for (const r of (retainers ?? [])) {
    const allocatedHoursStr = r.type === 'flat_monthly'
      ? r.monthly_hours_threshold
      : r.package_hours;

    if (!allocatedHoursStr) continue;
    if (r.type === 'flat_monthly' && !r.monthly_hours_threshold) continue;

    const allocatedMinutes = numericToMinutes(allocatedHoursStr);
    if (allocatedMinutes <= 0) continue;
    const thresholdMinutes = Math.ceil(allocatedMinutes * 90 / 100);

    const startDate = new Date(r.start_date + 'T00:00:00Z');
    const now = new Date();
    const { periodStart, periodEnd } = getCurrentBillingPeriod(startDate, r.billing_period_days, now);
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    const { data: entries, error: teError } = await client
      .from('time_entries')
      .select('duration_minutes')
      .eq('client_id', r.client_id)
      .eq('workspace_id', input.workspaceId)
      .gte('date', periodStartStr)
      .lt('date', periodEndStr);

    if (teError) throw teError;
    const trackedMinutes = (entries ?? []).reduce((sum: number, e: { duration_minutes: number }) => sum + e.duration_minutes, 0);

    if (trackedMinutes >= thresholdMinutes && thresholdMinutes > 0) {
      const clientRow = r.clients as unknown as { name: string } | null;
      const clientName = clientRow?.name ?? 'Unknown';
      alerts.push({
        retainerId: r.id,
        clientId: r.client_id,
        clientName,
        retainerType: r.type,
        trackedMinutes,
        thresholdMinutes,
        utilizationPercent: Math.floor(trackedMinutes * 100 / thresholdMinutes),
      });
    }
  }

  return alerts;
}
