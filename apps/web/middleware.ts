import { createServerClient } from '@flow/db';
import { NextRequest, NextResponse } from 'next/server';
import { verifyDeviceTrust } from '@flow/auth/device-trust';
import { DEVICE_COOKIE_NAME } from '@flow/auth/device-types';

const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
const TRUSTED_ABSOLUTE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_SESSION_MS = 4 * 60 * 60 * 1000;

function getSessionIssuedAt(session: { access_token: string }): number {
  try {
    const payload = session.access_token.split('.')[1];
    if (!payload) return 0;
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.iat === 'number' ? decoded.iat * 1000 : 0;
  } catch {
    return 0;
  }
}

function buildRedirectWithCookies(
  request: NextRequest,
  path: string,
  supabaseResponse: NextResponse,
): NextResponse {
  const redirectUrl = new URL(path, request.url);
  const response = NextResponse.redirect(redirectUrl);
  for (const c of supabaseResponse.cookies.getAll()) {
    response.cookies.set(c.name, c.value, {
      path: c.path ?? '/',
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite as 'lax' | 'strict' | 'none' | undefined,
      maxAge: c.maxAge,
    });
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const supabaseResponse = NextResponse.next({ request });

  const cookieData = request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));

  const supabase = createServerClient({
    getAll() {
      return cookieData;
    },
    set(name: string, value: string, options?: Record<string, unknown>) {
      request.cookies.set(name, value);
      supabaseResponse.cookies.set(name, value, { ...options, path: '/' });
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  const isAuthRoute = pathname === '/login' || pathname.startsWith('/auth/callback');
  const isPublicRoute = ['/onboarding', '/workspace-picker'].some((r) => pathname.startsWith(r));

  if (session) {
    const issuedAt = getSessionIssuedAt(session);
    const now = Date.now();

    const deviceCookie = request.cookies.get(DEVICE_COOKIE_NAME)?.value;
    let isTrustedDevice = false;

    if (deviceCookie && session.user?.id) {
      try {
        const result = await verifyDeviceTrust({
          userId: session.user.id,
          deviceCookie,
        });
        isTrustedDevice = result.trusted;
      } catch {
        isTrustedDevice = false;
      }
    }

    const absoluteTimeout = isTrustedDevice ? TRUSTED_ABSOLUTE_SESSION_MS : ABSOLUTE_SESSION_MS;

    if (issuedAt > 0 && now - issuedAt > absoluteTimeout) {
      await supabase.auth.signOut();
      return buildRedirectWithCookies(
        request,
        '/login?message=session_expired',
        supabaseResponse,
      );
    }

    const lastActivity = request.cookies.get('flow-last-activity')?.value;
    if (lastActivity) {
      const parsed = parseInt(lastActivity, 10);
      const elapsed = Number.isNaN(parsed) ? IDLE_SESSION_MS + 1 : now - parsed;
      if (elapsed > IDLE_SESSION_MS) {
        await supabase.auth.signOut();
        return buildRedirectWithCookies(
          request,
          '/login?message=session_expired',
          supabaseResponse,
        );
      }
    }

    supabaseResponse.cookies.set('flow-last-activity', now.toString(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    if (isAuthRoute && pathname !== '/auth/callback' && pathname !== '/auth/callback/error') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } else {
    if (!isAuthRoute && !isPublicRoute) {
      const redirectUrl = new URL('/login', request.url);
      if (pathname !== '/') {
        redirectUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\..*).*)',
  ],
};
