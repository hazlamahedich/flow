import { describe, it, expect } from 'vitest';
import {
  createClientSchema,
  updateClientSchema,
  archiveClientSchema,
  clientListFiltersSchema,
  clientSchema,
  clientStatusEnum,
} from '@flow/types';

describe('createClientSchema', () => {
  it('accepts valid input with name only', () => {
    const result = createClientSchema.safeParse({ name: 'Test Client' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createClientSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only name', () => {
    const result = createClientSchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
  });

  it('trims name whitespace', () => {
    const result = createClientSchema.safeParse({ name: '  Test  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Test');
  });

  it('accepts all optional fields', () => {
    const result = createClientSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      phone: '555-1234',
      companyName: 'Acme',
      address: '123 Main St',
      notes: 'Some notes',
      billingEmail: 'billing@example.com',
      hourlyRateCents: 5000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = createClientSchema.safeParse({ name: 'Test', email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts null hourlyRateCents', () => {
    const result = createClientSchema.safeParse({ name: 'Test', hourlyRateCents: null });
    expect(result.success).toBe(true);
  });

  it('accepts zero hourlyRateCents (pro bono)', () => {
    const result = createClientSchema.safeParse({ name: 'Test', hourlyRateCents: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects negative hourlyRateCents', () => {
    const result = createClientSchema.safeParse({ name: 'Test', hourlyRateCents: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects float hourlyRateCents', () => {
    const result = createClientSchema.safeParse({ name: 'Test', hourlyRateCents: 50.5 });
    expect(result.success).toBe(false);
  });

  it('rejects string hourlyRateCents', () => {
    const result = createClientSchema.safeParse({ name: 'Test', hourlyRateCents: '5000' });
    expect(result.success).toBe(false);
  });

  it('accepts empty string as optional field', () => {
    const result = createClientSchema.safeParse({ name: 'Test', email: '', phone: '' });
    expect(result.success).toBe(true);
  });
});

describe('updateClientSchema', () => {
  it('requires clientId', () => {
    const result = updateClientSchema.safeParse({ name: 'Updated' });
    expect(result.success).toBe(false);
  });

  it('accepts clientId with partial updates', () => {
    const result = updateClientSchema.safeParse({ clientId: '550e8400-e29b-41d4-a716-446655440000', name: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('accepts clientId only', () => {
    const result = updateClientSchema.safeParse({ clientId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(true);
  });
});

describe('archiveClientSchema', () => {
  it('requires clientId as uuid', () => {
    const result = archiveClientSchema.safeParse({ clientId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('accepts valid uuid', () => {
    const result = archiveClientSchema.safeParse({ clientId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(true);
  });
});

describe('clientListFiltersSchema', () => {
  it('uses defaults when no filters provided', () => {
    const result = clientListFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(25);
      expect(result.data.sortBy).toBe('created_at');
      expect(result.data.sortOrder).toBe('desc');
    }
  });

  it('accepts valid status filter', () => {
    const result = clientListFiltersSchema.safeParse({ status: 'archived' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = clientListFiltersSchema.safeParse({ status: 'deleted' });
    expect(result.success).toBe(false);
  });
});

describe('clientSchema', () => {
  it('parses a valid client row', () => {
    const result = clientSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Test Client',
      email: 'test@example.com',
      phone: '555-1234',
      companyName: 'Acme Corp',
      address: null,
      notes: null,
      billingEmail: null,
      hourlyRateCents: 10000,
      status: 'active',
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('clientStatusEnum', () => {
  it('accepts active', () => {
    expect(clientStatusEnum.safeParse('active').success).toBe(true);
  });
  it('accepts archived', () => {
    expect(clientStatusEnum.safeParse('archived').success).toBe(true);
  });
  it('rejects unknown status', () => {
    expect(clientStatusEnum.safeParse('suspended').success).toBe(false);
  });
});
