'use server';

import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { revokeDevice } from '@flow/auth/device-trust';
import { getServerSupabase } from '@/lib/supabase-server';
import { logAuthEvent } from '@/lib/auth-audit';
import { headers } from 'next/headers';
import { z } from 'zod';

const revokeSchema = z.object({
  deviceId: z.string().uuid(),
});

export async function revokeDeviceAction(
  _prev: ActionResult<{ revoked: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ revoked: true }>> {
  const parsed = revokeSchema.safeParse({
    deviceId: formData.get('deviceId'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid device ID',
        'validation',
      ),
    };
  }

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
    await revokeDevice(
      { userId: session.user.id, deviceId: parsed.data.deviceId },
      supabase,
    );

    await logAuthEvent({
      action: 'device_revoked',
      userId: session.user.id,
      ip,
      outcome: 'success',
      details: { device_id: parsed.data.deviceId },
    });

    return { success: true, data: { revoked: true } };
  } catch (err) {
    await logAuthEvent({
      action: 'device_revoked',
      userId: session.user.id,
      ip,
      outcome: 'failure',
      details: { device_id: parsed.data.deviceId },
    });

    if (err instanceof Error && 'code' in err) {
      return { success: false, error: err as unknown as import('@flow/types').FlowError };
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to revoke device', 'system'),
    };
  }
}
