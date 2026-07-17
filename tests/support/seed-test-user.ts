import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

interface SeedUser {
  email: string;
  role: 'owner' | 'admin' | 'member';
}

const TEST_WORKSPACE_SLUG = 'test-workspace';
const PASSWORD = 'password123';

const USERS: SeedUser[] = [
  { email: 'owner@test.com', role: 'owner' },
  { email: 'admin@test.com', role: 'admin' },
  { email: 'member@test.com', role: 'member' },
];

async function seed() {
  if (!supabaseServiceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingEmails = new Set(
    existingUsers?.users?.map((u) => u.email) ?? [],
  );

  const createdUserIds = new Map<string, string>();

  for (const { email } of USERS) {
    let userId: string;

    if (existingEmails.has(email)) {
      const existing = existingUsers!.users.find((u) => u.email === email);
      userId = existing!.id;
      console.log(`User already exists: ${email} (${userId})`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) {
        console.error(`Failed to create user ${email}:`, error.message);
        process.exit(1);
      }
      userId = data.user!.id;
      console.log(`Created user: ${email} (${userId})`);
    }

    createdUserIds.set(email, userId);

    const { error: profileErr } = await supabase.from('users').upsert({
      id: userId,
      email,
      name: email.split('@')[0]!.replace(/^./, (c) => c.toUpperCase()),
      timezone: 'UTC',
    });
    if (profileErr) {
      console.error(`Profile upsert for ${email}:`, profileErr.message);
    } else {
      console.log(`User profile ready: ${email}`);
    }
  }

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', TEST_WORKSPACE_SLUG);

  let workspaceId: string;

  if (workspaces && workspaces.length > 0) {
    workspaceId = workspaces[0]!.id;
    console.log('Workspace exists:', workspaceId);
  } else {
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .insert({ name: 'Test Workspace', slug: TEST_WORKSPACE_SLUG })
      .select()
      .single();
    if (wsErr) {
      console.error('Failed to create workspace:', wsErr.message);
      process.exit(1);
    }
    workspaceId = ws!.id;
    console.log('Created workspace:', workspaceId);
  }

  for (const { email, role } of USERS) {
    const userId = createdUserIds.get(email);
    if (!userId) continue;

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      const { error: mErr } = await supabase.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: userId,
        role,
        status: 'active',
      });
      if (mErr) {
        console.error(`Membership for ${email}:`, mErr.message);
      } else {
        console.log(`Created ${role} membership: ${email}`);
      }
    } else {
      console.log(`Membership exists: ${email}`);
    }
  }

  console.log('\nSeed complete. Test credentials:');
  for (const { email } of USERS) {
    console.log(`  ${email} / ${PASSWORD}`);
  }
}

seed();
