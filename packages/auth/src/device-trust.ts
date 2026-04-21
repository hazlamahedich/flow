import { createHash, randomUUID } from 'node:crypto';
import { createFlowError } from '@flow/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@flow/db/client';
import {
  MAX_TRUSTED_DEVICES,
  type DeviceRecord,
  type TrustDeviceResult,
  type TrustDeviceRejected,
  type RevokeDeviceResult,
} from './device-types';

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateDeviceToken(): string {
  return randomUUID();
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown Device';

  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    if (ua.includes('Mac')) return `Firefox${match ? ` ${match[1]}` : ''} on macOS`;
    if (ua.includes('Windows')) return `Firefox${match ? ` ${match[1]}` : ''} on Windows`;
    if (ua.includes('Linux')) return `Firefox${match ? ` ${match[1]}` : ''} on Linux`;
    return `Firefox${match ? ` ${match[1]}` : ''}`;
  }

  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    if (ua.includes('Mac')) return `Edge${match ? ` ${match[1]}` : ''} on macOS`;
    if (ua.includes('Windows')) return `Edge${match ? ` ${match[1]}` : ''} on Windows`;
    if (ua.includes('Linux')) return `Edge${match ? ` ${match[1]}` : ''} on Linux`;
    return `Edge${match ? ` ${match[1]}` : ''}`;
  }

  if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    if (ua.includes('Mac')) return `Chrome${match ? ` ${match[1]}` : ''} on macOS`;
    if (ua.includes('Windows')) return `Chrome${match ? ` ${match[1]}` : ''} on Windows`;
    if (ua.includes('Linux')) return `Chrome${match ? ` ${match[1]}` : ''} on Linux`;
    return `Chrome${match ? ` ${match[1]}` : ''}`;
  }

  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    if (ua.includes('Mac')) return `Safari${match ? ` ${match[1]}` : ''} on macOS`;
    if (ua.includes('iPhone')) return 'Safari on iPhone';
    if (ua.includes('iPad')) return 'Safari on iPad';
    return `Safari${match ? ` ${match[1]}` : ''}`;
  }

  return 'Unknown Device';
}

export { parseUserAgent };

const MAX_TRUST_RETRIES = 3;

export async function trustDevice(
  params: {
    userId: string;
    userAgent: string | null;
    pendingToken?: string;
    supabase?: SupabaseClient;
  },
  retryCount = 0,
): Promise<TrustDeviceResult | TrustDeviceRejected> {
  const supabase = params.supabase ?? createServiceClient();

  const { data: existing } = await supabase
    .from('user_devices')
    .select('id')
    .eq('user_id', params.userId)
    .eq('is_revoked', false);

  const activeCount = existing?.length ?? 0;
  if (activeCount >= MAX_TRUSTED_DEVICES) {
    return {
      trusted: false,
      reason: 'count_exceeded',
      currentCount: activeCount,
      maxDevices: MAX_TRUSTED_DEVICES,
    };
  }

  const token = params.pendingToken ?? generateDeviceToken();
  const tokenHash = hashDeviceToken(token);
  const label = parseUserAgent(params.userAgent);

  const { data: inserted, error } = await supabase
    .from('user_devices')
    .insert({
      user_id: params.userId,
      device_token_hash: tokenHash,
      label,
      user_agent_hint: params.userAgent?.slice(0, 500) ?? null,
    })
    .select('id')
    .single();

  if (error) {
      if (error.code === '23505' && retryCount < MAX_TRUST_RETRIES) {
        const retryParams = { ...params };
        delete (retryParams as Record<string, unknown>).pendingToken;
        return trustDevice(retryParams, retryCount + 1);
      }
    throw createFlowError(500, 'INTERNAL_ERROR', 'Failed to trust device', 'system', {
      originalError: error.message,
    });
  }

  const { data: postInsert } = await supabase
    .from('user_devices')
    .select('id')
    .eq('user_id', params.userId)
    .eq('is_revoked', false);

  if ((postInsert?.length ?? 0) > MAX_TRUSTED_DEVICES) {
    await supabase.from('user_devices').delete().eq('id', inserted.id);
    return {
      trusted: false,
      reason: 'count_exceeded',
      currentCount: (postInsert?.length ?? 1) - 1,
      maxDevices: MAX_TRUSTED_DEVICES,
    };
  }

  return { trusted: true, deviceToken: token, deviceId: inserted.id };
}

export async function verifyDeviceTrust(params: {
  userId: string;
  deviceCookie: string;
}): Promise<{ trusted: boolean; deviceId?: string }> {
  const tokenHash = hashDeviceToken(params.deviceCookie);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('user_devices')
    .select('id, is_revoked')
    .eq('user_id', params.userId)
    .eq('device_token_hash', tokenHash)
    .single();

  if (error) {
    console.error('[device-trust] verifyDeviceTrust query failed:', error.message);
    return { trusted: false };
  }

  if (!data || data.is_revoked) {
    return { trusted: false };
  }

  return { trusted: true, deviceId: data.id };
}

export async function getUserDevices(
  userId: string,
  supabase?: SupabaseClient,
): Promise<DeviceRecord[]> {
  const client = supabase ?? createServiceClient();
  const { data, error } = await client
    .from('user_devices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw createFlowError(500, 'INTERNAL_ERROR', 'Failed to fetch devices', 'system', {
      originalError: error.message,
    });
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    deviceTokenHash: row.device_token_hash,
    label: row.label,
    userAgentHint: row.user_agent_hint,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    isRevoked: row.is_revoked,
  }));
}

export async function revokeDevice(
  params: { userId: string; deviceId: string },
  supabase?: SupabaseClient,
): Promise<RevokeDeviceResult> {
  const client = supabase ?? createServiceClient();

  const { data, error } = await client
    .from('user_devices')
    .update({ is_revoked: true })
    .eq('id', params.deviceId)
    .eq('user_id', params.userId)
    .eq('is_revoked', false)
    .select('id')
    .single();

  if (error || !data) {
    throw createFlowError(404, 'NOT_FOUND', 'Device not found or already revoked', 'validation');
  }

  return { revoked: true, deviceId: data.id };
}

export async function revokeAllDevices(
  userId: string,
  supabase?: SupabaseClient,
): Promise<number> {
  const client = supabase ?? createServiceClient();

  const { data, error } = await client
    .from('user_devices')
    .update({ is_revoked: true })
    .eq('user_id', userId)
    .eq('is_revoked', false)
    .select('id');

  if (error) {
    throw createFlowError(500, 'INTERNAL_ERROR', 'Failed to revoke all devices', 'system', {
      originalError: error.message,
    });
  }

  return data?.length ?? 0;
}

export async function renameDevice(
  params: { userId: string; deviceId: string; label: string },
  supabase?: SupabaseClient,
): Promise<void> {
  const client = supabase ?? createServiceClient();

  const { error } = await client
    .from('user_devices')
    .update({ label: params.label })
    .eq('id', params.deviceId)
    .eq('user_id', params.userId);

  if (error) {
    throw createFlowError(500, 'INTERNAL_ERROR', 'Failed to rename device', 'system', {
      originalError: error.message,
    });
  }
}
