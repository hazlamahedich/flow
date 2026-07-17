import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const timerStateRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    user_id: z.string(),
    client_id: z.string(),
    project_id: z.string().nullable(),
    notes: z.string().nullable(),
    started_at: z.string(),
    updated_at: z.string(),
    clients: z.union([z.object({ name: z.string() }), z.null()]).nullable(),
    projects: z.union([z.object({ name: z.string() }), z.null()]).nullable(),
  })
  .passthrough();

export interface TimerStateWithNames {
  id: string;
  workspaceId: string;
  userId: string;
  clientId: string;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  notes: string | null;
  startedAt: string;
  updatedAt: string;
}

function mapTimerStateRow(row: Record<string, unknown>): TimerStateWithNames {
  const parsed = timerStateRowSchema.parse(row);
  const clients = parsed.clients as { name: string } | null | undefined;
  const projects = parsed.projects as { name: string } | null | undefined;
  return {
    id: parsed.id,
    workspaceId: parsed.workspace_id,
    userId: parsed.user_id,
    clientId: parsed.client_id,
    clientName: clients?.name ?? null,
    projectId: parsed.project_id,
    projectName: projects?.name ?? null,
    notes: parsed.notes,
    startedAt: parsed.started_at,
    updatedAt: parsed.updated_at,
  };
}

export interface GetTimerStateInput {
  workspaceId: string;
  userId: string;
}

export async function getTimerState(
  supabase: SupabaseClient,
  input: GetTimerStateInput,
): Promise<TimerStateWithNames | null> {
  const { data, error } = await supabase
    .from('timer_state')
    .select('*, clients(name), projects(name)')
    .eq('workspace_id', input.workspaceId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapTimerStateRow(data as Record<string, unknown>);
}

export interface StartTimerInput {
  workspaceId: string;
  userId: string;
  clientId: string;
  projectId: string | null;
  notes?: string | null;
}

export async function startTimer(
  supabase: SupabaseClient,
  input: StartTimerInput,
): Promise<TimerStateWithNames> {
  const { data, error } = await supabase
    .from('timer_state')
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      client_id: input.clientId,
      project_id: input.projectId ?? null,
      notes: input.notes ?? null,
    })
    .select('*, clients(name), projects(name)')
    .single();

  if (error) throw error;
  return mapTimerStateRow(data as Record<string, unknown>);
}

export interface StopTimerRpcInput {
  timerId: string;
  workspaceId: string;
  userId: string;
}

export interface StopTimerResult {
  timeEntryId: string;
  durationMinutes: number;
}

const stopTimerErrorSchema = z.object({ error: z.string() });
const stopTimerSuccessSchema = z.object({
  timeEntryId: z.string(),
  durationMinutes: z.number(),
});

export async function stopTimerRpc(
  supabase: SupabaseClient,
  input: StopTimerRpcInput,
): Promise<StopTimerResult> {
  const { data, error } = await supabase.rpc('stop_timer', {
    p_timer_id: input.timerId,
    p_workspace_id: input.workspaceId,
    p_user_id: input.userId,
  });

  if (error) throw error;

  const errorParse = stopTimerErrorSchema.safeParse(data);
  if (errorParse.success && errorParse.data.error === 'TIMER_NOT_FOUND') {
    throw Object.assign(new Error('TIMER_NOT_FOUND'), {
      code: 'TIMER_NOT_FOUND',
    });
  }

  const successParse = stopTimerSuccessSchema.safeParse(data);
  if (!successParse.success) {
    throw new Error(
      `Unexpected stop_timer RPC response: ${JSON.stringify(data)}`,
    );
  }

  return successParse.data;
}
