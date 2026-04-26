import type { SupabaseClient } from '@supabase/supabase-js';
import type { Retainer } from '@flow/types';
import { mapRetainerRow } from './crud-helpers';

interface ClientIdInput {
  clientId: string;
  workspaceId: string;
}

interface RetainerIdInput {
  retainerId: string;
  workspaceId: string;
}

export async function getActiveRetainerForClient(
  client: SupabaseClient,
  input: ClientIdInput,
): Promise<Retainer | null> {
  const { data, error } = await client
    .from('retainer_agreements')
    .select('*')
    .eq('client_id', input.clientId)
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const retainer = mapRetainerRow(data);

  if (retainer.endDate) {
    const endUtc = new Date(retainer.endDate + 'T23:59:59Z');
    const nowUtc = new Date();
    if (endUtc < nowUtc) {
      const { error: expError } = await client
        .from('retainer_agreements')
        .update({ status: 'expired' })
        .eq('id', retainer.id)
        .eq('workspace_id', input.workspaceId)
        .eq('status', 'active');
      if (expError) return retainer;
      return { ...retainer, status: 'expired' as const };
    }
  }

  return retainer;
}

export async function getRetainerById(
  client: SupabaseClient,
  input: RetainerIdInput,
): Promise<Retainer | null> {
  const { data, error } = await client
    .from('retainer_agreements')
    .select('*')
    .eq('id', input.retainerId)
    .eq('workspace_id', input.workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRetainerRow(data);
}

export async function listRetainersForClient(
  client: SupabaseClient,
  input: ClientIdInput,
): Promise<Retainer[]> {
  const { data, error } = await client
    .from('retainer_agreements')
    .select('*')
    .eq('client_id', input.clientId)
    .eq('workspace_id', input.workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRetainerRow);
}

interface CreateRetainerInput {
  workspaceId: string;
  data: {
    clientId: string;
    type: 'hourly_rate' | 'flat_monthly' | 'package_based';
    hourlyRateCents?: number | null | undefined;
    monthlyFeeCents?: number | null | undefined;
    monthlyHoursThreshold?: string | null | undefined;
    packageHours?: string | null | undefined;
    packageName?: string | null | undefined;
    billingPeriodDays?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | null | undefined;
    notes?: string | null | undefined;
  };
}

export async function createRetainer(
  client: SupabaseClient,
  input: CreateRetainerInput,
): Promise<Retainer> {
  const { data, error } = await client
    .from('retainer_agreements')
    .insert({
      workspace_id: input.workspaceId,
      client_id: input.data.clientId,
      type: input.data.type,
      hourly_rate_cents: input.data.hourlyRateCents ?? null,
      monthly_fee_cents: input.data.monthlyFeeCents ?? null,
      monthly_hours_threshold: input.data.monthlyHoursThreshold ?? null,
      package_hours: input.data.packageHours ?? null,
      package_name: input.data.packageName ?? null,
      billing_period_days: input.data.billingPeriodDays ?? 30,
      start_date: input.data.startDate ?? new Date().toISOString().split('T')[0],
      end_date: input.data.endDate ?? null,
      notes: input.data.notes || null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw Object.assign(error, { retainerCode: 'RETAINER_ACTIVE_EXISTS' });
    }
    throw error;
  }

  return mapRetainerRow(data);
}

interface UpdateRetainerData {
  hourlyRateCents?: number | null | undefined;
  monthlyFeeCents?: number | null | undefined;
  monthlyHoursThreshold?: string | null | undefined;
  packageHours?: string | null | undefined;
  packageName?: string | null | undefined;
  billingPeriodDays?: number | undefined;
  notes?: string | null | undefined;
  endDate?: string | null | undefined;
}

interface UpdateRetainerInput {
  retainerId: string;
  workspaceId: string;
  data: UpdateRetainerData;
}

const FIELD_MAP: Record<string, string> = {
  hourlyRateCents: 'hourly_rate_cents',
  monthlyFeeCents: 'monthly_fee_cents',
  monthlyHoursThreshold: 'monthly_hours_threshold',
  packageHours: 'package_hours',
  packageName: 'package_name',
  billingPeriodDays: 'billing_period_days',
  notes: 'notes',
  endDate: 'end_date',
};

export async function updateRetainer(
  client: SupabaseClient,
  input: UpdateRetainerInput,
): Promise<Retainer> {
  const updates: Record<string, unknown> = {};

  for (const [key, dbField] of Object.entries(FIELD_MAP)) {
    if (key in input.data) {
      const value = input.data[key as keyof UpdateRetainerData];
      if (typeof value === 'string' && value === '') {
        updates[dbField] = null;
      } else {
        updates[dbField] = value;
      }
    }
  }

  const { data, error } = await client
    .from('retainer_agreements')
    .update(updates)
    .eq('id', input.retainerId)
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'active')
    .select('*')
    .single();

  if (error) throw error;
  return mapRetainerRow(data);
}

interface CancelRetainerInput {
  retainerId: string;
  workspaceId: string;
  reason?: string;
}

export async function cancelRetainer(
  client: SupabaseClient,
  input: CancelRetainerInput,
): Promise<Retainer> {
  const existing = await getRetainerById(client, {
    retainerId: input.retainerId,
    workspaceId: input.workspaceId,
  });

  if (!existing) {
    throw new Error('RETAINER_NOT_FOUND');
  }

  if (existing.status !== 'active') {
    throw new Error('RETAINER_NOT_ACTIVE');
  }

  const { data, error } = await client
    .from('retainer_agreements')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: input.reason ?? null,
    })
    .eq('id', input.retainerId)
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'active')
    .select('*')
    .single();

  if (error) throw error;
  return mapRetainerRow(data);
}
