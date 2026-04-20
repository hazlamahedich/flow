import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './supabase-env';

export type TenantConfig = {
  plan?: 'free' | 'professional' | 'agency';
  roles: Array<'owner' | 'admin' | 'member' | 'client_user'>;
  clients?: Array<{ name: string; email: string }>;
  trustOverrides?: Record<string, unknown>;
};

interface TenantResult {
  tenantId: string;
  users: Record<string, { id: string; email: string }>;
  clients: Array<{ id: string; name: string }>;
  cleanup: () => Promise<void>;
}

export async function createTestTenant(
  config: TenantConfig,
): Promise<TenantResult> {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tenantId = crypto.randomUUID();
  const users: Record<string, { id: string; email: string }> = {};
  const createdUserIds: string[] = [];
  const clients: Array<{ id: string; name: string }> = [];

  const { error: wsError } = await admin.from('workspaces').insert({
    id: tenantId,
    name: `test-${tenantId.slice(0, 8)}`,
    settings: { plan: config.plan ?? 'free' },
  });
  if (wsError) throw wsError;

  for (const role of config.roles) {
    const userId = crypto.randomUUID();
    const email = `${role}-${tenantId.slice(0, 8)}@test.flow.local`;

    const { error: authErr } = await admin.auth.admin.createUser({
      id: userId,
      email,
      password: 'test-password-12345',
      email_confirm: true,
      app_metadata: { workspace_id: tenantId, role },
    });
    if (authErr) throw authErr;

    const { error: profileErr } = await admin.from('users').insert({
      id: userId,
      email,
    });
    if (profileErr) throw profileErr;

    const { error: memberErr } = await admin
      .from('workspace_members')
      .insert({ workspace_id: tenantId, user_id: userId, role });
    if (memberErr) throw memberErr;

    createdUserIds.push(userId);
    users[role] = { id: userId, email };
  }

  if (config.clients) {
    for (const c of config.clients) {
      const clientId = crypto.randomUUID();
      const { error: clientErr } = await admin
        .from('clients')
        .insert({
          id: clientId,
          workspace_id: tenantId,
          name: c.name,
          email: c.email,
        });
      if (clientErr) throw clientErr;
      clients.push({ id: clientId, name: c.name });
    }
  }

  const cleanup = async () => {
    await admin.from('workspaces').delete().eq('id', tenantId);
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid);
    }
  };

  return { tenantId, users, clients, cleanup };
}
