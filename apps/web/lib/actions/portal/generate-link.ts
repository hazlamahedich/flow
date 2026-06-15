/**
 * Workspace-side Server Action: generate a time-limited client portal link.
 *
 * Story 9.1a — AC1, FR8, FR51.
 */
'use server';

import { randomBytes } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
} from '@flow/db';
import type { ActionResult, FlowError } from '@flow/types';
import type { TenantContext } from '@flow/db';
import {
  PORTAL_TOKEN_BYTES,
  PORTAL_TOKEN_TTL_HOURS,
  PORTAL_LINK_RATE_LIMIT_PER_HOUR,
} from './constants';
import { generatePortalLinkSchema } from './schemas';
import {
  buildPortalRedeemUrl,
  encodeBase64Url,
  failure,
  hashPortalToken,
  isRateLimited,
  createRateLimitError,
} from './helpers';

interface ClientRow {
  status: string;
  email?: string | null;
}

export async function generatePortalLinkAction(
  input: unknown,
): Promise<ActionResult<{ url: string; tokenId: string }>> {
  const parsed = generatePortalLinkSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation', {
        issues: parsed.error.issues,
      }),
    );
  }

  const supabase = await getServerSupabase();

  const ctx = await requireWorkspaceOwnerOrAdmin(supabase);
  if (!ctx.success) {
    return ctx;
  }

  const client = await loadActiveClient(supabase, parsed.data.clientId, ctx.data.workspaceId);
  if (!client.success) {
    return client;
  }

  const rateCheck = await checkLinkRateLimit(supabase, client.data, parsed.data.clientId);
  if (!rateCheck.success) {
    return rateCheck;
  }

  const tokenResult = await persistPortalToken(
    supabase,
    parsed.data.clientId,
    ctx.data.workspaceId,
    ctx.data.userId,
    parsed.data.ttlHours,
  );
  if (!tokenResult.success) {
    return tokenResult;
  }

  const url = await buildMagicLinkUrl(supabase, ctx.data.workspaceId, tokenResult.data.plaintextToken);

  revalidateTag(cacheTag('portal_token', ctx.data.workspaceId));

  return {
    success: true,
    data: { url, tokenId: tokenResult.data.tokenId },
  };
}

async function requireWorkspaceOwnerOrAdmin(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
): Promise<ActionResult<TenantContext>> {
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch (err) {
    const error = err as FlowError;
    return failure(error);
  }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return failure(
      createFlowError(
        403,
        'INSUFFICIENT_ROLE',
        'Only owners and admins can generate portal links.',
        'auth',
      ),
    );
  }

  return { success: true, data: ctx };
}

async function loadActiveClient(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  clientId: string,
  workspaceId: string,
): Promise<ActionResult<ClientRow>> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, workspace_id, status, email')
    .eq('id', clientId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error || !data) {
    return failure(
      createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found.', 'validation'),
    );
  }

  const clientRow = data as ClientRow;
  if (clientRow.status === 'archived') {
    return failure(
      createFlowError(
        400,
        'CLIENT_ARCHIVED',
        'Cannot generate portal links for archived clients.',
        'validation',
      ),
    );
  }

  return { success: true, data: clientRow };
}

async function checkLinkRateLimit(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  client: ClientRow,
  clientId: string,
): Promise<ActionResult<void>> {
  const clientEmail = client.email ?? 'no-email';
  const rateLimitId = `portal_link:${clientEmail}:${clientId}`;
  const { data: rlResult } = await supabase.rpc('check_rate_limit', {
    p_identifier: rateLimitId,
    p_action: 'portal_link_generate',
    p_max_requests: PORTAL_LINK_RATE_LIMIT_PER_HOUR,
    p_window_seconds: 60 * 60,
    p_min_interval_seconds: 0,
  });

  const rateCheck = isRateLimited(rlResult);
  if (rateCheck.limited) {
    return failure(createRateLimitError(rateCheck.retryAfterMs));
  }

  return { success: true, data: undefined };
}

interface PersistedToken {
  plaintextToken: string;
  tokenId: string;
}

async function persistPortalToken(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  clientId: string,
  workspaceId: string,
  userId: string,
  ttlHours?: number,
): Promise<ActionResult<PersistedToken>> {
  const hours = ttlHours ?? PORTAL_TOKEN_TTL_HOURS;
  const plaintextToken = encodeBase64Url(randomBytes(PORTAL_TOKEN_BYTES));
  const tokenHash = hashPortalToken(plaintextToken);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('portal_tokens')
    .insert({
      token_hash: tokenHash,
      client_id: clientId,
      workspace_id: workspaceId,
      expires_at: expiresAt,
      created_by_user_id: userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return failure(
      createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to persist portal token.',
        'system',
        { originalError: error?.message ?? 'no row returned' },
      ),
    );
  }

  return {
    success: true,
    data: {
      plaintextToken,
      tokenId: (data as { id: string }).id,
    },
  };
}

async function buildMagicLinkUrl(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  workspaceId: string,
  plaintextToken: string,
): Promise<string> {
  const { data } = await supabase
    .from('workspaces')
    .select('slug')
    .eq('id', workspaceId)
    .maybeSingle();

  const slug = (data as { slug?: string } | null)?.slug ?? workspaceId;
  return buildPortalRedeemUrl(plaintextToken, slug);
}
