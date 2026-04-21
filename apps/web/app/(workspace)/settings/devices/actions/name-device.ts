'use server';

import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { renameDevice } from '@flow/auth/device-trust';
import { getServerSupabase } from '@/lib/supabase-server';
import { z } from 'zod';

const renameSchema = z.object({
  deviceId: z.string().uuid(),
  label: z.string().min(1).max(100),
});

export async function nameDevice(
  _prev: ActionResult<{ named: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ named: true }>> {
  const parsed = renameSchema.safeParse({
    deviceId: formData.get('deviceId'),
    label: formData.get('label'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
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

  try {
    await renameDevice(
      { userId: session.user.id, deviceId: parsed.data.deviceId, label: parsed.data.label },
      supabase,
    );

    return { success: true, data: { named: true } };
  } catch (err) {
    if (err instanceof Error && 'code' in err) {
      return { success: false, error: err as unknown as import('@flow/types').FlowError };
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to name device', 'system'),
    };
  }
}
