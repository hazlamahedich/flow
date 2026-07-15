/**
 * Report approval Server Action (portal).
 *
 * Transitions a sent/viewed report to approved via the SECURITY DEFINER RPC
 * approve_report_via_portal. The portal role is read-only, so mutations go
 * through the RPC which re-verifies client_id inside Postgres.
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

const approveReportInputSchema = z.object({
  reportId: z.string().uuid(),
});

export async function approveReportAction(
  portalCtx: PortalContext,
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = approveReportInputSchema.safeParse(input);
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

  const rlResult = await checkApproveRateLimit(
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
    'approve_report_via_portal',
    {
      p_report_id: parsed.data.reportId,
      p_client_id: portalCtx.clientId,
    },
  );

  if (error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to approve report.',
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
        'Report cannot be approved in its current state.',
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
      'Failed to approve report.',
      'system',
    ),
  };
}

async function checkApproveRateLimit(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  portalTokenId: string,
): Promise<{ limited: true; retryAfterMs: number } | { limited: false }> {
  const { data: rlResult } = await supabase.rpc('check_rate_limit', {
    p_identifier: `approve_report:${portalTokenId}`,
    p_action: 'portal_approve_report',
    p_max_requests: 10,
    p_window_seconds: 60,
    p_min_interval_seconds: 0,
  });
  return isRateLimited(rlResult);
}
