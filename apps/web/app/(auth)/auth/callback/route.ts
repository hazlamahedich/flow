import { getServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/auth-audit';
import { checkRateLimit, MAGIC_LINK_VERIFICATION_CONFIG } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { trustDevice } from '@flow/auth/device-trust';
import {
  DEVICE_COOKIE_NAME,
  DEVICE_PENDING_COOKIE_NAME,
  DEVICE_COOKIE_MAX_AGE,
} from '@flow/auth/device-types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorCode = searchParams.get('error_code');

  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? 'unknown';

  if (error === 'access_denied' || errorCode === 'otp_expired') {
    const email = searchParams.get('email') ?? '';
    await logAuthEvent({
      action: 'link_expired_attempt',
      email,
      ip,
      outcome: 'failure',
    });

    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('error', 'access_denied');
    if (email) redirectUrl.searchParams.set('email', email);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=invalid_request', request.url));
  }

  try {
    const supabase = await getServerSupabase();

    const verificationRateResult = await checkRateLimit(ip, MAGIC_LINK_VERIFICATION_CONFIG);
    if (!verificationRateResult.allowed) {
      return NextResponse.redirect(
        new URL(`/login?error=rate_limited&retry=${Math.ceil(verificationRateResult.retryAfterMs / 1000)}`, request.url),
      );
    }

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      if (exchangeError.message?.toLowerCase().includes('already been used') ||
          exchangeError.message?.toLowerCase().includes('exchange')) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      }

      return NextResponse.redirect(new URL('/login?error=invalid_request', request.url));
    }

    if (!data.user) {
      return NextResponse.redirect(new URL('/login?error=invalid_request', request.url));
    }

    const email = data.user.email ?? '';
    const userAgent = headerStore.get('user-agent') ?? null;

    await logAuthEvent({
      action: 'magic_link_verified',
      email,
      ip,
      userId: data.user.id,
      outcome: 'success',
    });

    await logAuthEvent({
      action: 'session_created',
      email,
      ip,
      userId: data.user.id,
      outcome: 'success',
    });

    const redirectParams = new URLSearchParams();
    let deviceCookieToSet: string | null = null;

    try {
      const pendingToken = request.cookies.get(DEVICE_PENDING_COOKIE_NAME)?.value;

      if (pendingToken && data.user.id) {
        const trustResult = await trustDevice({
          userId: data.user.id,
          userAgent,
          pendingToken,
        });

        if (trustResult.trusted) {
          deviceCookieToSet = trustResult.deviceToken;
          redirectParams.set('device_trusted', 'true');

          await logAuthEvent({
            action: 'device_trusted',
            userId: data.user.id,
            ip,
            outcome: 'success',
            details: { device_label: userAgent?.slice(0, 100) ?? 'Unknown' },
          });
        } else {
          redirectParams.set('device_trust_rejected', trustResult.reason);

          await logAuthEvent({
            action: 'device_trust_rejected',
            userId: data.user.id,
            ip,
            outcome: 'failure',
            details: {
              reason: trustResult.reason,
              current_count: trustResult.currentCount,
              max_devices: trustResult.maxDevices,
            },
          });
        }
      }
    } catch (deviceTrustError) {
      console.error('[auth/callback] Device trust failed (non-blocking):', deviceTrustError);
    }

    const isFirstLogin = data.user.user_metadata?.is_first_login !== false;
    if (isFirstLogin) {
      await supabase.auth.updateUser({ data: { is_first_login: false } });
    }

    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', data.user.id)
      .is('removed_at', null);

    const workspaceCount = memberships?.length ?? 0;

    let targetPath: string;
    if (workspaceCount === 0 || isFirstLogin) {
      targetPath = '/onboarding';
    } else if (workspaceCount === 1 && memberships?.[0]?.workspace_id) {
      targetPath = '/';
    } else {
      targetPath = '/workspace-picker';
    }

    const redirectUrl = new URL(targetPath, request.url);
    const paramString = redirectParams.toString();
    if (paramString) {
      redirectUrl.search = paramString;
    }

    const response = NextResponse.redirect(redirectUrl);

    if (deviceCookieToSet) {
      response.cookies.set(DEVICE_COOKIE_NAME, deviceCookieToSet, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: DEVICE_COOKIE_MAX_AGE,
      });
    }

    response.cookies.set(DEVICE_PENDING_COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch {
    await logAuthEvent({
      action: 'magic_link_verified',
      ip,
      outcome: 'failure',
    });

    return NextResponse.redirect(new URL('/auth/callback/error', request.url));
  }
}
