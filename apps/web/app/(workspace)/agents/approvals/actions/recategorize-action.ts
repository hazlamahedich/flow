'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import {
  createFlowError,
  requireTenantContext,
  recategorizeEmail as recategorizeEmailQuery,
  insertSignal,
  recordTrustViolation
} from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

const recategorizeEmailSchema = z.object({
  emailId: z.string().uuid(),
  newCategory: z.enum(['urgent', 'action', 'info', 'noise']),
});

export async function recategorizeEmail(
  input: unknown,
): Promise<ActionResult<{ emailId: string; newCategory: string }>> {
  const parsed = recategorizeEmailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { emailId, newCategory } = parsed.data;
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  // Resolve user once up front
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      success: false,
      error: createFlowError(401, 'UNAUTHORIZED', 'Not authenticated', 'auth'),
    };
  }

  // 1. Fetch current email state
  const { data: email, error: fetchError } = await supabase
    .from('emails')
    .select('category, client_inbox_id')
    .eq('id', emailId)
    .eq('workspace_id', workspaceId)
    .single();

  if (fetchError || !email) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Email not found', 'validation'),
    };
  }

  if (email.category === newCategory) {
    return { success: true, data: { emailId, newCategory } };
  }

  // 2. Update category
  try {
    await recategorizeEmailQuery(supabase, workspaceId, emailId, newCategory);
  } catch (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to recategorize email', 'system'),
    };
  }

  // 3. Write audit log
  const { error: logError } = await supabase.from('recategorization_log').insert({
    email_id: emailId,
    workspace_id: workspaceId,
    client_inbox_id: email.client_inbox_id,
    old_category: email.category,
    new_category: newCategory,
    user_id: user.id,
  });

  if (logError) {
    console.error('[recategorizeEmail] Failed to write recategorization_log:', logError);
  }

  // 4. Emit signal
  await insertSignal({
    workspaceId,
    agentId: 'inbox',
    signalType: 'email.categorization_corrected',
    correlationId: crypto.randomUUID(),
    payload: {
      emailId,
      oldCategory: email.category,
      newCategory,
    },
  });

  // 5. Decrease trust metric (non-blocking)
  try {
    const { data: trustEntry } = await supabase
      .from('trust_matrix')
      .select('version')
      .eq('workspace_id', workspaceId)
      .eq('agent_id', 'inbox')
      .eq('action_type', 'categorize_email')
      .single();

    if (trustEntry) {
      await recordTrustViolation(
        workspaceId,
        'inbox',
        'categorize_email',
        'soft',
        1.0,
        trustEntry.version
      );
    }
  } catch (error) {
    console.error('Failed to record trust violation during recategorization:', error);
  }

  revalidatePath('/agents/approvals');
  return { success: true, data: { emailId, newCategory } };
}
