import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signDeliveryToken, verifyDeliveryToken } from '../token.js';

const SECRET = 'test-secret-for-hmac-signing-32chars';

describe('delivery token', () => {
  beforeEach(() => {
    process.env.INVOICE_TOKEN_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.INVOICE_TOKEN_SECRET;
  });

  it('round-trips: sign then verify returns original payload', async () => {
    const token = await signDeliveryToken({
      invoiceId: 'inv-1',
      workspaceId: 'ws-1',
    });
    const result = await verifyDeliveryToken(token);
    expect(result.invoiceId).toBe('inv-1');
    expect(result.workspaceId).toBe('ws-1');
  });

  it('rejects expired tokens', async () => {
    const originalNow = Date.now;
    let callCount = 0;
    Date.now = () => {
      callCount++;
      return callCount === 1
        ? originalNow.call(Date) - 15 * 24 * 60 * 60 * 1000
        : originalNow.call(Date);
    };
    try {
      const token = await signDeliveryToken({
        invoiceId: 'inv-exp',
        workspaceId: 'ws-exp',
      });
      await expect(verifyDeliveryToken(token)).rejects.toThrow('Token expired');
    } finally {
      Date.now = originalNow;
    }
  });

  it('rejects tampered signature', async () => {
    const token = await signDeliveryToken({
      invoiceId: 'inv-tamper',
      workspaceId: 'ws-tamper',
    });
    const [payload, sig] = token.split('.');
    const tampered = `${payload}.${sig.slice(0, -4)}XXXX`;
    await expect(verifyDeliveryToken(tampered)).rejects.toThrow(
      'Invalid token signature',
    );
  });

  it('rejects token with no dot separator', async () => {
    await expect(verifyDeliveryToken('noseparator')).rejects.toThrow(
      'Invalid token format',
    );
  });

  it('rejects token with missing INVOICE_TOKEN_SECRET', async () => {
    delete process.env.INVOICE_TOKEN_SECRET;
    await expect(
      signDeliveryToken({ invoiceId: 'a', workspaceId: 'b' }),
    ).rejects.toThrow('INVOICE_TOKEN_SECRET not configured');
  });
});
