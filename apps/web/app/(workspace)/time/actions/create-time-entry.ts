'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  createTimeEntry,
} from '@flow/db';

export const createTimeEntrySchema = z
  .object({
    clientId: z.string().uuid(),
    projectId: z.string().uuid().nullable(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((d) => {
        const t = new Date();
        const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        return d <= todayStr;
      }, 'Date cannot be in the future'),
    durationMinutes: z.number().int().min(1).max(1440),
    startMinutes: z.number().int().min(0).max(1439).optional(),
    endMinutes: z.number().int().min(0).max(1439).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => (d.startMinutes != null) === (d.endMinutes != null), {
    message: 'Both start and end times are required together.',
  })
  .refine(
    (d) => {
      if (d.startMinutes != null && d.endMinutes != null)
        return d.startMinutes < d.endMinutes;
      return true;
    },
    { message: 'End time must be after start time.' },
  )
  .refine(
    (d) => {
      if (d.startMinutes != null && d.endMinutes != null) {
        if (d.startMinutes + d.durationMinutes > 1440) return false;
      }
      return true;
    },
    {
      message:
        'Entry spans midnight. Split into two entries for each calendar day.',
    },
  );

export async function createTimeEntryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTimeEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
      ),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (parsed.data.projectId) {
    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('client_id')
      .eq('id', parsed.data.projectId)
      .eq('workspace_id', ctx.workspaceId)
      .single();
    if (
      projErr ||
      !proj ||
      (proj as { client_id: string }).client_id !== parsed.data.clientId
    ) {
      return {
        success: false,
        error: createFlowError(
          400,
          'VALIDATION_ERROR',
          'Project does not belong to the selected client',
          'validation',
        ),
      };
    }
  }

  try {
    const entry = await createTimeEntry(supabase, {
      workspaceId: ctx.workspaceId,
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      userId: ctx.userId,
      date: parsed.data.date,
      durationMinutes: parsed.data.durationMinutes,
      startMinutes: parsed.data.startMinutes ?? null,
      endMinutes: parsed.data.endMinutes ?? null,
      notes: parsed.data.notes ?? null,
    });

    return { success: true, data: { id: entry.id } };
  } catch {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to log time — try again',
        'system',
      ),
    };
  }
}
