'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  getClientInboxById,
  clearClientInboxTokens,
  cacheTag,
} from '@flow/db';
import { GmailProvider } from '@flow/agents/providers';
import { decryptInboxTokens } from '@flow/db/vault/inbox-tokens';
import { z } from 'zod';
import type { ActionResult } from '@flow/types';

const disconnectSchema = z.object({
  inboxId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export async function disconnectInbox(
  input: unknown,
): Promise<ActionResult<{ success: boolean }>> {
  const parsed = disconnectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid input.', 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role === 'member') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Members cannot disconnect inboxes.', 'auth'),
    };
  }

  const inbox = await getClientInboxById(supabase, parsed.data.inboxId, ctx.workspaceId);
  if (!inbox) {
    return {
      success: false,
      error: createFlowError(404, 'INBOX_NOT_FOUND', 'Inbox not found.', 'validation'),
    };
  }

  if (inbox.clientId !== parsed.data.clientId) {
    return {
      success: false,
      error: createFlowError(403, 'TENANT_MISMATCH', 'Inbox does not belong to this client.', 'auth'),
    };
  }

  try {
    const provider = new GmailProvider();

    const { data: rawRow } = await supabase
      .from('client_inboxes')
      .select('oauth_state')
      .eq('id', parsed.data.inboxId)
      .single();

    if (rawRow?.oauth_state && typeof rawRow.oauth_state === 'object' && 'encrypted' in rawRow.oauth_state) {
      try {
        const tokens = decryptInboxTokens(rawRow.oauth_state as { encrypted: string; iv: string; version: number });
        try {
          await provider.stopWatch(tokens.accessToken);
        } catch {
          // stopWatch best-effort
        }
        await provider.revokeToken(tokens.accessToken);
      } catch {
        // Token operations best-effort
      }
    }

    await clearClientInboxTokens(supabase, parsed.data.inboxId, ctx.workspaceId);

    try {
      const { data: queuedRuns } = await supabase
        .from('agent_runs')
        .select('id')
        .eq('status', 'queued')
        .eq('workspace_id', ctx.workspaceId);

      if (queuedRuns && queuedRuns.length > 0) {
        for (const run of queuedRuns) {
          await supabase
            .from('agent_runs')
            .update({ status: 'cancelled' })
            .eq('id', run.id);
        }
      }
    } catch {
      // Agent run cancellation best-effort
    }

    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));

    return { success: true, data: { success: true } };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INBOX_CONNECTION_FAILED', 'Failed to disconnect inbox.', 'system'),
    };
  }
}
