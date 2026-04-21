import { createBrowserClient as createFlowBrowserClient } from '@flow/db';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (!client) {
    client = createFlowBrowserClient();
  }
  return client;
}
