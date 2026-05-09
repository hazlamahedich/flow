'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, listTimeEntries } from '@flow/db';
import type { TimeEntryFilters } from '@flow/db';

const filterSchema = z.object({
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  userId: z.string().uuid().optional(),
  page: z.number().int().min(1).optional(),
});

export async function listTimeEntriesAction(
  input: unknown,
): Promise<ActionResult<{ items: unknown[]; total: number; page: number; hasNextPage: boolean }>> {
  const parsed = filterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  try {
    const filters: TimeEntryFilters = {};
    if (parsed.data.clientId) filters.clientId = parsed.data.clientId;
    if (parsed.data.projectId) filters.projectId = parsed.data.projectId;
    if (parsed.data.dateFrom) filters.dateFrom = parsed.data.dateFrom;
    if (parsed.data.dateTo) filters.dateTo = parsed.data.dateTo;
    if (parsed.data.userId) filters.userId = parsed.data.userId;

    const result = await listTimeEntries(supabase, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      role: ctx.role,
      filters,
      page: parsed.data.page ?? 1,
    });

    return { success: true, data: result };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to load time entries', 'system'),
    };
  }
}
