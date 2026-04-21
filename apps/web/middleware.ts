import { createServerClient } from '@flow/db';
import { NextRequest, NextResponse } from 'next/server';

const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
const IDLE_SESSION_MS = 4 * 60 * 60 * 1000;

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
    const issuedAt = session.user?.created_at
      ? new Date(session.user.created_at).getTime()
      : 0;
    const now = Date.now();

    if (now - issuedAt > ABSOLUTE_SESSION_MS) {
      await supabase.auth.signOut();
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('message', 'session_expired');
      return NextResponse.redirect(redirectUrl);
    }

    const lastActivity = request.cookies.get('flow-last-activity')?.value;
    if (lastActivity) {
      const elapsed = now - parseInt(lastActivity, 10);
      if (elapsed > IDLE_SESSION_MS) {
        await supabase.auth.signOut();
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('message', 'session_expired');
        return NextResponse.redirect(redirectUrl);
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
