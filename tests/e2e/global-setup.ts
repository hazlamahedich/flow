import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

setup('ensure E2E test users exist in database', async () => {
  setup.skip(!supabaseServiceKey, 'SUPABASE_SERVICE_ROLE_KEY not set');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  expect(error).toBeNull();

  const existingEmails = new Set(users.map((u) => u.email));
  const requiredEmails = ['owner@test.com', 'admin@test.com', 'member@test.com'];
  const allExist = requiredEmails.every((e) => existingEmails.has(e));

  expect(allExist, `Missing E2E test users. Run: pnpm supabase db reset`).toBeTruthy();
});
