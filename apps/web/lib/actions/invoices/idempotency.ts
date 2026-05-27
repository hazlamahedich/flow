import crypto from 'node:crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import type { ActionResult } from '@flow/types';

type SupabaseClient = Awaited<ReturnType<typeof getServerSupabase>>;

export const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

export function hashIdempotencyKey(invoiceId: string, key: string): string {
  return crypto.createHash('sha256').update(`${invoiceId}::${key}`).digest('hex');
}

export function buildScope(workspaceId: string, invoiceId: string): string {
  return `${workspaceId}:${invoiceId}`;
}

/**
 * Check for cached idempotency key. Returns cached result if found.
 */
export async function checkIdempotencyKey<T>(
  supabase: SupabaseClient,
  workspaceId: string,
  invoiceId: string,
  idempotencyKey: string | undefined,
): Promise<ActionResult<T> | null> {
  if (!idempotencyKey) return null;

  const hash = hashIdempotencyKey(invoiceId, idempotencyKey);
  const scope = buildScope(workspaceId, invoiceId);

  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('response_json')
    .eq('key_hash', hash)
    .eq('scope', scope)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return { success: true, data: ((existing as Record<string, unknown>).response_json as unknown) as T };
  }

  return null;
}

/**
 * Store idempotency key after successful operation.
 */
export async function storeIdempotencyKey(
  supabase: SupabaseClient,
  workspaceId: string,
  invoiceId: string,
  idempotencyKey: string | undefined,
  response: unknown,
): Promise<void> {
  if (!idempotencyKey) return;

  const hash = hashIdempotencyKey(invoiceId, idempotencyKey);
  const scope = buildScope(workspaceId, invoiceId);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('idempotency_keys').insert({
    key_hash: hash,
    scope,
    invoice_id: invoiceId,
    workspace_id: workspaceId,
    response_json: response as Record<string, unknown>,
    expires_at: expiresAt,
  });
}
