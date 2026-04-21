'use server';

import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { revokeAllDevices } from '@flow/auth/device-trust';
import { invalidateUserSessions } from '@flow/auth/server-admin';
import { getServerSupabase } from '@/lib/supabase-server';
import { logAuthEvent } from '@/lib/auth-audit';
import { headers } from 'next/headers';

export async function revokeAllDevicesAction(): Promise<ActionResult<{ revokedCount: number }>> {
  const supabase = await getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return {
      success: false,
      error: createFlowError(401, 'AUTH_REQUIRED', 'Not authenticated', 'auth'),
    };
  }

  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? 'unknown';

  try {
    const count = await revokeAllDevices(session.user.id, supabase);

    try {
      await invalidateUserSessions(session.user.id);
    } catch (invalidateError) {
      console.error('[revoke-all-devices] Session invalidation failed (devices still revoked):', invalidateError);
    }

    await logAuthEvent({
      action: 'all_devices_revoked',
      userId: session.user.id,
      ip,
      outcome: 'success',
      details: { revoked_count: count },
    });

    return { success: true, data: { revokedCount: count } };
  } catch (err) {
    await logAuthEvent({
      action: 'all_devices_revoked',
      userId: session.user.id,
      ip,
      outcome: 'failure',
    });

    if (err instanceof Error && 'code' in err) {
      return { success: false, error: err as unknown as import('@flow/types').FlowError };
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to revoke all devices', 'system'),
    };
  }
}
