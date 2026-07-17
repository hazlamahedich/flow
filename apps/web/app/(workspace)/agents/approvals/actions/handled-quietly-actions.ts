'use server';

import {
  getHandledEmailsSchema,
  promoteToInboxSchema,
  reviewAllSchema,
} from './schemas';
import type { ActionResult } from '@flow/types';
import {
  createFlowError,
  requireTenantContext,
  getHandledEmails as getHandledEmailsQuery,
  getWeeklyAuditCount as getWeeklyAuditCountQuery,
  recordTrustViolation,
} from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function getHandledEmails(
  input: unknown,
): Promise<ActionResult<{ items: any[]; totalCount: number }>> {
  const parsed = getHandledEmailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        'validation',
      ),
    };
  }

  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  try {
    const result = await getHandledEmailsQuery(
      supabase,
      workspaceId,
      parsed.data,
    );
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to fetch handled emails',
        'system',
      ),
    };
  }
}

export async function promoteToInbox(
  input: unknown,
): Promise<ActionResult<{ emailId: string }>> {
  const parsed = promoteToInboxSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        'validation',
      ),
    };
  }

  const { emailId } = parsed.data;
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  // Resolve user once up front to avoid a second round-trip and null race
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      success: false,
      error: createFlowError(401, 'UNAUTHORIZED', 'Not authenticated', 'auth'),
    };
  }

  // 1. Fetch current category for audit log
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

  // 2. Promote to inbox
  const { error: updateError } = await supabase
    .from('emails')
    .update({
      category: 'action',
      requires_confirmation: true,
      processed_at: new Date().toISOString(),
    })
    .eq('id', emailId)
    .eq('workspace_id', workspaceId);

  if (updateError) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to promote email',
        'system',
      ),
    };
  }

  // 3. Log recategorization — errors here must not silently crash the action
  const { error: logError } = await supabase
    .from('recategorization_log')
    .insert({
      email_id: emailId,
      workspace_id: workspaceId,
      client_inbox_id: email.client_inbox_id,
      old_category: email.category,
      new_category: 'action',
      user_id: user.id,
    });

  if (logError) {
    console.error(
      '[promoteToInbox] Failed to write recategorization_log:',
      logError,
    );
    // Non-fatal: audit log failure does not roll back the promotion
  }

  // 4. Decrease trust metric (non-blocking)
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
        0.5,
        trustEntry.version,
      );
    }
  } catch (error) {
    console.error('Failed to record trust violation during promotion:', error);
  }

  revalidatePath('/agents/approvals');

  return {
    success: true,
    data: { emailId },
  };
}

export async function reviewAll(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const parsed = reviewAllSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        'validation',
      ),
    };
  }

  const { emailIds } = parsed.data;
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  // Mark emails as acknowledged by VA (requires_confirmation = false signals reviewed)
  // Category guard prevents clearing requires_confirmation on urgent/action emails
  const { error } = await supabase
    .from('emails')
    .update({ requires_confirmation: false })
    .in('id', emailIds)
    .eq('workspace_id', workspaceId)
    .in('category', ['info', 'noise']);

  if (error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to mark emails as reviewed',
        'system',
      ),
    };
  }

  revalidatePath('/agents/approvals');

  return {
    success: true,
    data: { count: emailIds.length },
  };
}

export async function getWeeklyAuditCount(): Promise<
  ActionResult<{ count: number }>
> {
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  try {
    const count = await getWeeklyAuditCountQuery(supabase, workspaceId);
    return {
      success: true,
      data: { count },
    };
  } catch (error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to fetch weekly audit count',
        'system',
      ),
    };
  }
}
