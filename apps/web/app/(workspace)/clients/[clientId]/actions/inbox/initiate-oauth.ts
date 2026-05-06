'use server';

import { randomBytes, createHash } from 'node:crypto';
import { getIronSession } from 'iron-session';
import { getCookieStore } from '@/lib/cookie-store';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
} from '@flow/db';
import { connectInboxInputSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import type { OAuthStateCookie } from '@flow/types';
import { GmailProvider } from '@flow/agents/providers';

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, clientId: string): boolean {
  const key = `${userId}:${clientId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (rateLimitMap.size > 10_000) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function safeReturnTo(returnTo: string | undefined, fallback: string): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return fallback;
  return returnTo;
}

interface OAuthInitResult {
  oauthUrl: string;
  state: string;
}

export async function initiateOAuth(
  input: unknown,
): Promise<ActionResult<OAuthInitResult>> {
  const parsed = connectInboxInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Validation failed',
        'validation',
      ),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role === 'member') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Members cannot connect inboxes.', 'auth'),
    };
  }

  const { data: clientExists } = await supabase
    .from('clients')
    .select('id')
    .eq('id', parsed.data.clientId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (!clientExists) {
    return {
      success: false,
      error: createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found in this workspace.', 'validation'),
    };
  }

  if (!checkRateLimit(ctx.userId, parsed.data.clientId)) {
    return {
      success: false,
      error: createFlowError(
        429,
        'SYSTEM_RATE_LIMITED',
        'Too many connection attempts. Please wait and try again.',
        'system',
      ),
    };
  }

  const state = randomBytes(16).toString('hex');
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/gmail/callback`;

  const provider = new GmailProvider();
  const oauthUrl = provider.getOAuthUrl({
    redirectUri,
    state,
    codeChallenge,
    accessType: parsed.data.accessType,
  });

  const ironPassword = process.env.IRON_SESSION_PASSWORD;
  if (!ironPassword || ironPassword.length < 32) {
    return {
      success: false,
      error: createFlowError(500, 'ENCRYPTION_KEY_MISSING', 'Server configuration error. Please contact support.', 'system'),
    };
  }

  const cookieStore = await getCookieStore();
  const session = await getIronSession<OAuthStateCookie>(cookieStore, {
    password: ironPassword,
    cookieName: `oauth_pkce_${state}`,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 600,
      path: '/',
    },
  });

  session.state = state;
  session.codeVerifier = codeVerifier;
  session.clientId = parsed.data.clientId;
  session.accessType = parsed.data.accessType;
  session.workspaceId = ctx.workspaceId;
  session.returnTo = safeReturnTo(parsed.data.returnTo, `/clients/${parsed.data.clientId}`);
  await session.save();

  return {
    success: true,
    data: { oauthUrl, state },
  };
}
