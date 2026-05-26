import { describe, it, expect, vi } from 'vitest';
import { handleRetryDelivery } from '../retry-delivery.js';

const mockSupabase = (): unknown => ({
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'del-id',
              invoice_id: 'inv-id',
              status: 'failed',
              retry_count: 1,
              message_id: null,
              invoice: {
                payment_url: 'https://pay.example.com',
                total_cents: 50000,
                currency: 'usd',
                invoice_number: 'INV-001',
                clients: { email: 'a@b.com', name: 'Acme' },
              },
            },
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'del-id',
        invoice_id: 'inv-id',
        status: 'failed',
        retry_count: 1,
        message_id: null,
        invoice: {
          payment_url: 'https://pay.example.com',
          total_cents: 50000,
          currency: 'usd',
          invoice_number: 'INV-001',
          clients: { email: 'a@b.com', name: 'Acme' },
        },
      },
    }),
  }),
});

describe('retry-delivery', () => {
  it('throws if delivery record not found', async () => {
    const boss = { send: vi.fn() } as unknown as import('pg-boss').default;
    await expect(
      handleRetryDelivery(boss, { deliveryId: 'x', workspaceId: 'y' },
        {
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: vi.fn().mockResolvedValue({ data: null, error: new Error('nope') }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
          }),
        }),
    ).rejects.toThrow('Delivery record not found');
  });
});
