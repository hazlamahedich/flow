'use server';

import { 
  approveDraftSchema, 
  rejectDraftSchema, 
  editDraftSchema, 
  quickEditToneSchema, 
  quickEditLengthSchema 
} from './schemas';
import type { ActionResult } from '@flow/types';
import { 
  createFlowError, 
  requireTenantContext,
  insertCostLog,
  insertCostEstimate
} from '@flow/db';
import { createLLMRouter } from '@flow/agents';
import { getServerSupabase } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function approveDraft(
  input: unknown,
): Promise<ActionResult<{ draftId: string }>> {
  const parsed = approveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { draftId } = parsed.data;
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  const { error } = await supabase
    .from('draft_responses')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', draftId)
    .eq('workspace_id', workspaceId);

  if (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to approve draft', 'system'),
    };
  }

  revalidatePath('/agents/approvals');
  return { success: true, data: { draftId } };
}

export async function rejectDraft(
  input: unknown,
): Promise<ActionResult<{ draftId: string }>> {
  const parsed = rejectDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { draftId, reason } = parsed.data;
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  const { error } = await supabase
    .from('draft_responses')
    .update({
      status: 'rejected',
      rejection_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)
    .eq('workspace_id', workspaceId);

  if (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to reject draft', 'system'),
    };
  }

  revalidatePath('/agents/approvals');
  return { success: true, data: { draftId } };
}

export async function editDraft(
  input: unknown,
): Promise<ActionResult<{ draftId: string }>> {
  const parsed = editDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { draftId, content } = parsed.data;
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  const { error } = await supabase
    .from('draft_responses')
    .update({ 
      draft_content: content, 
      status: 'edited', 
      updated_at: new Date().toISOString() 
    })
    .eq('id', draftId)
    .eq('workspace_id', workspaceId);

  if (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to edit draft', 'system'),
    };
  }

  revalidatePath('/agents/approvals');
  return { success: true, data: { draftId } };
}

async function performQuickEdit(
  workspaceId: string,
  draftId: string,
  instruction: string,
): Promise<ActionResult<{ draftId: string; content: string }>> {
  const supabase = await getServerSupabase();

  // 1. Fetch current draft
  const { data: draft, error: fetchError } = await supabase
    .from('draft_responses')
    .select('draft_content, email_id')
    .eq('id', draftId)
    .eq('workspace_id', workspaceId)
    .single();

  if (fetchError || !draft) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Draft not found', 'validation'),
    };
  }

  // 2. Fetch email context for better rewrite
  const { data: email } = await supabase
    .from('emails')
    .select('subject, body_clean')
    .eq('id', draft.email_id)
    .eq('workspace_id', workspaceId)
    .single();

  const router = createLLMRouter(undefined, {
    async insertEstimate(entry) {
      const row = await insertCostEstimate(entry);
      return row.id;
    },
    async insertActual(entry) {
      await insertCostLog(entry);
    },
  });

  try {
    const response = await router.complete(
      [
        { 
          role: 'system', 
          content: 'You are an expert executive assistant rewriting a draft email response. Maintain the core meaning but adjust based on the instruction. Output ONLY the new draft content, no explanation.' 
        },
        { 
          role: 'user', 
          content: `Original Email Context:
Subject: ${email?.subject ?? 'No Subject'}
Body: ${email?.body_clean ?? 'No Body'}

Current Draft:
${draft.draft_content}

Instruction: ${instruction}` 
        },
      ],
      { workspaceId, agentId: 'inbox', runId: draftId },
      { taskTier: 'quality' }
    );

    const newContent = response.text.trim();

    // 3. Update draft
    const { error: updateError } = await supabase
      .from('draft_responses')
      .update({ 
        draft_content: newContent, 
        status: 'edited', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', draftId)
      .eq('workspace_id', workspaceId);

    if (updateError) {
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update draft with edit', 'system'),
      };
    }

    revalidatePath('/agents/approvals');
    return { success: true, data: { draftId, content: newContent } };
  } catch (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'AI rewrite failed', 'system'),
    };
  }
}

export async function quickEditTone(
  input: unknown,
): Promise<ActionResult<{ draftId: string; content: string }>> {
  const parsed = quickEditToneSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { draftId, tone } = parsed.data;
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  return performQuickEdit(workspaceId, draftId, `Rewrite this draft to be more ${tone}.`);
}

export async function quickEditLength(
  input: unknown,
): Promise<ActionResult<{ draftId: string; content: string }>> {
  const parsed = quickEditLengthSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { draftId, length } = parsed.data;
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  return performQuickEdit(workspaceId, draftId, `Rewrite this draft to be ${length}.`);
}
