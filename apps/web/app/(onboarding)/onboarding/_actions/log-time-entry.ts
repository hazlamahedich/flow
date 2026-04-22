'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import type { ActionResult } from '@flow/types';

const logTimeEntrySchema = z.object({
  client_id: z.string().uuid('Invalid client'),
  date: z.string().min(1, 'Date is required'),
  duration_minutes: z
    .number({ message: 'Duration is required' })
    .int('Duration must be a whole number')
    .positive('Duration must be greater than 0')
    .max(1440, 'Duration cannot exceed 24 hours'),
  description: z.string().max(500).optional().or(z.literal('')),
});

type LogTimeEntryInput = z.infer<typeof logTimeEntrySchema>;

interface TimeEntryRecord {
  id: string;
  client_id: string;
  date: string;
  duration_minutes: number;
  description: string | null;
}

export async function logTimeEntry(
  input: LogTimeEntryInput,
): Promise<ActionResult<TimeEntryRecord>> {
  const parsed = logTimeEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Validation failed',
        category: 'validation',
      },
    };
  }

  const supabase = await getServerSupabase();

  let workspaceId: string;
  let userId: string;
  try {
    const ctx = await requireTenantContext(supabase);
    workspaceId = ctx.workspaceId;
    userId = ctx.userId;
  } catch {
    return {
      success: false,
      error: {
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
        category: 'auth',
      },
    };
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      client_id: parsed.data.client_id,
      date: parsed.data.date,
      duration_minutes: parsed.data.duration_minutes,
      description: parsed.data.description || null,
    })
    .select('id, client_id, date, duration_minutes, description')
    .single();

  if (error) {
    return {
      success: false,
      error: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to log time entry',
        category: 'system',
      },
    };
  }

  revalidateTag('time-entries');
  return { success: true, data: data as TimeEntryRecord };
}

export { logTimeEntrySchema };
