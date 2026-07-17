import { describe, it, expect, vi } from 'vitest';
import { defaultInvoiceEditGuard } from '../invoice-guard';
import type { InvoiceEditGuard } from '../invoice-guard';

describe('defaultInvoiceEditGuard', () => {
  it('returns false for any entry ID', async () => {
    const result = await defaultInvoiceEditGuard.isInvoiced('some-entry-id');
    expect(result).toBe(false);
  });

  it('returns false for empty string', async () => {
    const result = await defaultInvoiceEditGuard.isInvoiced('');
    expect(result).toBe(false);
  });

  it('returns false for UUID format', async () => {
    const result = await defaultInvoiceEditGuard.isInvoiced(
      '00000000-0000-0000-0000-000000000001',
    );
    expect(result).toBe(false);
  });
});

describe('InvoiceEditGuard interface contract', () => {
  it('mock guard can return true', async () => {
    const mockGuard: InvoiceEditGuard = {
      isInvoiced: async () => true,
    };
    const result = await mockGuard.isInvoiced('any-id');
    expect(result).toBe(true);
  });

  it('mock guard can return false', async () => {
    const mockGuard: InvoiceEditGuard = {
      isInvoiced: async () => false,
    };
    const result = await mockGuard.isInvoiced('any-id');
    expect(result).toBe(false);
  });

  it('mock guard is called with correct entryId', async () => {
    const isInvoiced = vi.fn().mockResolvedValue(true);
    const mockGuard: InvoiceEditGuard = { isInvoiced };
    await mockGuard.isInvoiced('test-entry-123');
    expect(isInvoiced).toHaveBeenCalledWith('test-entry-123');
  });
});
