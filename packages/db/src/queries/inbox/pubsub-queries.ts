import type { SupabaseClient } from '@supabase/supabase-js';

export async function insertRawPayload(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    clientInboxId: string;
    emailAddress: string;
    historyId: string;
    rawPayload: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from('raw_pubsub_payloads').insert({
    workspace_id: input.workspaceId,
    client_inbox_id: input.clientInboxId,
    email_address: input.emailAddress,
    history_id: input.historyId,
    raw_payload: input.rawPayload,
  });
  if (error) throw error;
}

export async function isMessageProcessed(
  supabase: SupabaseClient,
  messageId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('processed_pubsub_messages')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function markMessageProcessed(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    messageId: string;
    clientInboxId: string;
  },
): Promise<void> {
  const { error } = await supabase.from('processed_pubsub_messages').insert({
    workspace_id: input.workspaceId,
    message_id: input.messageId,
    client_inbox_id: input.clientInboxId,
  });
  if (error) throw error;
}
