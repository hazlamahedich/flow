import { google, gmail_v1 } from 'googleapis';
import type {
  EmailHistoryItem,
  EmailMetadata,
  EmailMessage,
  EmailMessageHeader,
  WatchInboxResult,
} from '../email-provider.js';

export async function getHistorySince(
  accessToken: string,
  startHistoryId: string,
): Promise<EmailHistoryItem[]> {
  const gmail = google.gmail({ version: 'v1', auth: accessToken });
  const items: EmailHistoryItem[] = [];
  let pageToken: string | undefined;

  const { data } = await gmail.users.history.list({
    userId: 'me',
    startHistoryId,
    historyTypes: ['messageAdded'],
  });

  for (const history of data.history ?? []) {
    for (const msg of history.messagesAdded ?? []) {
      if (msg.message?.id) {
        items.push({
          messageId: msg.message.id,
          threadId: msg.message.threadId ?? msg.message.id,
        });
      }
    }
  }

  pageToken = data.nextPageToken ?? undefined;
  while (pageToken) {
    const nextPage = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      pageToken,
    });
    for (const history of nextPage.data.history ?? []) {
      for (const msg of history.messagesAdded ?? []) {
        if (msg.message?.id) {
          items.push({
            messageId: msg.message.id,
            threadId: msg.message.threadId ?? msg.message.id,
          });
        }
      }
    }
    pageToken = nextPage.data.nextPageToken ?? undefined;
  }

  return items;
}

export async function listMessages(
  accessToken: string,
  query: string,
  maxResults: number,
): Promise<EmailHistoryItem[]> {
  const gmail = google.gmail({ version: 'v1', auth: accessToken });
  const items: EmailHistoryItem[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, unknown> = {
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults - items.length, 500),
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await gmail.users.messages.list(params);

    for (const msg of data.messages ?? []) {
      if (msg.id) {
        items.push({
          messageId: msg.id,
          threadId: msg.threadId ?? msg.id,
        });
      }
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && items.length < maxResults);

  return items;
}

function parseEmailMetadata(data: gmail_v1.Schema$Message): EmailMetadata {
  const headers = (data.payload?.headers ?? []) as EmailMessageHeader[];
  const getHeader = (name: string): string | null =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;

  const fromHeader = getHeader('From') ?? '';
  const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
  const fromAddress = fromMatch?.[2]?.trim() ?? fromHeader.trim();
  const fromName = fromMatch?.[1]?.trim().replace(/^"|"$/g, '') ?? null;

  const parseAddressList = (raw: string | null): Array<{ name: string | null; address: string }> => {
    if (!raw) return [];
    const segments = raw.match(/("[^"]*"\s*<[^>]+>|[^,]+)/g) ?? [raw];
    return segments.map((addr) => {
      const trimmed = addr.trim();
      const m = trimmed.match(/^(.+?)\s*<(.+?)>$/);
      if (m && m[1] && m[2]) {
        return { name: m[1].trim().replace(/^"|"$/g, ''), address: m[2].trim() };
      }
      return { name: null, address: trimmed };
    });
  };

  const dateHeader = getHeader('Date');
  let receivedAt: string;
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    receivedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } else {
    receivedAt = new Date().toISOString();
  }

  return {
    gmailMessageId: data.id ?? '',
    gmailThreadId: data.threadId ?? '',
    subject: getHeader('Subject'),
    fromAddress,
    fromName,
    toAddresses: parseAddressList(getHeader('To')),
    ccAddresses: parseAddressList(getHeader('Cc')),
    receivedAt,
    headers,
  };
}

export async function getMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<EmailMetadata> {
  const gmail = google.gmail({ version: 'v1', auth: accessToken });
  const { data } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From', 'To', 'Cc', 'Date'],
  });

  return parseEmailMetadata(data);
}

export async function getMessage(
  accessToken: string,
  messageId: string,
): Promise<EmailMessage> {
  const gmail = google.gmail({ version: 'v1', auth: accessToken });
  const { data } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const metadata = parseEmailMetadata(data);

  let bodyHtml: string | null = null;
  let bodyText: string | null = null;

  const parts = data.payload ? [data.payload] : [];
  while (parts.length > 0) {
    const part = parts.shift();
    if (!part) continue;

    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText = Buffer.from(part.body.data, 'base64').toString('utf8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf8');
    }

    if (part.parts) {
      parts.push(...part.parts);
    }
  }

  return {
    ...metadata,
    bodyHtml,
    bodyText,
  };
}

export async function getProfile(
  accessToken: string,
): Promise<{ emailAddress: string; historyId: string }> {
  const gmail = google.gmail({ version: 'v1', auth: accessToken });
  const { data } = await gmail.users.getProfile({ userId: 'me' });
  if (!data.emailAddress || !data.historyId) {
    throw Object.assign(
      new Error('Gmail profile did not return required fields'),
      { code: 'INBOX_CONNECTION_FAILED' as const, statusCode: 502 },
    );
  }
  return {
    emailAddress: data.emailAddress,
    historyId: data.historyId,
  };
}

export async function watchInbox(
  accessToken: string,
  topicName: string,
): Promise<WatchInboxResult> {
  const gmail = google.gmail({ version: 'v1', auth: accessToken });
  const { data } = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
    },
  });
  return {
    historyId: data.historyId ?? '',
    expiration: data.expiration ?? '',
  };
}

export async function stopWatch(accessToken: string): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth: accessToken });
  await gmail.users.stop({ userId: 'me' });
}

export async function verifyDelegation(
  delegatedEmail: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const gmail = google.gmail({ version: 'v1', auth: accessToken });
    const { data } = await gmail.users.getProfile({ userId: delegatedEmail });
    return data.emailAddress === delegatedEmail;
  } catch {
    return false;
  }
}
