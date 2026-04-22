import { createServiceClient, syncUserEmail, cacheTag } from '@flow/db';
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(
      new URL('/settings/profile?email_error=expired', request.url),
    );
  }

  // Token-authorized (not session-authorized): verification links are clicked
  // from email clients with no guaranteed session. service_role is permitted
  // by spec for this Route Handler (AC#4).
  const adminClient = createServiceClient();

  const { data: claimed, error: claimError } = await adminClient
    .from('email_change_requests')
    .update({ status: 'verified' })
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .select('user_id, new_email')
    .maybeSingle();

  if (claimError) {
    return NextResponse.redirect(
      new URL('/settings/profile?email_error=sync-failed', request.url),
    );
  }

  if (!claimed) {
    const { data: existing } = await adminClient
      .from('email_change_requests')
      .select('status, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (existing && (existing.status === 'expired' || new Date(existing.expires_at) < new Date())) {
      return NextResponse.redirect(
        new URL('/settings/profile?email_error=expired', request.url),
      );
    }

    return NextResponse.redirect(
      new URL('/login?message=email-changed', request.url),
    );
  }

  try {
    await syncUserEmail(adminClient, claimed.user_id, claimed.new_email);

    await adminClient.auth.admin.signOut(claimed.user_id);

    revalidateTag(cacheTag('user', claimed.user_id));
  } catch {
    return NextResponse.redirect(
      new URL('/settings/profile?email_error=sync-failed', request.url),
    );
  }

  return NextResponse.redirect(
    new URL(`/login?message=email-changed&email=${encodeURIComponent(claimed.new_email)}`, request.url),
  );
}
