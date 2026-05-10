'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  getTimerState,
  startTimer,
  stopTimerRpc,
} from '@flow/db';
import type { TimerStateWithNames } from '@flow/db';

const startTimerSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  notes: z.string().max(500).optional(),
});

const stopTimerSchema = z.object({
  timerId: z.string().uuid(),
});

export async function startTimerAction(
  input: unknown,
): Promise<ActionResult<TimerStateWithNames>> {
  const parsed = startTimerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
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
    if (projErr || !proj || (proj as { client_id: string }).client_id !== parsed.data.clientId) {
      return {
        success: false,
        error: createFlowError(400, 'VALIDATION_ERROR', 'Project does not belong to the selected client', 'validation'),
      };
    }
  } else {
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', parsed.data.clientId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (clientErr || !client) {
      return {
        success: false,
        error: createFlowError(400, 'VALIDATION_ERROR', 'Client does not belong to this workspace', 'validation'),
      };
    }
  }

  try {
    const timer = await startTimer(supabase, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      notes: parsed.data.notes ?? null,
    });

    return { success: true, data: timer };
  } catch (err: unknown) {
    const pgError = err as { code?: string };
    if (pgError.code === '23505') {
      return {
        success: false,
        error: createFlowError(409, 'TIMER_ALREADY_RUNNING', 'You already have a running timer', 'validation'),
      };
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to start timer — try again', 'system'),
    };
  }
}

export async function stopTimerAction(
  input: unknown,
): Promise<ActionResult<{ timeEntryId: string; durationMinutes: number }>> {
  const parsed = stopTimerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  try {
    const result = await stopTimerRpc(supabase, {
      timerId: parsed.data.timerId,
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const rpcError = err as { code?: string };
    if (rpcError.code === 'TIMER_NOT_FOUND') {
      return {
        success: false,
        error: createFlowError(404, 'TIMER_NOT_FOUND', 'No active timer found', 'validation'),
      };
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to stop timer — try again', 'system'),
    };
  }
}

export async function getTimerStateAction(): Promise<
  ActionResult<TimerStateWithNames | null>
> {
  const supabase = await getServerSupabase();

  let ctx: { workspaceId: string; userId: string };
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    // No authenticated session — return null without treating it as an error
    return { success: true, data: null };
  }

  const timerState = await getTimerState(supabase, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
  });
  return { success: true, data: timerState };
}
