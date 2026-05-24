'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  getTimeEntryForUpdate,
  updateTimeEntry,
  insertEditHistory,
  defaultInvoiceEditGuard,
} from '@flow/db';

export const updateTimeEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return d <= todayStr;
  }, 'Date cannot be in the future'),
  durationMinutes: z.number().int().min(1).max(1440),
  startMinutes: z.number().int().min(0).max(1439).nullable().optional(),
  endMinutes: z.number().int().min(0).max(1439).nullable().optional(),
  clientId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable()),
  projectId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable()),
  notes: z.string().max(500).nullable(),
  invoicedAcknowledged: z.boolean().optional(),
}).refine(
  (d) => {
    const startProvided = d.startMinutes !== undefined;
    const endProvided = d.endMinutes !== undefined;
    if (!startProvided && !endProvided) return true;
    if (startProvided !== endProvided) return false;
    return (d.startMinutes != null) === (d.endMinutes != null);
  },
  { message: 'Both start and end times are required together.' },
).refine(
  (d) => {
    if (d.startMinutes != null && d.endMinutes != null) return d.startMinutes < d.endMinutes;
    return true;
  },
  { message: 'End time must be after start time.' },
).refine(
  (d) => {
    if (d.startMinutes != null && d.endMinutes != null) {
      if (d.startMinutes + d.durationMinutes > 1440) return false;
    }
    return true;
  },
  { message: 'Entry spans midnight. Split into two entries for each calendar day.' },
);

export async function updateTimeEntryAction(
  input: unknown,
): Promise<ActionResult<{ id: string; updatedAt: string }>> {
  const parsed = updateTimeEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const current = await getTimeEntryForUpdate(supabase, {
    id: parsed.data.id,
    workspaceId: ctx.workspaceId,
  });

  if (!current) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Time entry not found', 'validation'),
    };
  }

  if (current.deletedAt !== null) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Time entry not found', 'validation'),
    };
  }

  if (current.userId !== ctx.userId && ctx.role === 'member') {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'You can only edit your own time entries', 'validation'),
    };
  }

  const isInvoiced = await defaultInvoiceEditGuard.isInvoiced(parsed.data.id);
  if (isInvoiced && !parsed.data.invoicedAcknowledged) {
    return {
      success: false,
      error: createFlowError(409, 'INVOICED_ENTRY_WARNING', 'This time entry has been included in an invoice. Editing it may affect billing accuracy.', 'validation', { invoiced: true }),
    };
  }

  const effectiveClientId = parsed.data.clientId !== null ? parsed.data.clientId : current.clientId;
  if (effectiveClientId) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('id', effectiveClientId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (!clientData) {
      return {
        success: false,
        error: createFlowError(400, 'VALIDATION_ERROR', 'Client does not belong to this workspace', 'validation'),
      };
    }
  }

  const effectiveProjectId = parsed.data.projectId ?? current.projectId;
  if (effectiveProjectId && effectiveClientId) {
    const { data: projData } = await supabase
      .from('projects')
      .select('client_id')
      .eq('id', effectiveProjectId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (!projData || (projData as Record<string, unknown>).client_id !== effectiveClientId) {
      return {
        success: false,
        error: createFlowError(400, 'VALIDATION_ERROR', 'Project does not belong to the selected client', 'validation'),
      };
    }
  }

  const previousValues: Record<string, unknown> = {};
  if (parsed.data.date !== current.date) previousValues.date = current.date;
  if (parsed.data.durationMinutes !== current.durationMinutes) previousValues.durationMinutes = current.durationMinutes;
  if (parsed.data.clientId !== current.clientId) previousValues.clientId = current.clientId;
  if (parsed.data.projectId !== current.projectId) previousValues.projectId = current.projectId;
  if (parsed.data.notes !== current.notes) previousValues.notes = current.notes;
  if (parsed.data.startMinutes !== undefined && parsed.data.startMinutes !== current.startMinutes) previousValues.startMinutes = current.startMinutes;
  if (parsed.data.endMinutes !== undefined && parsed.data.endMinutes !== current.endMinutes) previousValues.endMinutes = current.endMinutes;

  try {
    const updateInput: Parameters<typeof updateTimeEntry>[1] = {
      id: parsed.data.id,
      workspaceId: ctx.workspaceId,
      date: parsed.data.date,
      durationMinutes: parsed.data.durationMinutes,
      clientId: effectiveClientId,
      projectId: effectiveProjectId,
      notes: parsed.data.notes,
      ...(parsed.data.startMinutes !== undefined && { startMinutes: parsed.data.startMinutes }),
      ...(parsed.data.endMinutes !== undefined && { endMinutes: parsed.data.endMinutes }),
    };

    const result = await updateTimeEntry(supabase, updateInput);

    if (Object.keys(previousValues).length > 0) {
      await insertEditHistory(supabase, {
        timeEntryId: parsed.data.id,
        previousValues,
        changedBy: ctx.userId,
      });
    }

    return { success: true, data: { id: result.id, updatedAt: result.updatedAt } };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update time entry', 'system'),
    };
  }
}
