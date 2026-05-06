import { GmailProvider } from '../providers/index.js';
import type { OAuthTokens } from '@flow/types';
import { decryptInboxTokens, encryptInboxTokens } from '@flow/db/vault/inbox-tokens';
import { createServiceClient } from '@flow/db';
import type { SupabaseClient } from '@supabase/supabase-js';

interface InitialSyncInput {
  clientInboxId: string;
  historyId: string;
}

interface InboxWithState {
  id: string;
  workspace_id: string;
  client_id: string;
  provider: string;
  email_address: string;
  access_type: string;
  oauth_state: Record<string, unknown>;
  sync_status: string;
  sync_cursor: string | null;
  error_message: string | null;
  last_sync_at: string | null;
  updated_at: string | null;
}

async function getInboxWithState(
  supabase: SupabaseClient,
  inboxId: string,
): Promise<InboxWithState | null> {
  const { data, error } = await supabase
    .from('client_inboxes')
    .select('*')
    .eq('id', inboxId)
    .maybeSingle();
  if (error) throw error;
  return data as InboxWithState | null;
}

export async function executeInitialSync(input: InitialSyncInput): Promise<void> {
  const supabase = createServiceClient();
  const provider = new GmailProvider();

  const inbox = await getInboxWithState(supabase, input.clientInboxId);
  if (!inbox || inbox.sync_status === 'disconnected') {
    return;
  }

  await supabase
    .from('client_inboxes')
    .update({ sync_status: 'syncing' })
    .eq('id', inbox.id);

  try {
    let tokens: OAuthTokens;
    try {
      tokens = decryptInboxTokens(inbox.oauth_state as { encrypted: string; iv: string; version: number });
    } catch {
      await supabase
        .from('client_inboxes')
        .update({ sync_status: 'error', error_message: 'Token decryption failed' })
        .eq('id', inbox.id);
      return;
    }

    let accessToken = tokens.accessToken;
    if (Date.now() >= tokens.expiryDate) {
      const refreshed = await provider.refreshToken(tokens.refreshToken);
      accessToken = refreshed.accessToken;
      const newEncrypted = encryptInboxTokens(refreshed);
      const { error: updateError } = await supabase
        .from('client_inboxes')
        .update({ oauth_state: newEncrypted as unknown as Record<string, unknown> })
        .eq('id', inbox.id)
        .eq('updated_at', inbox.updated_at ?? '');
      if (updateError) {
        const refreshedInbox = await getInboxWithState(supabase, inbox.id);
        if (refreshedInbox?.oauth_state && typeof refreshedInbox.oauth_state === 'object' && 'encrypted' in refreshedInbox.oauth_state) {
          const currentTokens = decryptInboxTokens(refreshedInbox.oauth_state as { encrypted: string; iv: string; version: number });
          accessToken = currentTokens.accessToken;
        }
      }
    }

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    const messageItems = await provider.listMessages(
      accessToken,
      `after:${thirtyDaysAgo}`,
      500,
    );

    for (const item of messageItems) {
      try {
        const metadata = await provider.getMessageMetadata(accessToken, item.messageId);
        await insertEmailMetadata(supabase, {
          workspaceId: inbox.workspace_id,
          clientInboxId: inbox.id,
          clientId: inbox.client_id,
          metadata,
        });
      } catch {
        // Continue on individual message failures
      }
    }

    const profile = await provider.getProfile(accessToken);
    const topicName =
      process.env.GMAIL_PUBSUB_TOPIC ??
      `projects/${process.env.GOOGLE_CLOUD_PROJECT ?? 'flow-os'}/topics/gmail-push`;

    try {
      await provider.watchInbox(accessToken, topicName);
    } catch {
      // Watch registration best-effort
    }

    await supabase
      .from('client_inboxes')
      .update({
        sync_status: 'connected',
        sync_cursor: profile.historyId,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', inbox.id);
  } catch (err: unknown) {
    await supabase
      .from('client_inboxes')
      .update({
        sync_status: 'error',
        error_message: err instanceof Error ? err.message : 'Initial sync failed',
      })
      .eq('id', inbox.id);
  }
}

async function insertEmailMetadata(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    clientInboxId: string;
    clientId: string;
    metadata: {
      gmailMessageId: string;
      gmailThreadId: string;
      subject: string | null;
      fromAddress: string;
      fromName: string | null;
      toAddresses: Array<{ name: string | null; address: string }>;
      ccAddresses: Array<{ name: string | null; address: string }>;
      receivedAt: string;
      headers: Array<{ name: string; value: string }>;
    };
  },
): Promise<void> {
  const { error } = await supabase.from('emails').insert({
    workspace_id: input.workspaceId,
    client_inbox_id: input.clientInboxId,
    client_id: input.clientId,
    gmail_message_id: input.metadata.gmailMessageId,
    gmail_thread_id: input.metadata.gmailThreadId,
    subject: input.metadata.subject,
    from_address: input.metadata.fromAddress,
    from_name: input.metadata.fromName,
    to_addresses: input.metadata.toAddresses,
    cc_addresses: input.metadata.ccAddresses,
    received_at: input.metadata.receivedAt,
    headers: input.metadata.headers,
  });

  if (error && error.code !== '23505') throw error;
}
