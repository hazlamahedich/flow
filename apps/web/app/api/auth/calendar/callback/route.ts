import { getIronSession } from 'iron-session';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@flow/db';
import { cacheTag } from '@flow/db';
import { encryptCalendarTokens } from '@flow/db/vault/calendar-tokens';
import { GoogleCalendarProvider } from '@flow/agents/providers';
import { calendarOAuthStateCookieSchema } from '@flow/types';
import type { CalendarOAuthStateCookie } from '@flow/types';
import { revalidateTag } from 'next/cache';
import { getCookieStore } from '@/lib/cookie-store';

function htmlInterstitial(state: string, code: string, error?: string): string {
  const steps = error
    ? `<div class="step error">Connection failed: ${escapeHtml(error)}</div>`
    : `
      <div class="step active">Authorizing...</div>
      <div class="step">Exchanging tokens...</div>
      <div class="step">Setting up calendar...</div>
    `;

  return `<!DOCTYPE html>
<html>
<head><title>Connecting Calendar...</title>
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
  <h2>Connecting your calendar</h2>
  <div id="steps">${steps}</div>
  <noscript>
    <form method="POST">
      <input type="hidden" name="code" value="${escapeHtml(code)}" />
      <input type="hidden" name="state" value="${escapeHtml(state)}" />
      <button type="submit">Complete Connection</button>
    </form>
  </noscript>
</div>
${
  !error
    ? `<script>
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
</script>`
    : ''
}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeReturnTo(returnTo: string | undefined, fallback: string): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//'))
    return fallback;
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
    const returnUrl = new URL(`${appUrl}/settings/integrations/calendar`);
    if (errorSubtype === 'not_verified') {
      returnUrl.searchParams.set('toast_code', 'calendar_app_not_verified');
      returnUrl.searchParams.set(
        'toast_msg',
        'This app is in testing mode. Contact your workspace owner for access.',
      );
    } else {
      returnUrl.searchParams.set('toast_code', 'calendar_access_denied');
      returnUrl.searchParams.set(
        'toast_msg',
        'Calendar access was not granted.',
      );
    }
    return NextResponse.redirect(returnUrl.toString());
  }

  if (error) {
    console.error(
      `[calendar-oauth] OAuth config error: ${error}`,
      url.searchParams.toString(),
    );
    return new Response(
      htmlInterstitial(
        state,
        code,
        'Calendar connection is not configured correctly. Please contact support.',
      ),
      {
        headers: { 'Content-Type': 'text/html' },
      },
    );
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
    return NextResponse.redirect(
      `${appUrl}/settings/integrations/calendar?toast_code=oauth_failed`,
    );
  }

  const ironPassword = process.env.IRON_SESSION_PASSWORD;
  if (!ironPassword || ironPassword.length < 32) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations/calendar?toast_code=calendar_connection_failed`,
    );
  }

  const cookieStore = await getCookieStore();
  const session = await getIronSession<CalendarOAuthStateCookie>(
    cookieStore as any,
    {
      password: ironPassword,
      cookieName: `oauth_pkce_${state}`,
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 600,
        path: '/',
      },
    },
  );

  if (!session.state || session.state !== state) {
    session.destroy();
    return NextResponse.redirect(
      `${appUrl}/settings/integrations/calendar?toast_code=oauth_invalid_state`,
    );
  }

  const {
    codeVerifier,
    clientId,
    accessType,
    workspaceId,
    returnTo: rawReturnTo,
  } = session;
  const returnTo = safeReturnTo(
    rawReturnTo,
    clientId ? `/clients/${clientId}` : '/settings/integrations/calendar',
  );

  try {
    const redirectUri = `${appUrl}/api/auth/calendar/callback`;
    const provider = new GoogleCalendarProvider();

    const { tokens, connectedEmail } = await provider.exchangeCode(
      code,
      redirectUri,
      codeVerifier,
    );

    const supabase = createServiceClient();
    const normalizedEmail = connectedEmail.toLowerCase();

    // Check for existing calendar connection for this email
    const { data: existingCalendar } = await supabase
      .from('client_calendars')
      .select('id, sync_status, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('email_address', normalizedEmail)
      .maybeSingle();

    if (existingCalendar) {
      if (
        existingCalendar.sync_status === 'error' ||
        existingCalendar.sync_status === 'disconnected'
      ) {
        const encryptedState = encryptCalendarTokens(tokens);

        const { data: updated } = await supabase
          .from('client_calendars')
          .update({
            oauth_state: encryptedState as unknown as Record<string, unknown>,
          })
          .eq('id', existingCalendar.id)
          .eq('workspace_id', workspaceId)
          .eq('updated_at', existingCalendar.updated_at ?? '')
          .select('id')
          .maybeSingle();

        if (!updated) {
          session.destroy();
          const returnUrl = new URL(`${appUrl}${returnTo}`);
          returnUrl.searchParams.set('toast_code', 'calendar_reconnected');
          return NextResponse.redirect(returnUrl.toString());
        }

        await supabase
          .from('client_calendars')
          .update({ sync_status: 'connected', error_message: null })
          .eq('id', existingCalendar.id)
          .eq('workspace_id', workspaceId);

        session.destroy();
        revalidateTag(cacheTag('workspace_client', workspaceId));

        const returnUrl = new URL(`${appUrl}${returnTo}`);
        returnUrl.searchParams.set('toast_code', 'calendar_reconnected');
        returnUrl.searchParams.set('calendar_id', existingCalendar.id);
        return NextResponse.redirect(returnUrl.toString());
      }

      session.destroy();
      const returnUrl = new URL(`${appUrl}${returnTo}`);
      returnUrl.searchParams.set('toast_code', 'calendar_already_connected');
      returnUrl.searchParams.set('existing_calendar_id', existingCalendar.id);
      return NextResponse.redirect(returnUrl.toString());
    }

    // Create new calendar connection
    const encryptedState = encryptCalendarTokens(tokens);

    // Fetch the user's calendar list to get primary calendar details
    let calendarId = normalizedEmail; // Default: use email as calendar ID
    let calendarName = normalizedEmail;
    try {
      const { calendars } = await provider.listCalendars(tokens.accessToken);
      const primaryCal = calendars.find((c) => c.isPrimary);
      if (primaryCal) {
        calendarId = primaryCal.calendarId;
        calendarName = primaryCal.name;
      } else if (calendars.length > 0) {
        const fallback = calendars[0]!;
        calendarId = fallback.calendarId;
        calendarName = fallback.name;
      }
    } catch (listErr) {
      console.warn(
        '[calendar-oauth] Failed to list calendars, using email as fallback:',
        listErr,
      );
    }

    // Demote existing primary calendars for this workspace
    await supabase
      .from('client_calendars')
      .update({ is_primary: false })
      .eq('workspace_id', workspaceId)
      .eq('is_primary', true);

    let calendarRow;
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('client_calendars')
        .insert({
          workspace_id: workspaceId,
          client_id: clientId,
          provider: 'google_calendar',
          calendar_id: calendarId,
          calendar_name: calendarName,
          email_address: normalizedEmail,
          access_type: accessType,
          oauth_state: encryptedState as unknown as Record<string, unknown>,
          sync_status: 'connected',
          is_primary: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      calendarRow = inserted;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === '23505'
      ) {
        session.destroy();
        const returnUrl = new URL(`${appUrl}${returnTo}`);
        returnUrl.searchParams.set('toast_code', 'calendar_already_connected');
        return NextResponse.redirect(returnUrl.toString());
      }
      throw err;
    }

    session.destroy();
    revalidateTag(cacheTag('workspace_client', workspaceId));

    const returnUrl = new URL(`${appUrl}${returnTo}`);
    returnUrl.searchParams.set('toast_code', 'calendar_connected');
    returnUrl.searchParams.set('calendar_id', calendarRow.id);
    return NextResponse.redirect(returnUrl.toString());
  } catch {
    session.destroy();
    const returnUrl = new URL(`${appUrl}${returnTo}`);
    returnUrl.searchParams.set('toast_code', 'calendar_connection_failed');
    return NextResponse.redirect(returnUrl.toString());
  }
}
