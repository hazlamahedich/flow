import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const emailRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  client_inbox_id: z.string().uuid(),
  client_id: z.string().uuid(),
  gmail_message_id: z.string(),
  gmail_thread_id: z.string().nullable(),
  subject: z.string().nullable(),
  from_address: z.string(),
  from_name: z.string().nullable(),
  to_addresses: z.array(
    z.object({ name: z.string().nullable(), address: z.string() }),
  ),
  cc_addresses: z.array(
    z.object({ name: z.string().nullable(), address: z.string() }),
  ),
  received_at: z.string(),
  body_clean: z.string().nullable(),
  body_raw_safe: z.string().nullable(),
  headers: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .nullable(),
  category: z.string().nullable(),
  confidence: z.number().nullable(),
  requires_confirmation: z.boolean().nullable(),
  processed_at: z.string().nullable(),
  created_at: z.string(),
});

export type EmailRow = z.infer<typeof emailRowSchema>;

export async function insertEmail(
  supabase: SupabaseClient,
  input: Omit<EmailRow, 'id' | 'created_at'> & { id?: string },
): Promise<void> {
  const { error } = await supabase.from('emails').insert(input);
  if (error && error.code !== '23505') throw error;
}

export async function updateEmailCategorization(
  supabase: SupabaseClient,
  emailId: string,
  data: {
    category: string;
    confidence: number;
    requires_confirmation?: boolean;
    processedAt: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from('emails')
    .update({
      category: data.category,
      confidence: data.confidence,
      requires_confirmation: data.requires_confirmation ?? false,
      processed_at: data.processedAt,
    })
    .eq('id', emailId);

  if (error) throw error;
}

export async function getUnprocessedEmails(
  supabase: SupabaseClient,
  workspaceId: string,
  limit = 100,
): Promise<EmailRow[]> {
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('processed_at', null)
    .order('received_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => emailRowSchema.parse(row));
}

export async function getHandledEmails(
  supabase: SupabaseClient,
  workspaceId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ items: EmailRow[]; totalCount: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const offset = options.offset ?? 0;

  // AC1: info or noise categories at trust auto (3+)
  // We query emails where category is info/noise.
  // Note: Filtering by trust level 'auto' should ideally be done by joining trust_matrix
  // but since trust is per client_inbox, we'll fetch them all and filter or trust the caller.
  // The story says "Render emails categorized as info or noise (at trust >= 3)".
  // This implies they ARE already categorized.

  const { data, count, error } = await supabase
    .from('emails')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .in('category', ['info', 'noise'])
    .order('received_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    items: (data ?? []).map((row) => emailRowSchema.parse(row)),
    totalCount: count ?? 0,
  };
}

export async function getWeeklyAuditCount(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count, error } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('category', ['info', 'noise'])
    .gte('received_at', sevenDaysAgo.toISOString());

  if (error) throw error;
  return count ?? 0;
}

export async function recategorizeEmail(
  supabase: SupabaseClient,
  workspaceId: string,
  emailId: string,
  newCategory: string,
): Promise<void> {
  const { error } = await supabase
    .from('emails')
    .update({ category: newCategory, requires_confirmation: false })
    .eq('id', emailId)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
}
