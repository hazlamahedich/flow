import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './supabase-env';

interface RLSFixtureResult {
  tenantId: string;
  otherTenantId: string;
  client: SupabaseClient;
  cleanup: () => Promise<void>;
}

export async function setupRLSFixture(
  tenantId: string,
  role: string,
): Promise<RLSFixtureResult> {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const admin = createClient(
    url,
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const otherTenantId = crypto.randomUUID();
  const testEmail = `rls-${role}-${tenantId.slice(0, 8)}@test.flow.local`;
  const testUserId = crypto.randomUUID();

  const { error: wsErr } = await admin.from('workspaces').insert({
    id: otherTenantId,
    name: `other-${otherTenantId.slice(0, 8)}`,
    settings: {},
  });
  if (wsErr) throw wsErr;

  const { error: authErr } = await admin.auth.admin.createUser({
    id: testUserId,
    email: testEmail,
    password: 'test-password-12345',
    email_confirm: true,
    app_metadata: { workspace_id: tenantId, role },
  });
  if (authErr) throw authErr;

  const { error: profileErr } = await admin.from('users').insert({
    id: testUserId,
    email: testEmail,
  });
  if (profileErr) throw profileErr;

  const { error: memberErr } = await admin
    .from('workspace_members')
    .insert({ workspace_id: tenantId, user_id: testUserId, role });
  if (memberErr) throw memberErr;

  const client = createClient(url, anonKey);
  const { error: signInErr } = await client.auth.signInWithPassword({
    email: testEmail,
    password: 'test-password-12345',
  });
  if (signInErr) throw signInErr;

  const cleanup = async () => {
    await admin.from('workspaces').delete().eq('id', otherTenantId);
    await admin
      .from('workspace_members')
      .delete()
      .eq('user_id', testUserId)
      .eq('workspace_id', tenantId);
    await admin.auth.admin.deleteUser(testUserId);
  };

  return { tenantId, otherTenantId, client, cleanup };
}
