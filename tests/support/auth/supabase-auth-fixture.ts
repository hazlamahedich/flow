import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const appUrl = process.env.BASE_URL ?? 'http://localhost:3000';

type UserRole = 'owner' | 'admin' | 'member';

interface AuthenticatedUser {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  role: UserRole;
}

function getCookieName(): string {
  const url = new URL(supabaseUrl);
  const firstSegment = url.hostname.split('.')[0];
  return `sb-${firstSegment}-auth-token`;
}

async function signInAs(email: string, password: string): Promise<AuthenticatedUser> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message ?? 'no user returned'}`);
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? email,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    role: 'owner',
  };
}

function base64urlEncode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

async function getStorageStateForUser(user: AuthenticatedUser) {
  const cookieName = getCookieName();
  const sessionJson = JSON.stringify({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: user.userId,
      email: user.email,
      aud: 'authenticated',
      role: 'authenticated',
    },
  });
  return {
    cookies: [
      {
        name: cookieName,
        value: 'base64-' + base64urlEncode(sessionJson),
        domain: new URL(appUrl).hostname,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };
}

export const test = base.extend({
  authenticatedUser: async ({}, use) => {
    const email = process.env.E2E_USER_EMAIL ?? 'owner@test.com';
    const password = process.env.E2E_USER_PASSWORD ?? 'password123';

    const user = await signInAs(email, password);
    await use(user);
  },

  authenticatedPage: async ({ browser, authenticatedUser }, use) => {
    const storageState = await getStorageStateForUser(authenticatedUser.accessToken);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    await use(page);

    await context.close();
  },

  ownerPage: async ({ browser }, use) => {
    const email = process.env.E2E_OWNER_EMAIL ?? 'owner@test.com';
    const password = process.env.E2E_OWNER_PASSWORD ?? 'password123';
    const user = await signInAs(email, password);
    const storageState = await getStorageStateForUser(user);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    await use(page);

    await context.close();
  },

  adminPage: async ({ browser }, use) => {
    const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@test.com';
    const password = process.env.E2E_ADMIN_PASSWORD ?? 'password123';
    const user = await signInAs(email, password);
    const storageState = await getStorageStateForUser(user.accessToken);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    await use(page);

    await context.close();
  },

  memberPage: async ({ browser }, use) => {
    const email = process.env.E2E_MEMBER_EMAIL ?? 'member@test.com';
    const password = process.env.E2E_MEMBER_PASSWORD ?? 'password123';
    const user = await signInAs(email, password);
    const storageState = await getStorageStateForUser(user.accessToken);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    await use(page);

    await context.close();
  },
});

export { expect };
