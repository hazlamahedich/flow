'use server';

import { z } from 'zod';
import { createFlowError } from '@flow/db';
import { headers } from 'next/headers';
import type { ActionResult } from '@flow/types';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAuthEvent } from '@/lib/auth-audit';
import { getServerSupabase } from '@/lib/supabase-server';

const emailSchema = z.string().email('Please enter a valid email address');

export async function sendMagicLink(
  _prev: ActionResult<{ sent: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: true }>> {
  const rawEmail = formData.get('email');
  const parsed = emailSchema.safeParse(rawEmail);

  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid email',
        'validation',
      ),
    };
  }

  const email = parsed.data;

  const rateResult = await checkRateLimit(email);
  if (!rateResult.allowed) {
    const headerStore = await headers();
    const ip = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? 'unknown';
    await logAuthEvent({
      action: 'rate_limit_triggered',
      email,
      ip,
      outcome: 'failure',
      details: { limit_type: 'magic_link_request', retry_after_ms: rateResult.retryAfterMs },
    });

    return {
      success: false,
      error: createFlowError(
        429,
        'RATE_LIMITED',
        `Too many requests. Please try again in ${Math.ceil(rateResult.retryAfterMs / 1000)} seconds.`,
        'auth',
      ),
    };
  }

  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? 'unknown';

  await logAuthEvent({ action: 'magic_link_requested', email, ip, outcome: 'success' });

  try {
    const supabase = await getServerSupabase();

    const origin = headerStore.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      return {
        success: false,
        error: createFlowError(
          500,
          'INTERNAL_ERROR',
          'Failed to send magic link. Please try again.',
          'system',
        ),
      };
    }

    await logAuthEvent({ action: 'magic_link_sent', email, ip, outcome: 'success' });

    return { success: true, data: { sent: true } };
  } catch {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Something went wrong. Please try again.',
        'system',
      ),
    };
  }
}
