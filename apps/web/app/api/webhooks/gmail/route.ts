import { NextResponse } from 'next/server';
import { createServiceClient } from '@flow/db';
import {
  insertRawPayload,
  markMessageProcessed,
} from '@flow/db';
import { verifyGoogleOidcToken } from '@flow/agents/providers';

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const expectedAudience = process.env.GMAIL_PUBSUB_AUDIENCE ?? '';
  if (!expectedAudience) {
    if (process.env.NODE_ENV === 'production') {
      console.error('GMAIL_PUBSUB_AUDIENCE not configured — webhook authentication disabled in production');
      return new Response('Service misconfigured', { status: 500 });
    }
    console.warn('GMAIL_PUBSUB_AUDIENCE not configured — webhook authentication skipped in development');
  } else {
    const verified = await verifyGoogleOidcToken(authHeader.slice(7), expectedAudience);
    if (!verified) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('OK', { status: 200 });
  }

  const message = (body as Record<string, unknown>)?.message as
    | { data?: string; messageId?: string; publishTime?: string }
    | undefined;

  if (!message?.data || !message.messageId) {
    return new Response('OK', { status: 200 });
  }

  let decoded: { emailAddress?: string; historyId?: string };
  try {
    decoded = JSON.parse(
      Buffer.from(message.data, 'base64').toString('utf-8'),
    );
  } catch {
    return new Response('OK', { status: 200 });
  }

  if (!decoded.emailAddress || !decoded.historyId) {
    return new Response('OK', { status: 200 });
  }

  try {
    const supabase = createServiceClient();

    const normalizedEmail = decoded.emailAddress.toLowerCase();
    const { data: inboxRows } = await supabase
      .from('client_inboxes')
      .select('*')
      .eq('email_address', normalizedEmail)
      .in('sync_status', ['connected', 'syncing']);

    if (!inboxRows?.length) {
      return new Response('OK', { status: 200 });
    }

    for (const inbox of inboxRows) {
      try {
        await markMessageProcessed(supabase, {
          workspaceId: inbox.workspace_id,
          messageId: message.messageId,
          clientInboxId: inbox.id,
        });
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
          return new Response('OK', { status: 200 });
        }
        throw err;
      }

      await insertRawPayload(supabase, {
        workspaceId: inbox.workspace_id,
        clientInboxId: inbox.id,
        emailAddress: decoded.emailAddress,
        historyId: decoded.historyId,
        rawPayload: body as Record<string, unknown>,
      });
    }
  } catch {
    // Log but don't fail — avoid Google retry storms
  }

  return new Response('OK', { status: 200 });
}
