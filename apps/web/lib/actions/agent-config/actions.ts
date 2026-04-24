'use server';

import { requireTenantContext, updateAgentConfig } from '@flow/db';
import { beginDrain } from '@flow/agents';
import { revalidateTag } from 'next/cache';
import type { ActionResult } from '@flow/types';
import {
  activateAgentSchema,
  deactivateAgentSchema,
  updateAgentScheduleSchema,
  updateAgentTriggerConfigSchema,
} from './schema';
import { activateWithChecks, listConfigurations } from './queries';

async function getWorkspaceId(): Promise<string> {
  const { createServerClient } = await import('@flow/db');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const client = createServerClient({
    getAll: () => cookieStore.getAll().map((c: { name: string; value: string }) => ({ name: c.name, value: c.value })),
    set: () => {},
  });
  const ctx = await requireTenantContext(client);
  return ctx.workspaceId;
}

export async function activateAgent(input: unknown): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = activateAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', category: 'validation' } };
  }

  const workspaceId = await getWorkspaceId();
  const result = await activateWithChecks(workspaceId, parsed.data.agentId, parsed.data.expectedVersion);

  if (result.success) {
    revalidateTag('agents:' + workspaceId);
    return { success: true, data: result.data as unknown as Record<string, unknown> };
  }
  return result;
}

export async function deactivateAgent(input: unknown): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = deactivateAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', category: 'validation' } };
  }

  const workspaceId = await getWorkspaceId();
  const result = await beginDrain(workspaceId, parsed.data.agentId, parsed.data.expectedVersion);
  revalidateTag('agents:' + workspaceId);
  return { success: true, data: result as unknown as Record<string, unknown> };
}

export async function updateAgentSchedule(input: unknown): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = updateAgentScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', category: 'validation' } };
  }

  const workspaceId = await getWorkspaceId();
  const result = await updateAgentConfig(
    workspaceId,
    parsed.data.agentId,
    { schedule: parsed.data.schedule },
    parsed.data.expectedVersion,
  );
  revalidateTag('agents:' + workspaceId);
  return { success: true, data: result as unknown as Record<string, unknown> };
}

export async function updateAgentTriggerConfig(input: unknown): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = updateAgentTriggerConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', category: 'validation' } };
  }

  const workspaceId = await getWorkspaceId();
  const result = await updateAgentConfig(
    workspaceId,
    parsed.data.agentId,
    { triggerConfig: parsed.data.triggerConfig },
    parsed.data.expectedVersion,
  );
  revalidateTag('agents:' + workspaceId);
  return { success: true, data: result as unknown as Record<string, unknown> };
}

export async function getAgentConfigurationsAction(): Promise<ActionResult<Record<string, unknown>[]>> {
  const { createServerClient } = await import('@flow/db');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const client = createServerClient({
    getAll: () => cookieStore.getAll().map((c: { name: string; value: string }) => ({ name: c.name, value: c.value })),
    set: () => {},
  });
  const { workspaceId } = await (await import('@flow/db')).requireTenantContext(client);
  const configs = await listConfigurations(client, workspaceId);
  return { success: true, data: configs as unknown as Record<string, unknown>[] };
}
