'use server';

import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  createTimeEntry,
} from '@flow/db';
// Schemas live in a sibling non-'use server' module because Next.js 15
// forbids exporting runtime values (like Zod schemas) from 'use server' files.
import { createTimeEntrySchema } from './schemas';

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
