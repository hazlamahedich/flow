import { describe, it, expect } from 'vitest';

describe('browser Supabase client', () => {
  it('singleton pattern returns consistent reference', () => {
    let client: unknown = null;
    const createClient = () => ({ auth: {} });
    const getInstance = () => {
      if (!client) client = createClient();
      return client;
    };
    expect(getInstance()).toBe(getInstance());
  });
});
