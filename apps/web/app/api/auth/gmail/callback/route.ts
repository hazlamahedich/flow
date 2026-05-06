import { getIronSession } from 'iron-session';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@flow/db';
import {
  createClientInbox,
  getClientInboxByEmail,
  updateClientInboxOAuthState,
  updateClientInboxSyncStatus,
  cacheTag,
} from '@flow/db';
import { encryptInboxTokens } from '@flow/db/vault/inbox-tokens';
import { GmailProvider } from '@flow/agents/providers';
import type { OAuthStateCookie } from '@flow/types';
import { revalidateTag } from 'next/cache';
import { getCookieStore } from '@/lib/cookie-store';

async function enqueueInitialSync(
  supabase: ReturnType<typeof createServiceClient>,
  params: { clientInboxId: string; workspaceId: string; clientId: string; historyId: string },
): Promise<void> {
  const runId = crypto.randomUUID();
  await supabase.from('agent_runs').insert({
    id: runId,
    workspace_id: params.workspaceId,
    agent_id: 'inbox',
    action_type: 'initial_sync',
    status: 'queued',
    input: { clientInboxId: params.clientInboxId, historyId: params.historyId },
    client_id: params.clientId,
    correlation_id: crypto.randomUUID(),
  });
  const { executeInitialSync } = await import('@flow/agents/inbox/initial-sync');
  executeInitialSync({ clientInboxId: params.clientInboxId, historyId: params.historyId }).catch((err) => {
    console.error('[initial-sync] failed for', params.clientInboxId, err);
  });
}
function htmlInterstitial(state: string, code: string, error?: string): string {
  const steps = error
    ? `<div class="step error">Connection failed: ${escapeHtml(error)}</div>`
    : `
      <div class="step active">Authorizing...</div>
      <div class="step">Exchanging tokens...</div>
      <div class="step">Setting up inbox...</div>
    `;

  return `<!DOCTYPE html>
<html>
<head><title>Connecting Gmail...</title>
<style>
  body { font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; }
  .container { text-align: center; padding: 2rem; }
  .step { padding: 0.5rem; color: #6b7280; }
  .step.active { color: #2563eb; font-weight: 600; }
  .step.error { color: #dc2626; }
  noscript form button { margin-top: 1rem; padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 0.375rem; cursor: pointer; }
</style>
</head>
<body>
<div class="container">
  <h2>Connecting your Gmail inbox</h2>
  <div id="steps">${steps}</div>
  <noscript>
    <form method="POST">
      <input type="hidden" name="code" value="${escapeHtml(code)}" />
      <input type="hidden" name="state" value="${escapeHtml(state)}" />
      <button type="submit">Complete Connection</button>
    </form>
  </noscript>
</div>
${!error ? `<script>
  const params = new URLSearchParams(window.location.search);
  const form = document.createElement('form');
  form.method = 'POST';
  const codeInput = document.createElement('input');
  codeInput.type = 'hidden'; codeInput.name = 'code'; codeInput.value = params.get('code') || '';
  form.appendChild(codeInput);
  const stateInput = document.createElement('input');
  stateInput.type = 'hidden'; stateInput.name = 'state'; stateInput.value = params.get('state') || '';
  form.appendChild(stateInput);
  document.body.appendChild(form);
  form.submit();
</script>` : ''}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeReturnTo(returnTo: string | undefined, fallback: string): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return fallback;
  return returnTo;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (error === 'access_denied') {
    const errorSubtype = url.searchParams.get('error_subtype');
    const returnUrl = new URL(`${appUrl}/clients`);
    if (errorSubtype === 'not_verified') {
      returnUrl.searchParams.set('toast_code', 'gmail_app_not_verified');
      returnUrl.searchParams.set('toast_msg', 'This app is in testing mode. Contact your workspace owner for access.');
    } else {
      returnUrl.searchParams.set('toast_code', 'gmail_access_denied');
      returnUrl.searchParams.set('toast_msg', 'Gmail access was not granted.');
    }
    return NextResponse.redirect(returnUrl.toString());
  }

  if (error) {
    console.error(`[gmail-oauth] OAuth config error: ${error}`, url.searchParams.toString());
    return new Response(htmlInterstitial(state, code, 'Gmail connection is not configured correctly. Please contact support.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new Response(htmlInterstitial(state, code), {
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const code = formData.get('code') as string | null;
  const state = formData.get('state') as string | null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/clients?toast_code=oauth_failed`);
  }

  const ironPassword = process.env.IRON_SESSION_PASSWORD;
  if (!ironPassword || ironPassword.length < 32) {
    return NextResponse.redirect(`${appUrl}/clients?toast_code=inbox_connection_failed`);
  }

  const cookieStore = await getCookieStore();
  const session = await getIronSession<OAuthStateCookie>(cookieStore, {
    password: ironPassword,
    cookieName: `oauth_pkce_${state}`,
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 600, path: '/' },
  });

  if (!session.state || session.state !== state) {
    session.destroy();
    return NextResponse.redirect(`${appUrl}/clients?toast_code=oauth_invalid_state`);
  }

  const { codeVerifier, clientId, accessType, workspaceId, returnTo: rawReturnTo } = session;
  const returnTo = safeReturnTo(rawReturnTo, `/clients/${clientId}`);

  try {
    const redirectUri = `${appUrl}/api/auth/gmail/callback`;
    const provider = new GmailProvider();

    const { tokens, emailAddress } = await provider.exchangeCode(code, redirectUri, codeVerifier);

    const supabase = createServiceClient();

    const normalizedEmail = emailAddress.toLowerCase();

    const existingInbox = await getClientInboxByEmail(supabase, workspaceId, normalizedEmail);
    if (existingInbox) {
      if (existingInbox.syncStatus === 'error' || existingInbox.syncStatus === 'disconnected') {
        const encryptedState = encryptInboxTokens(tokens);
        const { data: updated } = await supabase
          .from('client_inboxes')
          .update({ oauth_state: encryptedState as unknown as Record<string, unknown> })
          .eq('id', existingInbox.id)
          .eq('workspace_id', workspaceId)
          .eq('updated_at', existingInbox.updatedAt ?? '')
          .select('id')
          .maybeSingle();
        if (!updated) {
          session.destroy();
          const returnUrl = new URL(`${appUrl}${returnTo}`);
          returnUrl.searchParams.set('toast_code', 'inbox_reconnected');
          return NextResponse.redirect(returnUrl.toString());
        }
        await updateClientInboxSyncStatus(supabase, existingInbox.id, workspaceId, 'connected', { errorMessage: null });

        session.destroy();
        revalidateTag(cacheTag('workspace_client', workspaceId));

        const profile = await provider.getProfile(tokens.accessToken);
        enqueueInitialSync(supabase, { clientInboxId: existingInbox.id, workspaceId, clientId, historyId: profile.historyId });

        const returnUrl = new URL(`${appUrl}${returnTo}`);
        returnUrl.searchParams.set('toast_code', 'inbox_reconnected');
        returnUrl.searchParams.set('inbox_id', existingInbox.id);
        return NextResponse.redirect(returnUrl.toString());
      }

      session.destroy();
      const returnUrl = new URL(`${appUrl}${returnTo}`);
      returnUrl.searchParams.set('toast_code', 'inbox_already_connected');
      returnUrl.searchParams.set('existing_inbox_id', existingInbox.id);
      return NextResponse.redirect(returnUrl.toString());
    }

    const encryptedState = encryptInboxTokens(tokens);

    let inbox;
    try {
      inbox = await createClientInbox(supabase, {
        workspaceId,
        clientId,
        provider: 'gmail',
        emailAddress: normalizedEmail,
        accessType,
        oauthState: encryptedState as unknown as Record<string, unknown>,
        syncStatus: 'connected',
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        session.destroy();
        const returnUrl = new URL(`${appUrl}${returnTo}`);
        returnUrl.searchParams.set('toast_code', 'inbox_already_connected');
        return NextResponse.redirect(returnUrl.toString());
      }
      throw err;
    }

    session.destroy();
    revalidateTag(cacheTag('workspace_client', workspaceId));

    const profile = await provider.getProfile(tokens.accessToken);
    enqueueInitialSync(supabase, { clientInboxId: inbox.id, workspaceId, clientId, historyId: profile.historyId });

    const returnUrl = new URL(`${appUrl}${returnTo}`);
    returnUrl.searchParams.set('toast_code', 'inbox_connected');
    returnUrl.searchParams.set('inbox_id', inbox.id);
    return NextResponse.redirect(returnUrl.toString());
  } catch {
    session.destroy();
    const returnUrl = new URL(`${appUrl}${returnTo}`);
    returnUrl.searchParams.set('toast_code', 'inbox_connection_failed');
    return NextResponse.redirect(returnUrl.toString());
  }
}
