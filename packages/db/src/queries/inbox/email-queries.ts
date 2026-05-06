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
  to_addresses: z.array(z.object({ name: z.string().nullable(), address: z.string() })),
  cc_addresses: z.array(z.object({ name: z.string().nullable(), address: z.string() })),
  received_at: z.string(),
  body_clean: z.string().nullable(),
  body_raw_safe: z.string().nullable(),
  headers: z.array(z.object({ name: z.string(), value: z.string() })).nullable(),
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
