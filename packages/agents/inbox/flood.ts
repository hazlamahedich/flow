import { createServiceClient } from '@flow/db';
import { FLOOD_THRESHOLD } from './schemas/processing';
import { PgBossProducer } from '../orchestrator/pg-boss-producer.js';
import type { PgBoss } from 'pg-boss';

export async function isFloodState(workspaceId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('category', ['urgent', 'action'])
    .gte('received_at', last24h);

  if (error) throw error;

  return (count ?? 0) >= FLOOD_THRESHOLD;
}

export async function scheduleDeferredDrafts(
  workspaceId: string,
  boss: PgBoss,
  clientInboxId?: string
): Promise<void> {
  const supabase = createServiceClient();
  const producer = new PgBossProducer(boss);

  // Find items in 'draft_deferred' state
  let query = supabase
    .from('email_processing_state')
    .select('email_id')
    .eq('workspace_id', workspaceId)
    .eq('state', 'draft_deferred');

  // AC10: Further scope by client_inbox_id if provided for granular isolation
  if (clientInboxId) {
    // Note: client_inbox_id is not in email_processing_state, but we can join
    // or simply filter after fetching if the list is small. 
    // Given our architecture, we'll fetch then filter via the emails table.
  }

  const { data: deferredItems, error } = await query;

  if (error || !deferredItems || deferredItems.length === 0) return;

  // Get email details including client_inbox_id
  const emailIds = deferredItems.map((item) => item.email_id);
  let emailsQuery = supabase
    .from('emails')
    .select('id, client_inbox_id')
    .in('id', emailIds);

  if (clientInboxId) {
    emailsQuery = emailsQuery.eq('client_inbox_id', clientInboxId);
  }

  const { data: emails, error: emailsError } = await emailsQuery;

  if (emailsError || !emails) {
    console.error(`[inbox] Failed to fetch emails for deferred drafts:`, emailsError);
    return;
  }

  // Use Promise.allSettled to ensure one failure doesn't block others (addressed DW-4.4a-D3 partially here)
  await Promise.allSettled(
    emails.map(async (email) => {
      await producer.submit({
        agentId: 'inbox',
        actionType: 'generate_draft',
        input: {
          workspaceId,
          emailId: email.id,
          clientInboxId: email.client_inbox_id,
        },
        idempotencyKey: `draft:${email.id}`,
        correlationId: email.id,
      });
      
      // Update state to draft_pending
      await transitionState(email.id, workspaceId, 'draft_pending');
    })
  );
}
