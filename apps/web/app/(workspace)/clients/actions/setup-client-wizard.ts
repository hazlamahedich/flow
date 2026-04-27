'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, cacheTag, createRetainer } from '@flow/db';
import { createWorkspaceClient } from './create-client';
import { wizardRetainerSchema } from './wizard-types';
import type { WizardActionResult } from './wizard-types';

interface WizardInput {
  clientData: unknown;
  retainerData?: unknown;
}

export async function setupClientWizard(input: WizardInput): Promise<WizardActionResult> {
  const clientResult = await createWorkspaceClient(input.clientData);

  if (!clientResult.success) {
    return { success: false, error: clientResult.error };
  }

  const newClient = clientResult.data;

  if (!input.retainerData) {
    return { success: true, data: { client: newClient } };
  }

  const parsed = wizardRetainerSchema.safeParse(input.retainerData);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return {
      success: true,
      data: {
        client: newClient,
        warning: {
          code: 'RETAINER_SETUP_FAILED',
          message: `Retainer data was invalid: ${details}`,
        },
      },
    };
  }

  try {
    const supabase = await getServerSupabase();
    const tenant = await requireTenantContext(supabase);

    const retainer = await createRetainer(supabase, {
      workspaceId: tenant.workspaceId,
      data: {
        clientId: newClient.id,
        ...parsed.data,
      },
    });

    revalidateTag(cacheTag('retainer_agreement', tenant.workspaceId));
    revalidateTag(cacheTag('dashboard', tenant.workspaceId));

    return { success: true, data: { client: newClient, retainer } };
  } catch (err: unknown) {
    try {
      const supabase = await getServerSupabase();
      const tenant = await requireTenantContext(supabase);
      revalidateTag(cacheTag('retainer_agreement', tenant.workspaceId));
      revalidateTag(cacheTag('dashboard', tenant.workspaceId));
    } catch {
      // revalidation best-effort
    }

    const error = err as { code?: string; retainerCode?: string };
    if (error.code === '23505' || error.retainerCode === 'RETAINER_ACTIVE_EXISTS') {
      return {
        success: true,
        data: {
          client: newClient,
          warning: {
            code: 'RETAINER_ACTIVE_EXISTS',
            message: 'An active retainer already exists for this client.',
          },
        },
      };
    }

    return {
      success: true,
      data: {
        client: newClient,
        warning: {
          code: 'RETAINER_SETUP_FAILED',
          message: 'Failed to create retainer. You can set it up from the client detail page.',
        },
      },
    };
  }
}
