'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, listProjects } from '@flow/db';

const listProjectsSchema = z.object({
  clientId: z.string().uuid(),
});

export async function listProjectsAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string; clientId: string }[]>> {
  const parsed = listProjectsSchema.safeParse(input);
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

  try {
    const projects = await listProjects(supabase, {
      workspaceId: ctx.workspaceId,
      clientId: parsed.data.clientId,
    });

    return {
      success: true,
      data: projects.map((p) => ({
        id: p.id,
        name: p.name,
        clientId: p.clientId,
      })),
    };
  } catch {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to load projects',
        'system',
      ),
    };
  }
}
