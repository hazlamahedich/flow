import { createServiceClient } from '@flow/db';
import { FLOOD_THRESHOLD } from './schemas/processing';
import { PgBossProducer } from '../orchestrator/pg-boss-producer.js';
import { transitionState } from './state-machine';
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

  return (count ?? 0) > FLOOD_THRESHOLD;
}

import pLimit from 'p-limit';

export async function scheduleDeferredDrafts(
  workspaceId: string,
  boss: PgBoss,
  clientInboxId?: string
): Promise<void> {
  const supabase = createServiceClient();
  const producer = new PgBossProducer(boss);
  const limit = pLimit(10); // Concurrent limits to prevent connection exhaustion

  const PAGE_SIZE = 100;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('email_processing_state')
      .select('email_id')
      .eq('workspace_id', workspaceId)
      .eq('state', 'draft_deferred')
      .range(0, PAGE_SIZE - 1); // Always fetch from start as state transitions remove items from this view

    const { data: deferredItems, error } = await query;

    if (error) {
      console.error(`[inbox] Failed to fetch deferred drafts:`, error);
      break;
    }
    
    if (!deferredItems || deferredItems.length === 0) {
      hasMore = false;
      break;
    }

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
      break;
    }

    const results = await Promise.allSettled(
      emails.map((email) => limit(async () => {
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
        
        await transitionState(email.id, workspaceId, 'draft_pending');
      }))
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`[inbox] ${failures.length} deferred drafts failed in current page:`, failures.map(f => (f as PromiseRejectedResult).reason));
    }
    
    if (deferredItems.length < PAGE_SIZE) {
      hasMore = false;
    }
  }
}
