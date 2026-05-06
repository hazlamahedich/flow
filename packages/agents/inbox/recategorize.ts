import { createServiceClient } from '@flow/db';
import { transitionState } from './state-machine';
import { recordRecategorizationMetric } from './trust';
import { EmailCategory } from './schemas';
import { PgBossProducer } from '../orchestrator/pg-boss-producer.js';
import type { PgBoss } from 'pg-boss';

export async function handleRecategorization(
  emailId: string,
  workspaceId: string,
  oldCategory: EmailCategory,
  newCategory: EmailCategory,
  userId: string,
  boss?: PgBoss
) {
  const supabase = createServiceClient();

  // Get client_inbox_id for subsequent steps
  const { data: emailInfo } = await supabase
    .from('emails')
    .select('client_inbox_id')
    .eq('id', emailId)
    .single();

  if (!emailInfo) throw new Error(`Email not found: ${emailId}`);

  // 1. Log to recategorization_log
  const { error: logError } = await supabase.from('recategorization_log').insert({
    email_id: emailId,
    workspace_id: workspaceId,
    client_inbox_id: emailInfo.client_inbox_id,
    old_category: oldCategory,
    new_category: newCategory,
    user_id: userId,
  });

  if (logError) throw logError;

  const isOldActionable = ['urgent', 'action'].includes(oldCategory);
  const isNewActionable = ['urgent', 'action'].includes(newCategory);

  // 2. Actionable -> Non-actionable: soft-deletes extractions, cancels pending drafts, state -> extraction_skipped
  if (isOldActionable && !isNewActionable) {
    // Soft-delete extracted_actions
    await supabase
      .from('extracted_actions')
      .update({ soft_deleted: true })
      .eq('email_id', emailId);

    // Cancel pending drafts by marking them as superseded
    await supabase
      .from('draft_responses')
      .update({ status: 'superseded' })
      .eq('email_id', emailId)
      .eq('status', 'pending');

    await transitionState(emailId, workspaceId, 'extraction_skipped');
  }

  // 3. Non-actionable -> Actionable: enqueues extraction job, state -> extraction_pending
  if (!isOldActionable && isNewActionable) {
    if (boss) {
      const producer = new PgBossProducer(boss);
      await producer.submit({
        agentId: 'inbox',
        actionType: 'extract_actions',
        input: {
          workspaceId,
          emailId,
          clientInboxId: emailInfo.client_inbox_id,
        },
        idempotencyKey: `extract:${emailId}:${Date.now()}`,
        correlationId: emailId,
      });

      await transitionState(emailId, workspaceId, 'extraction_pending');
    } else {
      console.error(`[inbox] PgBoss not available during recategorization — extraction job NOT enqueued for email ${emailId}.`);
      throw new Error('PgBoss unavailable for recategorization pipeline activation');
    }
  }

  // 4. Recompute trust metric
  await recordRecategorizationMetric(workspaceId, emailInfo.client_inbox_id);
}
