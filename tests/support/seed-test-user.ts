import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function seed() {
  if (!supabaseServiceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const ownerEmail = 'owner@test.com';
  const ownerPassword = 'password123';

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === ownerEmail);

  let userId: string;

  if (existing) {
    userId = existing.id;
    console.log('User already exists:', userId);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });
    if (error) {
      console.error('Failed to create user:', error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log('Created user:', userId);
  }

  const { error: profileErr } = await supabase
    .from('users')
    .upsert({ id: userId, email: ownerEmail, name: 'Test Owner', timezone: 'UTC' });
  if (profileErr) console.error('Profile upsert:', profileErr.message);
  else console.log('User profile ready');

  const { data: workspaces } = await supabase.from('workspaces').select('id').eq('slug', 'test-workspace');
  let workspaceId: string;

  if (workspaces && workspaces.length > 0) {
    workspaceId = workspaces[0].id;
    console.log('Workspace exists:', workspaceId);
  } else {
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .insert({ name: 'Test Workspace', slug: 'test-workspace' })
      .select()
      .single();
    if (wsErr) {
      console.error('Failed to create workspace:', wsErr.message);
      process.exit(1);
    }
    workspaceId = ws.id;
    console.log('Created workspace:', workspaceId);
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    const { error: mErr } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: workspaceId, user_id: userId, role: 'owner', status: 'active' });
    if (mErr) console.error('Membership:', mErr.message);
    else console.log('Created owner membership');
  } else {
    console.log('Membership exists');
  }

  console.log('\nSeed complete. Test credentials:');
  console.log('  Email:', ownerEmail);
  console.log('  Password:', ownerPassword);
}

seed();
