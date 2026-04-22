'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import type { ActionResult } from '@flow/types';

const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
});

type CreateClientInput = z.infer<typeof createClientSchema>;

interface ClientRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export async function createClient(
  input: CreateClientInput,
): Promise<ActionResult<ClientRecord>> {
  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Validation failed',
        category: 'validation',
      },
    };
  }

  const supabase = await getServerSupabase();

  let workspaceId: string;
  try {
    const ctx = await requireTenantContext(supabase);
    workspaceId = ctx.workspaceId;
  } catch {
    return {
      success: false,
      error: {
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
        category: 'auth',
      },
    };
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      workspace_id: workspaceId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
    })
    .select('id, name, email, phone')
    .single();

  if (error) {
    return {
      success: false,
      error: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to create client',
        category: 'system',
      },
    };
  }

  revalidateTag('clients');
  return { success: true, data: data as ClientRecord };
}

export { createClientSchema };
