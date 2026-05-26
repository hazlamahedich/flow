import type {
  TransactionalEmailProvider,
  TransactionalEmailPayload,
  TransactionalEmailResult,
} from '../transactional-email-provider.js';

export class ResendTransactionalProvider implements TransactionalEmailProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey.startsWith('re_')) {
      throw new Error('Resend API key must start with re_');
    }
    this.apiKey = apiKey;
  }

  getProviderName(): string {
    return 'resend';
  }

  async send(payload: TransactionalEmailPayload): Promise<TransactionalEmailResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Flow OS <invoices@flow.app>',
          to: payload.to,
          subject: payload.subject,
          html: payload.htmlBody,
          text: payload.textBody,
          tags: Object.entries(payload.metadata).map(([name, value]) => ({ name, value })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({} as Record<string, unknown>));
        const message = (body as { message?: string }).message ?? `Resend API error: ${response.status}`;
        throw new ResendApiError(message, response.status);
      }

      const data = await response.json() as { id: string };
      return { messageId: data.id };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class ResendApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ResendApiError';
  }
}
