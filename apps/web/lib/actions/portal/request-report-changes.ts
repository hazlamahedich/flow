/**
 * Request report changes Server Action (portal).
 *
 * Transitions a sent/viewed report to rejected with a client feedback message
 * via the SECURITY DEFINER RPC request_report_changes_via_portal.
 *
 * Story 9.2 — AC4 (FR53).
 */
'use server';

import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase-server';
import { createPortalClient } from '@flow/auth/server/portal-client';
import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { isRateLimited, createRateLimitError } from './helpers';
import { PORTAL_SESSION_MAX_AGE_SECONDS } from './constants';
import type { PortalContext } from './helpers';

const requestReportChangesInputSchema = z.object({
  reportId: z.string().uuid(),
  message: z
    .string()
    .trim()
    .min(1, 'Feedback message is required')
    .max(2000, 'Feedback too long (max 2000 characters)'),
});

export async function requestReportChangesAction(
  portalCtx: PortalContext,
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = requestReportChangesInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
      ),
    };
  }

  const supabase = await getServerSupabase();

  const rlResult = await checkRequestChangesRateLimit(
    supabase,
    portalCtx.portalTokenId,
  );
  if (rlResult.limited) {
    return {
      success: false,
      error: createRateLimitError(rlResult.retryAfterMs),
    };
  }

  const portalClient = await createPortalClient(
    portalCtx,
    PORTAL_SESSION_MAX_AGE_SECONDS,
  );
  const { data: rpcResult, error } = await portalClient.rpc(
    'request_report_changes_via_portal',
    {
      p_report_id: parsed.data.reportId,
      p_client_id: portalCtx.clientId,
      p_message: parsed.data.message,
    },
  );

  if (error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to submit change request.',
        'system',
      ),
    };
  }

  const status = (rpcResult as string) ?? '';

  if (status === 'OK') {
    return { success: true, data: undefined };
  }
  if (status === 'INVALID_STATE') {
    return {
      success: false,
      error: createFlowError(
        409,
        'INVALID_STATE',
        'Report cannot be modified in its current state.',
        'validation',
      ),
    };
  }
  if (status === 'INVALID_MESSAGE') {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'Feedback must be 1–2000 characters.',
        'validation',
      ),
    };
  }
  if (status === 'FORBIDDEN') {
    return {
      success: false,
      error: createFlowError(
        403,
        'FORBIDDEN',
        'You do not have access to this report.',
        'auth',
      ),
    };
  }

  return {
    success: false,
    error: createFlowError(
      500,
      'INTERNAL_ERROR',
      'Failed to submit change request.',
      'system',
    ),
  };
}

async function checkRequestChangesRateLimit(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  portalTokenId: string,
): Promise<{ limited: true; retryAfterMs: number } | { limited: false }> {
  const { data: rlResult } = await supabase.rpc('check_rate_limit', {
    p_identifier: `request_changes:${portalTokenId}`,
    p_action: 'portal_request_changes',
    p_max_requests: 10,
    p_window_seconds: 60,
    p_min_interval_seconds: 0,
  });
  return isRateLimited(rlResult);
}
