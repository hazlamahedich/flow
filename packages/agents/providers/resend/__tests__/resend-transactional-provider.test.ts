import { describe, it, expect, vi } from 'vitest';
import {
  ResendTransactionalProvider,
  ResendApiError,
} from '../resend-transactional-provider.js';

describe('ResendTransactionalProvider', () => {
  it('throws if API key does not start with re_', () => {
    expect(() => new ResendTransactionalProvider('bad_key')).toThrow(
      'Resend API key must start with re_',
    );
  });

  it('constructs with re_ key', () => {
    expect(() => new ResendTransactionalProvider('re_test')).not.toThrow();
  });

  it('returns provider name', () => {
    const p = new ResendTransactionalProvider('re_test');
    expect(p.getProviderName()).toBe('resend');
  });

  it('calls Resend API and returns messageId', async () => {
    const p = new ResendTransactionalProvider('re_test');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_test123' }),
    });

    const result = await p.send({
      to: 'client@example.com',
      subject: 'Invoice INV-001',
      htmlBody: '<p>Pay</p>',
      textBody: 'Pay here',
      metadata: { invoice_id: 'inv1' },
    });

    expect(result.messageId).toBe('msg_test123');
  });

  it('throws ResendApiError on non-2xx', async () => {
    const p = new ResendTransactionalProvider('re_test');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Invalid email' }),
    });

    await expect(
      p.send({
        to: 'bad',
        subject: 'S',
        htmlBody: 'H',
        textBody: 'T',
        metadata: {},
      }),
    ).rejects.toThrow(ResendApiError);
  });
});
