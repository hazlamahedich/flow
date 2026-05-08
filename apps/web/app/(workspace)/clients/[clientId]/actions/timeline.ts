'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  recategorizeEmail as recategorizeEmailQuery,
  updateRunStatus,
  getClientEngagementTimeline
} from '@flow/db';
import type { ActionResult, AgentRunStatus, TimelineEvent } from '@flow/types';
import { z } from 'zod';

const recategorizeTimelineEmailSchema = z.object({
  emailId: z.string().uuid(),
  category: z.enum(['urgent', 'action', 'info', 'noise']),
  clientId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export async function recategorizeTimelineEmail(
  input: unknown,
): Promise<ActionResult<{ emailId: string; category: string }>> {
  const parsed = recategorizeTimelineEmailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid input.', 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (parsed.data.workspaceId !== ctx.workspaceId) {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'Workspace mismatch.', 'auth'),
    };
  }

  try {
    // Cross-client safety guard (AC5)
    const { data: email, error: fetchError } = await supabase
      .from('emails')
      .select('workspace_id, client_id, requires_confirmation')
      .eq('id', parsed.data.emailId)
      .single();

    if (fetchError || !email) {
      return {
        success: false,
        error: createFlowError(404, 'NOT_FOUND', 'Email not found.', 'validation'),
      };
    }

    if (email.workspace_id !== ctx.workspaceId || email.client_id !== parsed.data.clientId) {
      return {
        success: false,
        error: createFlowError(403, 'FORBIDDEN', 'Unauthorized.', 'auth'),
      };
    }

    if (!email.requires_confirmation) {
      return {
        success: false,
        error: createFlowError(409, 'CONFLICT', 'Email has already been triaged.', 'validation'),
      };
    }

    await recategorizeEmailQuery(supabase, ctx.workspaceId, parsed.data.emailId, parsed.data.category);

    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    return { success: true, data: { emailId: parsed.data.emailId, category: parsed.data.category } };
  } catch (error) {
    console.error('Failed to recategorize email', error);
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to recategorize email.', 'system'),
    };
  }
}

const updateTimelineAgentProposalSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(['completed', 'failed', 'cancelled', 'pending_approval']),
  workspaceId: z.string().uuid(),
});

export async function updateTimelineAgentProposal(
  input: unknown,
): Promise<ActionResult<{ runId: string; status: string }>> {
  const parsed = updateTimelineAgentProposalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid input.', 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (parsed.data.workspaceId !== ctx.workspaceId) {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'Workspace mismatch.', 'auth'),
    };
  }

  try {
    // D1: Verify run belongs to this workspace before mutating
    const { data: run, error: runError } = await supabase
      .from('agent_runs')
      .select('workspace_id')
      .eq('id', parsed.data.runId)
      .single();

    if (runError || !run) {
      return {
        success: false,
        error: createFlowError(404, 'NOT_FOUND', 'Agent run not found.', 'validation'),
      };
    }

    if (run.workspace_id !== ctx.workspaceId) {
      return {
        success: false,
        error: createFlowError(403, 'FORBIDDEN', 'Unauthorized.', 'auth'),
      };
    }

    await updateRunStatus(parsed.data.runId, parsed.data.status as AgentRunStatus,
      parsed.data.status === 'completed' ? { completedAt: new Date().toISOString() } : {});

    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    return { success: true, data: { runId: parsed.data.runId, status: parsed.data.status } };
  } catch (error) {
    console.error('Failed to update agent proposal', error);
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update agent proposal.', 'system'),
    };
  }
}

const getTimelineSchema = z.object({
  clientId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  eventType: z.enum(['all', 'emails', 'agent_runs']).optional().default('all'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  cursor: z.string().nullable().optional(),
  limit: z.number().int().positive().optional(),
});

export async function getTimeline(
  input: unknown,
): Promise<ActionResult<{ events: TimelineEvent[]; nextCursor: string | null; hasMore: boolean }>> {
  const parsed = getTimelineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid input.', 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (parsed.data.workspaceId !== ctx.workspaceId) {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'Workspace mismatch.', 'auth'),
    };
  }

  // U1: Verify clientId belongs to this workspace
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', parsed.data.clientId)
    .eq('workspace_id', ctx.workspaceId)
    .single();

  if (!client) {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'Client not found in workspace.', 'auth'),
    };
  }

  try {
    // Z1: Clamp limit to prevent oversized queries
    const clampedLimit = Math.min(parsed.data.limit ?? 50, 100);
    const result = await getClientEngagementTimeline(supabase, {
      workspaceId: parsed.data.workspaceId,
      clientId: parsed.data.clientId,
      eventType: parsed.data.eventType,
      ...(parsed.data.dateFrom ? { dateFrom: parsed.data.dateFrom } : {}),
      ...(parsed.data.dateTo ? { dateTo: parsed.data.dateTo } : {}),
      ...(parsed.data.cursor != null ? { cursor: parsed.data.cursor } : {}),
      limit: clampedLimit,
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch timeline', error);
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to fetch timeline.', 'system'),
    };
  }
}
