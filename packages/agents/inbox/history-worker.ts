import { createServiceClient, insertEmail, insertSignal, updateClientInboxSyncStatus, updateClientInboxOAuthState, decryptInboxTokens, encryptInboxTokens, isMessageProcessed } from '@flow/db';
import type { PgBoss } from 'pg-boss';
import { PgBossProducer } from '../orchestrator/pg-boss-producer.js';
import { GmailProvider } from '../providers/index.js';
import { sanitizeEmail } from './sanitizer.js';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

const inboxLocks = new Map<string, Promise<void>>();

function acquireInboxLock(inboxId: string): () => void {
  let release: () => void;
  const prev = inboxLocks.get(inboxId) ?? Promise.resolve();
  const next = prev.then(() => new Promise<void>((resolve) => { release = resolve; }));
  inboxLocks.set(inboxId, next);
  void next.finally(() => {
    if (inboxLocks.get(inboxId) === next) inboxLocks.delete(inboxId);
  });
  return () => release!();
}

export async function startHistoryWorker(boss: PgBoss) {
  const supabase = createServiceClient();
  const producer = new PgBossProducer(boss);

  supabase
    .channel('history-worker')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'raw_pubsub_payloads' },
      async (payload: RealtimePostgresInsertPayload<{ id: string; workspace_id: string; client_inbox_id: string }>) => {
        const { id, workspace_id, client_inbox_id } = payload.new;

        await producer.submit({
          agentId: 'inbox',
          actionType: 'email_processing',
          input: {
            workspace_id,
            payloadId: id,
            clientInboxId: client_inbox_id,
          },
          idempotencyKey: `drain:${id}`,
          correlationId: id,
        });
      },
    )
    .subscribe();
}

export async function handleDrainHistory(input: {
  workspace_id: string;
  payloadId: string;
  clientInboxId: string;
}, boss?: PgBoss) {
  const supabase = createServiceClient();
  const provider = new GmailProvider();
  const release = acquireInboxLock(input.clientInboxId);

  try {
    const { data: inbox, error: inboxError } = await supabase
      .from('client_inboxes')
      .select('*')
      .eq('id', input.clientInboxId)
      .single();

    if (inboxError || !inbox) {
      throw new Error(`Inbox not found: ${input.clientInboxId}`);
    }

    let tokens = decryptInboxTokens(inbox.oauth_state as Record<string, unknown>);
    let accessToken = tokens.accessToken;

    const expiry = typeof tokens.expiryDate === 'number' ? tokens.expiryDate : 0;
    if (Date.now() >= expiry) {
      const refreshed = await provider.refreshToken(tokens.refreshToken);
      accessToken = refreshed.accessToken;
      const encrypted = encryptInboxTokens(refreshed);
      await updateClientInboxOAuthState(supabase, inbox.id, inbox.workspace_id, encrypted as Record<string, unknown>);
      tokens = refreshed;
    }

    const syncCursor = inbox.sync_cursor ?? '0';
    const historyItems = await provider.getHistorySince(accessToken, syncCursor);

    const bossInstance = boss ?? await (globalThis as Record<string, unknown>).getBoss?.() as PgBoss;
    if (!bossInstance) throw new Error('PgBoss instance not available');
    const producer = new PgBossProducer(bossInstance);

    for (const item of historyItems) {
      try {
        const alreadyProcessed = await isMessageProcessed(item.messageId);
        if (alreadyProcessed) continue;

        const message = await provider.getMessage(accessToken, item.messageId);
        const { cleanText, safeHtml } = sanitizeEmail(message.bodyHtml || '', message.bodyText ?? undefined);
        const emailId = crypto.randomUUID();
        await insertEmail(supabase, {
          id: emailId,
          workspace_id: input.workspace_id,
          client_inbox_id: inbox.id,
          client_id: inbox.client_id,
          gmail_message_id: message.gmailMessageId,
          gmail_thread_id: message.gmailThreadId,
          subject: message.subject,
          from_address: message.fromAddress,
          from_name: message.fromName,
          to_addresses: message.toAddresses,
          cc_addresses: message.ccAddresses,
          received_at: message.receivedAt,
          headers: message.headers,
          body_clean: cleanText,
          body_raw_safe: safeHtml,
        });

        await insertSignal({
          workspaceId: input.workspace_id,
          agentId: 'inbox',
          signalType: 'email.received',
          correlationId: emailId,
          clientId: inbox.client_id,
          payload: {
            email_id: emailId,
            subject: message.subject,
            from_address: message.fromAddress,
          },
        });

        await producer.submit({
          agentId: 'inbox',
          actionType: 'email_categorization',
          input: {
            workspace_id: input.workspace_id,
            emailId: emailId,
          },
          clientId: inbox.client_id,
          idempotencyKey: `categorize:${emailId}`,
          correlationId: emailId,
        });
      } catch (err) {
        console.error(`[inbox] Failed to process message ${item.messageId}:`, err);
      }
    }

    const { data: rawPayload } = await supabase
      .from('raw_pubsub_payloads')
      .select('history_id')
      .eq('id', input.payloadId)
      .single();

    const newCursor = rawPayload?.history_id ?? String(Date.now());
    await updateClientInboxSyncStatus(supabase, inbox.id, inbox.workspace_id, 'connected', {
      syncCursor: newCursor,
      lastSyncAt: new Date().toISOString(),
    });

    await supabase
      .from('raw_pubsub_payloads')
      .update({ processed: true })
      .eq('id', input.payloadId);
  } finally {
    release();
  }
}
