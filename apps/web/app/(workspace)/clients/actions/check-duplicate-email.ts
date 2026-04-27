'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, checkDuplicateEmail } from '@flow/db';
import type { ActionResult } from '@flow/types';

interface DuplicateEmailResult {
  exists: boolean;
  clientId?: string;
  clientName?: string;
}

export async function checkDuplicateEmailAction(input: {
  email: string;
}): Promise<ActionResult<DuplicateEmailResult>> {
  const { email } = input;
  if (!email || email.trim() === '') {
    return { success: true, data: { exists: false } };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role === 'member') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Members cannot check duplicate emails.', 'auth'),
    };
  }

  const existing = await checkDuplicateEmail(supabase, ctx.workspaceId, email.trim());
  if (existing) {
    return {
      success: true,
      data: { exists: true, clientId: existing.id, clientName: existing.name },
    };
  }

  return { success: true, data: { exists: false } };
}
