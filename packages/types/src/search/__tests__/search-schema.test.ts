import { describe, it, expect } from 'vitest';
import {
  SearchInputSchema,
  SearchResultSchema,
  SearchResultsSchema,
} from '../search-schema';

describe('SearchInputSchema', () => {
  it('accepts valid query', () => {
    const result = SearchInputSchema.safeParse({ query: 'invoices' });
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = SearchInputSchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('rejects >200 chars', () => {
    const result = SearchInputSchema.safeParse({ query: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe('SearchResultSchema', () => {
  const validResult = {
    id: '00000000-0000-0000-0000-000000000001',
    type: 'client',
    label: 'Acme Corp',
    description: 'A client',
    href: '/clients/acme',
  };

  it('accepts valid result with all fields', () => {
    const result = SearchResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
  });

  it('accepts result without description', () => {
    const { description, ...withoutDesc } = validResult;
    const result = SearchResultSchema.safeParse(withoutDesc);
    expect(result.success).toBe(true);
  });

  it('rejects invalid type enum', () => {
    const result = SearchResultSchema.safeParse({
      ...validResult,
      type: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID id', () => {
    const result = SearchResultSchema.safeParse({
      ...validResult,
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('SearchResultsSchema', () => {
  const validResult = {
    id: '00000000-0000-0000-0000-000000000001',
    type: 'client' as const,
    label: 'Acme Corp',
    href: '/clients/acme',
  };

  it('accepts array of results', () => {
    const result = SearchResultsSchema.safeParse([validResult, validResult]);
    expect(result.success).toBe(true);
  });

  it('rejects non-array', () => {
    const result = SearchResultsSchema.safeParse(validResult);
    expect(result.success).toBe(false);
  });
});
